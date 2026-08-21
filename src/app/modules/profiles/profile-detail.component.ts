import { Component, OnInit, computed, effect, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  BreadcrumbItem,
  ButtonComponent,
  FormFieldComponent,
  ModalService,
  MultiDatePickerComponent,
  PageComponent,
  PageHeaderBadge,
  PageHeaderComponent,
  RadioGroupComponent,
  StatusBadgeComponent,
  TabItem,
  TabsComponent,
  type ModalRef,
  type SelectOption,
  type UploadedFile,
} from '@khalilrebhiitec/daf360';

import { ProfileService } from './profile.service';
import {
  DOCUMENT_TYPE_CODES,
  EmployeeDocument,
  EmployeeProfile,
  ProfileDocumentRow,
  LifecycleStatus,
  LIFECYCLE_TRANSITIONS,
  LIFECYCLE_LABELS,
  ProfileUpdateDto,
} from './models/profile.model';
import { statusBadge } from '../../shared/status-badge.utils';
import { GENDER_OPTIONS } from '../../shared/utils/gender.utils';
import { profilePhotoUrl } from '../../shared/utils/avatar.utils';
import { UserStore } from '../../core/user.store';
import { NotificationService } from '../../core/notification.service';
import { PdfDownloadService, GeneratedDocumentResponse } from '../../core/pdf/pdf-download.service';
import { RegimeService } from '../admin/regimes/regime.service';
import { ResolvedRegimeDto } from '../admin/regimes/regime.model';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem } from '../../core/ref/ref-data.model';
import { ContractHistoryService } from './contract-history/contract-history.service';
import { ContractHistoryDto } from './contract-history/contract-history.model';
import { ContractLifecycleService } from './lifecycle/contract-lifecycle.service';
import {
  ContractListDto, ContractDetailDto, ContractTransitionHistoryDto, CONTRACT_TYPE_CONFIG,
} from './lifecycle/contract-lifecycle.model';
import { NewContractFormComponent } from './lifecycle/new-contract-form.component';
import { DocumentEditFormComponent } from './documents/document-edit-form.component';
import { ItAssetService } from './it-assets/it-asset.service';
import { ItAssetAssignmentDto } from './it-assets/it-asset.model';
import { AssetAssignFormComponent } from './it-assets/asset-assign-form.component';
import { AssetReturnFormComponent } from './it-assets/asset-return-form.component';
import { ConfirmService } from '../../core/confirm.service';
import { OffboardingService } from '../offboarding/offboarding.service';
import { DepartureReason } from '../offboarding/models/offboarding.model';

import { IdentityCardComponent, IdentityPill } from './detail-sections/identity-card.component';
import { EmploymentSectionComponent } from './detail-sections/employment-section.component';
import { PositionSectionComponent } from './detail-sections/position-section.component';
import { RegimeSectionComponent } from './detail-sections/regime-section.component';
import { ContactSectionComponent } from './detail-sections/contact-section.component';
import { EmergencySectionComponent } from './detail-sections/emergency-section.component';
import { BankingSectionComponent } from './detail-sections/banking-section.component';
import { LifecycleSectionComponent } from './detail-sections/lifecycle-section.component';
import { DocumentsSectionComponent } from './detail-sections/documents-section.component';
import { ItAssetsSectionComponent } from './detail-sections/it-assets-section.component';
import { DocumentsDrawerComponent } from './detail-sections/documents-drawer.component';
import { fromDate, toDate } from './detail-sections/field-bridges';

/**
 * One per section of the original page, minus Identité — the design keeps that
 * one permanently on screen in the left card rather than behind a tab.
 */
type TabId =
  | 'emploi' | 'contact' | 'bancaire'
  // One 'Contrats' tab, not two. 'contrats' (lifecycle) and 'historique' (the manual
  // historique_contrat log) were separate tabs showing two unrelated notions of "contract";
  // they are merged under 'historique' so the lifecycle actions — New contract, which is the
  // only way to change an employee's frozen préavis, plus trial validation / CDD renewal /
  // CDI conversion — stay reachable from one place.
  | 'historique'
  // The IT equipment ledger (it_asset_assignments, V76) — what the employee holds and
  // what they held before. Not part of 'documents': it is inventory, not paperwork.
  | 'materiel' | 'documents';

/**
 * Departure types offered by the profile's "Démarrer l'offboarding" action.
 *
 * Only RESIGNATION for now, by request. Add the other codes of `DEPARTURE_REASONS` here
 * one line at a time — the modal, the request and the redirect are already generic, and
 * a single-entry list still renders as a chooser so the type is always a deliberate pick.
 */
const OFFERED_DEPARTURE_REASONS: readonly DepartureReason[] = ['RESIGNATION'];

/**
 * Which `ProfileUpdateDto` keys belong to which tab. Drives the per-tab dirty
 * marker: with only one tab on screen at a time, a pending change three tabs
 * away is otherwise invisible until you save. Identité needs no entry — it is
 * never hidden.
 */
const TAB_FIELDS: Partial<Record<TabId, (keyof ProfileUpdateDto)[]>> = {
  // Emploi & poste is one tab, so its marker covers the contract, the pay and
  // the affectation blocks together.
  emploi:   ['hireDate', 'contractType', 'contractEndDate', 'probationEndDate', 'isOnProbation',
             'salaireNetCandidat', 'salaireNetRh', 'departmentId', 'gradeId', 'disciplineId', 'nogLevelId'],
  // Contact holds both the employee's own details and the emergency contact.
  contact:  ['personalEmail', 'phone', 'personalAddress',
             'emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone'],
  bancaire: ['bankId', 'iban', 'bankAccountNumber', 'rib', 'socialSecurityNumber', 'taxId', 'cnssNumber', 'cnssAffiliationDate'],
};

/*
 * The document-type list is no longer local to this page: the backend validates uploads
 * against the same set (EmployeeDocumentService.DOCUMENT_TYPES). The old array here was
 * missing CONTRACT_SIGNED — which onboarding itself writes — so a document the app had
 * created could not be re-selected, and the codes were shown to the user raw.
 */

/**
 * /rh/profiles/:id — the employee dossier.
 *
 * Shape follows UI-PLAYBOOK §1/§8b, the same as `/rh/recrutement`: `daf-page` +
 * `daf-page-header` (breadcrumbs + status badges) + an identity strip + a
 * `daf-tabs` strip, with one section component per tab and the Documents dossier
 * in a `daf-drawer`. It replaces ten copy-pasted collapsible `daf-card`s, a
 * hand-rolled breadcrumb and heading, and 150 lines of SCSS.
 *
 * **Edit is global, not per-tab.** The save endpoint takes one audited `reason`
 * per `ProfileUpdateDto`, and `/rh/profiles` deep-links here with `?edit=true`
 * meaning "open this dossier for editing". So the header button flips the whole
 * page and one sticky bar closes it — and because `editForm` lives here, moving
 * between tabs mid-edit keeps every pending change.
 */
@Component({
  selector: 'app-profile-detail',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, TabsComponent, ButtonComponent,
    FormFieldComponent, MultiDatePickerComponent, RadioGroupComponent, StatusBadgeComponent,
    IdentityCardComponent, EmploymentSectionComponent,
    PositionSectionComponent, RegimeSectionComponent, ContactSectionComponent,
    EmergencySectionComponent, BankingSectionComponent, LifecycleSectionComponent,
    DocumentsSectionComponent, DocumentsDrawerComponent, ItAssetsSectionComponent,
    NewContractFormComponent, AssetAssignFormComponent, AssetReturnFormComponent,
    DocumentEditFormComponent,
    TranslatePipe,
  ],
  templateUrl: './profile-detail.component.html',
})
export class ProfileDetailComponent implements OnInit {
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private confirm      = inject(ConfirmService);
  private svc          = inject(ProfileService);
  private userStore    = inject(UserStore);
  private pdfSvc       = inject(PdfDownloadService);
  private regimeSvc    = inject(RegimeService);
  private refSvc       = inject(RefDataService);
  private assetSvc     = inject(ItAssetService);
  private lcSvc        = inject(ContractLifecycleService);
  private contractHistorySvc = inject(ContractHistoryService);
  private modalService = inject(ModalService);
  private offboardingSvc = inject(OffboardingService);
  private translate    = inject(TranslateService);
  private notify       = inject(NotificationService);

  profileId = 0;

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly profile       = signal<EmployeeProfile | null>(null);
  readonly documents     = signal<EmployeeDocument[]>([]);
  readonly generatedDocs = signal<GeneratedDocumentResponse[]>([]);
  readonly resolvedRegime = signal<ResolvedRegimeDto | null>(null);

  /** Whole-page skeleton — first load only (§5). */
  readonly firstLoad     = signal(true);
  readonly loadFailed    = signal(false);
  readonly saving        = signal(false);
  readonly docsLoading   = signal(true);
  readonly regimeLoading = signal(true);

  // ── Edit ───────────────────────────────────────────────────────────────────
  readonly editMode      = signal(false);
  readonly editForm      = signal<ProfileUpdateDto>({ reason: '' });
  readonly editSaveError = signal<string | null>(null);

  /** Sections emit partials; the page is the only writer. */
  patch(part: Partial<ProfileUpdateDto>): void {
    this.editForm.update(f => ({ ...f, ...part }));
  }

  setReason(value: string | number | null): void {
    this.patch({ reason: value == null ? '' : String(value) });
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────
  readonly activeTab = signal<TabId>('emploi');

  readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const dirty = this.dirtyTabs();
    const items: TabItem[] = [
      { id: 'emploi',  label: t('PROFILES.SECTIONS.EMPLOYMENT_POSITION'), marker: dirty.has('emploi')  },
      { id: 'contact', label: t('PROFILES.SECTIONS.CONTACT'),             marker: dirty.has('contact') },
    ];
    // Filtered out entirely rather than disabled — a greyed tab still advertises
    // that confidential data exists.
    if (this.canViewSensitive()) {
      items.push({ id: 'bancaire', label: t('PROFILES.SECTIONS.BANK'), marker: dirty.has('bancaire') });
    }
    items.push(
      // Count is the lifecycle contracts, not the historique rows: those are the ones with a
      // state machine, a trial period and a préavis.
      { id: 'historique', label: t('PROFILES.SECTIONS.CONTRACTS'), count: this.lcContracts().length || null },
      // Count is what the employee holds TODAY, not the whole ledger: the badge answers
      // 'how much hardware is out with this person', which is the operational question.
      { id: 'materiel',   label: t('PROFILES.SECTIONS.IT_ASSETS'), count: this.currentAssetCount() || null },
      { id: 'documents',  label: t('PROFILES.SECTIONS.DOCUMENTS'), count: this.documents().length || null },
    );
    return items;
  });

  /** Tabs whose fields differ from the loaded profile. Empty outside edit mode. */
  private readonly dirtyTabs = computed<Set<TabId>>(() => {
    const out = new Set<TabId>();
    if (!this.editMode()) return out;
    const p = this.profile();
    const f = this.editForm();
    if (!p) return out;
    // The DTO and the profile share these field names but not their types (and the
    // DTO has no index signature), so the profile side is read through an indexable
    // view. `normalise` then treats '' / null / undefined alike: the form seeds ''
    // where the profile holds null, and that is not a user edit.
    const profileFields = p as unknown as Record<string, unknown>;
    for (const [tab, keys] of Object.entries(TAB_FIELDS) as [TabId, (keyof ProfileUpdateDto)[]][]) {
      if (keys.some(k => normalise(f[k]) !== normalise(profileFields[k]))) {
        out.add(tab);
      }
    }
    return out;
  });

  onTabChange(id: string): void {
    const tab = id as TabId;
    this.activeTab.set(tab);
    // Shareable + survives a refresh or a back navigation. `merge` keeps ?edit=true.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.translate.currentLang();
    const p = this.profile();
    return [
      { label: this.translate.instant('PROFILES.LIST.TITLE'), link: '/rh/profiles' },
      { label: p?.fullName ?? this.translate.instant('PROFILES.DETAIL.PROFILE_NUM', { id: this.profileId }) },
    ];
  });

  readonly headerTitle = computed(() => {
    this.translate.currentLang();
    const p = this.profile();
    return p?.fullName ?? this.translate.instant('PROFILES.DETAIL.PROFILE_NUM', { id: this.profileId });
  });

  /** Grade · département — the contract type moved up into a badge. */
  readonly headerSubtitle = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return [p.grade, p.department].filter(Boolean).join(' · ');
  });

  readonly headerBadges = computed<PageHeaderBadge[]>(() => {
    this.translate.currentLang();
    const p = this.profile();
    if (!p) return [];
    const badges: PageHeaderBadge[] = [{
      label:   this.lifecycleLabel(p.lifecycleStatus),
      variant: statusBadge(p.lifecycleStatus).options.variant,
      size:    'sm',
    }];
    if (p.contractType) {
      badges.push({ label: this.contractTypeLabel(p.contractType), variant: 'neutral', size: 'sm' });
    }
    if (p.matricule) {
      badges.push({ label: p.matricule, variant: 'secondary', size: 'sm', icon: 'badge' });
    }
    if (p.paysLabel) {
      badges.push({ label: p.paysLabel, variant: 'neutral', size: 'sm', icon: 'public' });
    }
    if (this.canViewSensitive()) {
      badges.push({ label: this.translate.instant('PROFILES.SECTIONS.CONFIDENTIAL'), variant: 'warning', size: 'sm', pill: true });
    }
    return badges;
  });

  /** Lifecycle + contract type, the two pills under the name in the design. */
  readonly identityPills = computed<IdentityPill[]>(() => {
    this.translate.currentLang();
    const p = this.profile();
    if (!p) return [];
    const pills: IdentityPill[] = [{
      label:   this.lifecycleLabel(p.lifecycleStatus),
      variant: statusBadge(p.lifecycleStatus).options.variant ?? 'neutral',
    }];
    if (p.contractType) {
      pills.push({ label: this.contractTypeLabel(p.contractType), variant: 'secondary' });
    }
    if (p.paysLabel) {
      pills.push({ label: p.paysLabel, variant: 'neutral' });
    }
    return pills;
  });

  /** Same relative endpoint the list uses — see `profilePhotoUrl`. */
  readonly photoSrc = computed(() => {
    const p = this.profile();
    return profilePhotoUrl(p?.id, p?.photoUrl);
  });

  // ── Permissions ────────────────────────────────────────────────────────────
  readonly canEdit          = signal(true);
  readonly canViewSensitive = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  readonly canTransition    = computed(() =>
    this.profile() !== null && this.allowedTransitions().length > 0 && this.userStore.isHrManager(),
  );

  readonly allowedTransitions = computed((): LifecycleStatus[] => {
    const p = this.profile();
    return p ? (LIFECYCLE_TRANSITIONS[p.lifecycleStatus] ?? []) : [];
  });

  /**
   * `RH_MANAGE_OFFBOARDING` is what `OffboardingController` enforces, and the profile must
   * be in a state the lifecycle can move to OFFBOARDING from. Derived from
   * `LIFECYCLE_TRANSITIONS` rather than hardcoded, so it cannot drift from the state
   * machine the server enforces — an already-OFFBOARDING profile is excluded for free.
   */
  readonly canStartOffboarding = computed(() => {
    const status = this.profile()?.lifecycleStatus;
    return !!status
      && (LIFECYCLE_TRANSITIONS[status] ?? []).includes('OFFBOARDING')
      && this.userStore.hasPermission('RH_MANAGE_OFFBOARDING');
  });

  lifecycleLabel(s: LifecycleStatus): string {
    return LIFECYCLE_LABELS[s] ? this.translate.instant('PROFILES.LIFECYCLE.' + s) : s;
  }

  private contractTypeLabel(code: string): string {
    return CONTRACT_TYPE_CONFIG[code as keyof typeof CONTRACT_TYPE_CONFIG]
      ? this.translate.instant('PROFILES.CONTRACT_TYPE.' + code)
      : code;
  }

  protected readonly statusBadge = statusBadge;
  /**
   * The lifecycle modals hold their dates as plain ISO strings, so they need the
   * same picker bridges the sections use. `fromDate` (not `toISOString()`) is
   * load-bearing: the picker hands back local midnight, and in any positive-offset
   * zone `toISOString()` rolls that back to the previous day.
   */
  protected readonly toDate   = toDate;
  protected readonly fromDate = fromDate;

  // ── Ref data for the edit dropdowns ────────────────────────────────────────
  private readonly grades        = signal<RefDataItem[]>([]);
  private readonly disciplines   = signal<RefDataItem[]>([]);
  private readonly nogLevels     = signal<RefDataItem[]>([]);
  private readonly departments   = signal<RefDataItem[]>([]);
  private readonly banks         = signal<RefDataItem[]>([]);
  private readonly nationalities = signal<RefDataItem[]>([]);

  private blankOption(): SelectOption {
    return { value: '', label: this.translate.instant('PROFILES.COMMON.SELECT_PLACEHOLDER') };
  }
  private refOptions(items: RefDataItem[]): SelectOption[] {
    return [this.blankOption(), ...items.map(i => ({ value: String(i.id), label: i.labelFr }))];
  }

  readonly genderOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [this.blankOption(), ...GENDER_OPTIONS.map(o => ({ value: o.value, label: o.label }))];
  });

  readonly maritalStatusOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      this.blankOption(),
      { value: 'Célibataire', label: this.translate.instant('PROFILES.MARITAL.SINGLE')   },
      { value: 'Marié(e)',    label: this.translate.instant('PROFILES.MARITAL.MARRIED')  },
      { value: 'Divorcé(e)',  label: this.translate.instant('PROFILES.MARITAL.DIVORCED') },
      { value: 'Veuf(ve)',    label: this.translate.instant('PROFILES.MARITAL.WIDOWED')  },
    ];
  });

  readonly contractTypeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      this.blankOption(),
      { value: 'PERMANENT',  label: this.translate.instant('PROFILES.CONTRACT_TYPE.PERMANENT')  },
      { value: 'FIXED_TERM', label: this.translate.instant('PROFILES.CONTRACT_TYPE.FIXED_TERM') },
      { value: 'INTERN',     label: this.translate.instant('PROFILES.CONTRACT_TYPE.INTERN')     },
      { value: 'CONSULTANT', label: this.translate.instant('PROFILES.CONTRACT_TYPE.CONSULTANT') },
    ];
  });

  readonly nationalityOptions = computed(() => this.refOptions(this.nationalities()));
  readonly departmentOptions  = computed(() => this.refOptions(this.departments()));
  readonly gradeOptions       = computed(() => this.refOptions(this.grades()));
  readonly disciplineOptions  = computed(() => this.refOptions(this.disciplines()));
  readonly nogLevelOptions    = computed(() => this.refOptions(this.nogLevels()));
  readonly bankOptions        = computed(() => this.refOptions(this.banks()));

  readonly docTypeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return DOCUMENT_TYPE_CODES.map(code => ({
      value: code,
      label: this.translate.instant('PROFILES.DOC_TYPES.' + code),
    }));
  });

  // ── Photo / documents upload ───────────────────────────────────────────────
  readonly photoUploading = signal(false);
  readonly uploadType     = signal('CONTRACT');
  readonly uploadFiles    = signal<UploadedFile[]>([]);
  readonly docUploading   = signal(false);

  /**
   * The two document sources, merged and sorted newest first.
   *
   * Uploaded pieces and generated attestations live in different tables with different
   * endpoints; the tab used to show only the first, so a dossier with six attestations and
   * no upload read as empty. Merging here — not in the section — keeps the component free of
   * both services.
   */
  readonly documentRows = computed<ProfileDocumentRow[]>(() => {
    const uploaded: ProfileDocumentRow[] = this.documents().map(d => ({
      source: 'UPLOADED',
      id: d.id,
      documentType: d.documentType,
      fileName: d.fileName,
      fileSizeKb: d.fileSizeKb,
      date: d.uploadedAt,
      authorName: d.uploadedByName,
      verificationStatus: d.verificationStatus,
      expirationDate: d.expirationDate,
      notes: d.notes,
    }));
    const generated: ProfileDocumentRow[] = this.generatedDocs().map(g => ({
      source: 'GENERATED',
      id: g.id,
      documentType: g.documentType,
      // The generated PDF has no user-chosen name; the type IS the name of the piece.
      fileName: null,
      fileSizeKb: null,
      date: g.generatedAt,
      authorName: null,
      verificationStatus: null,
      expirationDate: null,
      notes: null,
      verificationCode: g.verificationCode,
    }));
    return [...uploaded, ...generated]
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  });

  // ── Lifecycle transition modal ─────────────────────────────────────────────
  readonly transitionTarget = signal<LifecycleStatus | null>(null);
  readonly transitionError  = signal<string | null>(null);
  transitionReason = '';

  // ── Contract lifecycle ─────────────────────────────────────────────────────
  readonly lcContracts = signal<ContractListDto[]>([]);
  readonly lcHistory   = signal<ContractTransitionHistoryDto[]>([]);
  /** The dossier log (historique_contrat), rendered as cards by rh-lifecycle-section. */
  readonly lcContractLog = signal<ContractHistoryDto[]>([]);
  readonly lcLoading   = signal(false);
  readonly lcSaving    = signal(false);
  readonly lcError     = signal<string | null>(null);
  readonly showNewContractModal = signal(false);
  private lcLoaded = false;

  // ── IT equipment ledger (V76) ──────────────────────────────────────────────
  readonly itAssets       = signal<ItAssetAssignmentDto[]>([]);
  readonly assetsLoading  = signal(false);
  readonly assetsSyncing  = signal(false);
  readonly assetTypes     = signal<RefDataItem[]>([]);
  /** Both the 'Affecter' and the 'Corriger' modal — 'editingAsset' tells them apart. */
  readonly showAssetForm  = signal(false);
  readonly editingAsset   = signal<ItAssetAssignmentDto | null>(null);
  readonly returningAsset = signal<ItAssetAssignmentDto | null>(null);
  private assetsLoaded = false;

  /** Still held, i.e. no return date — the same rule the backend puts in 'isCurrent'. */
  readonly currentAssetCount = computed(() => this.itAssets().filter(a => a.isCurrent).length);

  /**
   * What ItAssetAssignmentController accepts for WRITE. IT_PROVISIONING is in there because
   * handing hardware over is the IT team's job whether it happens on hire day or two years
   * in; the tab itself is readable by anyone who can open the dossier.
   */
  readonly canManageAssets = computed(() =>
    this.userStore.hasPermission('RH_MANAGE_IT_ASSETS')
    || this.userStore.hasPermission('IT_PROVISIONING')
    || this.userStore.isAdmin(),
  );

  private selectedContractId: number | null = null;
  trialApproved = true;
  trialComment  = '';
  renewDateFin  = '';
  renewComment  = '';
  cdiStartDate  = '';
  cdiComment    = '';

  // ── Modal bodies, opened imperatively via ModalService ─────────────────────
  transitionTpl    = viewChild<TemplateRef<unknown>>('transitionTpl');
  offboardingTpl   = viewChild<TemplateRef<unknown>>('offboardingTpl');
  validateTrialTpl = viewChild<TemplateRef<unknown>>('validateTrialTpl');
  renewCDDTpl      = viewChild<TemplateRef<unknown>>('renewCDDTpl');
  convertCDITpl    = viewChild<TemplateRef<unknown>>('convertCDITpl');

  constructor() {
    // Contracts are fetched the first time their tab is opened, not on page load.
    effect(() => {
      if (this.activeTab() === 'historique') this.loadContracts();
      // Same deal for the equipment ledger: two extra requests nobody asked for on a page
      // whose default tab is Emploi.
      if (this.activeTab() === 'materiel') this.loadItAssets();
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  private openInEditMode = false;

  ngOnInit(): void {
    this.profileId = Number(this.route.snapshot.paramMap.get('id'));
    const qp = this.route.snapshot.queryParamMap;
    this.openInEditMode = qp.get('edit') === 'true';
    const tab = qp.get('tab') as TabId | null;
    if (tab) this.activeTab.set(tab); // daf-tabs falls back to the first tab if it isn't one

    // The documents call feeds both the drawer and the identity strip's n/3
    // tile, so it runs up front rather than on drawer open.
    forkJoin({
      profile: this.svc.getById(this.profileId).pipe(catchError(() => of(null))),
      docs:    this.svc.listDocuments(this.profileId).pipe(catchError(() => of([] as EmployeeDocument[]))),
    }).subscribe(({ profile, docs }) => {
      this.documents.set(docs);
      this.docsLoading.set(false);
      this.profile.set(profile);
      this.loadFailed.set(!profile);
      this.firstLoad.set(false);

      if (profile) {
        this.loadResolvedRegime(profile.id);
        this.pdfSvc.generateDocument('/api/hr/documents/by-profile/' + profile.id, null)
          .subscribe({ next: (d: any) => this.generatedDocs.set(d), error: () => {} });
        if (this.openInEditMode) {
          this.openInEditMode = false;
          this.startEdit();
        }
      }
    });
  }

  private reloadDocuments(): void {
    this.svc.listDocuments(this.profileId)
      .pipe(catchError(() => of([] as EmployeeDocument[])))
      .subscribe(docs => this.documents.set(docs));
  }

  // ── Errors ─────────────────────────────────────────────────────────────────
  /**
   * Backend errors are Spring ProblemDetail bodies — the message is under
   * `detail` (and, for validation failures, a per-field `errors` map), never
   * `message`.
   */
  private extractErrorMessage(err: unknown, fallback: string): string {
    const body = (err as { error?: { detail?: string; errors?: Record<string, string> } })?.error;
    if (body?.errors && typeof body.errors === 'object') {
      const messages = Object.values(body.errors).filter((v): v is string => typeof v === 'string');
      if (messages.length) return messages.join(' ');
    }
    return body?.detail ?? fallback;
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  toggleEdit(): void {
    if (this.editMode()) {
      this.editMode.set(false);
      this.editSaveError.set(null);
    } else {
      this.startEdit();
    }
  }

  startEdit(): void {
    const p = this.profile();
    if (!p) return;
    this.editForm.set({
      reason: '',
      dateOfBirth: p.dateOfBirth ?? '', gender: p.gender ?? '',
      nationalityId: p.nationalityId ?? null, nationalId: p.nationalId ?? '',
      passportNumber: p.passportNumber ?? '', maritalStatus: p.maritalStatus ?? '',
      numberOfChildren: p.numberOfChildren ?? null,
      hireDate: p.hireDate ?? '', contractType: p.contractType ?? '',
      contractEndDate: p.contractEndDate ?? '', probationEndDate: p.probationEndDate ?? '',
      isOnProbation: p.isOnProbation ?? false,
      departmentId: p.departmentId ?? null, gradeId: p.gradeId ?? null,
      disciplineId: p.disciplineId ?? null, nogLevelId: p.nogLevelId ?? null,
      personalEmail: p.personalEmail ?? '', phone: p.phone ?? '', personalAddress: p.personalAddress ?? '',
      emergencyContactName: p.emergencyContactName ?? '',
      emergencyContactRelation: p.emergencyContactRelation ?? '',
      emergencyContactPhone: p.emergencyContactPhone ?? '',
      bankId: p.bankId ?? null, iban: p.iban ?? '', bankAccountNumber: p.bankAccountNumber ?? '',
      rib: p.rib ?? '', socialSecurityNumber: p.socialSecurityNumber ?? '', taxId: p.taxId ?? '',
      cnssNumber: p.cnssNumber ?? '', cnssAffiliationDate: p.cnssAffiliationDate ?? '',
      salaireNetCandidat: p.salaireNetCandidat ?? null, salaireNetRh: p.salaireNetRh ?? null,
    });
    this.editMode.set(true);
    this.editSaveError.set(null);

    const paysId = p.paysId;
    this.refSvc.getGrades(paysId).subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines(paysId).subscribe(r => this.disciplines.set(r));
    this.refSvc.getNogLevels(paysId).subscribe(r => this.nogLevels.set(r));
    this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));
    this.refSvc.getBanks(paysId).subscribe(r => this.banks.set(r));
    this.refSvc.getNationalities().subscribe(r => this.nationalities.set(r));
  }

  saveProfile(): void {
    const form = this.editForm();
    if (!form.reason?.trim()) {
      this.editSaveError.set(this.translate.instant('PROFILES.EDIT.ERR_REASON_REQUIRED'));
      return;
    }
    this.saving.set(true);
    this.editSaveError.set(null);

    // Empty strings mean "not provided", not "clear it" — the backend treats
    // undefined as no-change.
    const dto: ProfileUpdateDto = { ...form };
    Object.keys(dto).forEach(k => {
      if (k !== 'reason' && (dto as any)[k] === '') (dto as any)[k] = undefined;
    });

    this.svc.update(this.profileId, dto)
      .pipe(catchError(err => {
        this.saving.set(false);
        const message = this.extractErrorMessage(err, this.translate.instant('PROFILES.EDIT.ERR_SAVE'));
        // Both surfaces on purpose: the toast is what the user notices, the
        // inline error stays next to the field they have to fix.
        this.editSaveError.set(message);
        this.notify.error(message, this.translate.instant('PROFILES.EDIT.SAVE_ERROR_TITLE'));
        return of(null);
      }))
      .subscribe(updated => {
        if (updated) {
          this.profile.set(updated);
          this.editMode.set(false);
          this.saving.set(false);
          this.editSaveError.set(null);
          this.notify.success(this.translate.instant('PROFILES.EDIT.SAVE_SUCCESS'));
        }
      });
  }

  // ── Lifecycle transition ───────────────────────────────────────────────────
  openTransitionModal(): void {
    this.transitionTarget.set(null);
    this.transitionReason = '';
    this.transitionError.set(null);
    const tpl = this.transitionTpl();
    if (!tpl) return;
    this.modalService.open({
      title: this.translate.instant('PROFILES.TRANSITION.MODAL_TITLE'),
      body: tpl,
      buttons: [
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'),  variant: 'secondary', action: ref => ref.close() },
        { label: this.translate.instant('PROFILES.COMMON.CONFIRM'), variant: 'primary',   action: ref => this.confirmTransition(ref) },
      ],
    });
  }

  confirmTransition(ref: ModalRef): void {
    const target = this.transitionTarget();
    if (!target || !this.transitionReason.trim()) {
      this.transitionError.set(this.translate.instant('PROFILES.TRANSITION.ERR_SELECT'));
      return;
    }
    if (this.saving()) return;
    this.transitionError.set(null);
    this.saving.set(true);
    this.svc.transition(this.profileId, { newStatus: target, reason: this.transitionReason })
      .pipe(catchError(err => {
        this.saving.set(false);
        this.transitionError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.TRANSITION.ERR_CHANGE')));
        return of(null);
      }))
      .subscribe(updated => {
        if (updated) {
          this.saving.set(false);
          this.profile.set(updated);
          ref.close();
          this.notify.success(this.translate.instant('PROFILES.TRANSITION.SUCCESS', {
            status: this.lifecycleLabel(updated.lifecycleStatus),
          }));
        }
      });
  }

  onTransitionReason(v: string | number | null): void {
    this.transitionReason = v == null ? '' : String(v);
  }

  // ── Start an offboarding ───────────────────────────────────────────────────
  readonly offboardingReasons = OFFERED_DEPARTURE_REASONS;
  readonly offboardingReason  = signal<DepartureReason | null>(null);
  readonly offboardingError   = signal<string | null>(null);
  readonly startingOffboarding = signal(false);

  offboardingReasonLabel(r: DepartureReason): string {
    return this.translate.instant('OFFBOARDING.REASON.' + r);
  }

  openOffboardingModal(): void {
    // Pre-selected when there is only one type on offer, so the single-option case is
    // one click rather than two — but still visible, so the type is never implicit.
    this.offboardingReason.set(
      this.offboardingReasons.length === 1 ? this.offboardingReasons[0] : null,
    );
    this.offboardingError.set(null);
    const tpl = this.offboardingTpl();
    if (!tpl) return;
    this.modalService.open({
      title: this.translate.instant('PROFILES.OFFBOARDING.MODAL_TITLE'),
      body: tpl,
      buttons: [
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'), variant: 'secondary', action: ref => ref.close() },
        {
          label: this.translate.instant('PROFILES.OFFBOARDING.CONFIRM'),
          variant: 'primary',
          action: ref => this.confirmStartOffboarding(ref),
        },
      ],
    });
  }

  /**
   * Sends the type and nothing else. `triggerDate` is still required by the API (and is
   * `NOT NULL` in the schema), so it is stamped with today — which is factually the date
   * the departure was declared. `lastWorkingDay` is deliberately left unset: that is the
   * negotiated date, it is what stage 1 is for, and leaving it null is exactly what puts
   * the new file in the Déclaration column (see `isDeclarationComplete`).
   */
  confirmStartOffboarding(ref: ModalRef): void {
    const reason = this.offboardingReason();
    if (!reason) {
      this.offboardingError.set(this.translate.instant('PROFILES.OFFBOARDING.ERR_SELECT'));
      return;
    }
    if (this.startingOffboarding()) return;
    this.offboardingError.set(null);
    this.startingOffboarding.set(true);

    this.offboardingSvc.startOffboarding({
      employeeProfileId: this.profileId,
      departureReason:   reason,
      // `fromDate`, not `toISOString().slice(0,10)`: the latter is UTC, so before 01:00
      // in Tunis it would declare the departure as yesterday.
      triggerDate:       fromDate(new Date()),
    }).pipe(
      catchError(err => {
        this.startingOffboarding.set(false);
        this.offboardingError.set(
          this.extractErrorMessage(err, this.translate.instant('PROFILES.OFFBOARDING.ERR_START')),
        );
        return of(null);
      }),
    ).subscribe(created => {
      this.startingOffboarding.set(false);
      if (created) {
        ref.close();
        this.notify.success(this.translate.instant('PROFILES.OFFBOARDING.STARTED'));
        // Straight into the file: the declaration still has to be filled in, and the
        // profile page has nowhere to do that.
        this.router.navigate(['/rh/offboarding', created.id]);
      }
    });
  }

  // ── Uploads ────────────────────────────────────────────────────────────────
  /**
   * Actually uploads. This used to set a signal and re-read the list, so the drop zone
   * accepted a file, showed it, and sent nothing — the document never existed.
   */
  onDocumentFilesChange(files: UploadedFile[]): void {
    this.uploadFiles.set(files);
    const pending = files.map(f => f.file).filter((f): f is File => !!f);
    if (!pending.length) return;

    const type = this.uploadType();
    this.docUploading.set(true);
    // One POST per file, in parallel, each with its OWN catchError: a file the server
    // rejects (wrong MIME, over 10 MB) reports itself and resolves to null instead of
    // aborting the whole batch, so the others still land.
    forkJoin(pending.map(file => this.svc.uploadDocument(this.profileId, file, type).pipe(
      catchError(err => {
        this.notify.error(this.extractErrorMessage(
          err, this.translate.instant('PROFILES.DOCUMENTS.ERR_UPLOAD')));
        return of(null);
      }),
    ))).subscribe(results => {
      this.docUploading.set(false);
      this.uploadFiles.set([]);
      const ok = results.filter(r => r !== null).length;
      if (ok) {
        this.notify.success(this.translate.instant('PROFILES.DOCUMENTS.UPLOADED', { count: ok }));
      }
      this.reloadDocuments();
    });
  }

  /**
   * Opens a document in a new tab.
   *
   * Both sources are fetched as blobs and handed to the browser through an object URL:
   * `fileUrl` is a server-side path, and the endpoints need the Authorization header that a
   * plain <a href> would not send.
   */
  openDocument(row: ProfileDocumentRow): void {
    const call$ = row.source === 'GENERATED'
      ? this.pdfSvc.downloadBlobById(row.id)
      : this.svc.downloadDocument(this.profileId, row.id);
    call$.subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Revoked late: revoking immediately can race the new tab's own load.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: err => this.notify.error(this.extractErrorMessage(
        err, this.translate.instant('PROFILES.DOCUMENTS.ERR_OPEN'))),
    });
  }

  verifyDocument(event: { doc: ProfileDocumentRow; status: 'VERIFIED' | 'REJECTED' }): void {
    this.svc.verifyDocument(this.profileId, event.doc.id, event.status).subscribe({
      next: () => {
        this.reloadDocuments();
        this.notify.success(this.translate.instant(
          event.status === 'VERIFIED'
            ? 'PROFILES.DOCUMENTS.VERIFIED_OK'
            : 'PROFILES.DOCUMENTS.REJECTED_OK'));
      },
      error: err => this.notify.error(this.extractErrorMessage(
        err, this.translate.instant('PROFILES.DOCUMENTS.ERR_VERIFY'))),
    });
  }

  /**
   * Soft delete — the row and the file both survive, so the dossier can still show that the
   * piece was filed and withdrawn. Confirmed first: it disappears from the tab.
   */
  async removeDocument(row: ProfileDocumentRow): Promise<void> {
    if (!(await this.confirm.ask({
      title:   this.translate.instant('PROFILES.DOCUMENTS.DELETE_CONFIRM_TITLE'),
      message: this.translate.instant('PROFILES.DOCUMENTS.DELETE_CONFIRM_MESSAGE',
                                      { name: row.fileName ?? row.documentType }),
      confirmLabel: this.translate.instant('PROFILES.COMMON.DELETE'), icon: 'delete',
    }))) return;

    this.svc.deleteDocument(this.profileId, row.id).subscribe({
      next: () => {
        this.reloadDocuments();
        this.notify.success(this.translate.instant('PROFILES.DOCUMENTS.DELETED_OK'));
      },
      error: err => this.notify.error(this.extractErrorMessage(
        err, this.translate.instant('PROFILES.DOCUMENTS.ERR_DELETE'))),
    });
  }

  readonly editingDocument = signal<EmployeeDocument | null>(null);

  /** The section hands back a merged row; the form needs the uploaded document itself. */
  openEditDocument(row: ProfileDocumentRow): void {
    const doc = this.documents().find(d => d.id === row.id);
    if (doc) this.editingDocument.set(doc);
  }

  onDocumentUpdated(): void {
    this.editingDocument.set(null);
    this.reloadDocuments();
    this.notify.success(this.translate.instant('PROFILES.DOCUMENTS.SAVED_OK'));
  }

  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    // Upload problems are toasts now, not an inline red box under the avatar —
    // a *missing* photo is never an error, it just falls back to the avatar.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.notify.error(this.translate.instant('PROFILES.PHOTO.ERR_FORMAT'));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.notify.error(this.translate.instant('PROFILES.PHOTO.ERR_SIZE'));
      return;
    }
    this.photoUploading.set(true);
    this.svc.uploadPhoto(this.profileId, file).subscribe({
      next: updated => {
        this.profile.set(updated);
        this.photoUploading.set(false);
        this.notify.success(this.translate.instant('PROFILES.PHOTO.UPLOAD_SUCCESS'));
      },
      error: err => {
        this.photoUploading.set(false);
        this.notify.error(this.extractErrorMessage(err, this.translate.instant('PROFILES.PHOTO.ERR_UPLOAD')));
      },
    });
  }

  // ── Régime ─────────────────────────────────────────────────────────────────
  private loadResolvedRegime(profileId: number): void {
    this.regimeLoading.set(true);
    this.regimeSvc.resolveForEmployee(profileId).subscribe({
      next: r  => { this.resolvedRegime.set(r); this.regimeLoading.set(false); },
      error: () => this.regimeLoading.set(false),
    });
  }

  async removeEmployeeRegimeOverride(): Promise<void> {
    const p = this.profile();
    if (!p) return;
    if (!(await this.confirm.ask({
      title:   this.translate.instant('PROFILES.REGIME_OVERRIDE.CONFIRM_TITLE'),
      message: this.translate.instant('PROFILES.REGIME_OVERRIDE.CONFIRM_MESSAGE'),
      confirmLabel: this.translate.instant('PROFILES.COMMON.DELETE'), icon: 'delete',
    }))) return;
    this.regimeSvc.removeEmployeeOverride(p.id).subscribe({
      next:  () => this.loadResolvedRegime(p.id),
      error: () => {},
    });
  }

  // ── Contract lifecycle ─────────────────────────────────────────────────────
  loadContracts(): void {
    if (this.lcLoaded) return;
    this.lcLoaded = true;
    this.lcLoading.set(true);
    this.lcSvc.getContracts(this.profileId).pipe(catchError(() => of([])))
      .subscribe(cs => { this.lcContracts.set(cs); this.lcLoading.set(false); });
    this.lcSvc.getLifecycleHistory(this.profileId).pipe(catchError(() => of([])))
      .subscribe(h => this.lcHistory.set(h));
    // The dossier log used to be fetched by app-contract-history itself. That component is
    // gone from this tab, so the page owns the read and passes it down — which is also what
    // lets one refresh after a contract is created cover both lists.
    this.contractHistorySvc.getHistory(this.profileId).pipe(catchError(() => of([])))
      .subscribe(l => this.lcContractLog.set(l));
  }

  private refreshContracts(): void {
    this.lcLoaded = false;
    this.loadContracts();
  }

  // ── IT equipment ledger ────────────────────────────────────────────────────
  loadItAssets(force = false): void {
    if (this.assetsLoaded && !force) return;
    this.assetsLoaded = true;
    this.assetsLoading.set(true);
    this.assetSvc.getHistory(this.profileId).subscribe(rows => {
      this.itAssets.set(rows);
      this.assetsLoading.set(false);
    });
    // Needed by the assign form's type picker; cached by RefDataService, so asking again
    // on a later open costs nothing.
    if (!this.assetTypes().length) {
      this.refSvc.getItAssetTypes().subscribe(types => this.assetTypes.set(types));
    }
  }

  openAssignAsset(): void {
    this.editingAsset.set(null);
    this.showAssetForm.set(true);
  }

  openEditAsset(asset: ItAssetAssignmentDto): void {
    this.editingAsset.set(asset);
    this.showAssetForm.set(true);
  }

  closeAssetForm(): void {
    this.showAssetForm.set(false);
    this.editingAsset.set(null);
  }

  onAssetSaved(): void {
    const wasEdit = this.editingAsset() !== null;
    this.closeAssetForm();
    // Re-read rather than splice the returned row in: the tab shows two derived lists and a
    // count, and the server is the one that decides which side a row lands on.
    this.loadItAssets(true);
    this.notify.success(this.translate.instant(
      wasEdit ? 'PROFILES.IT_ASSETS.SAVED' : 'PROFILES.IT_ASSETS.ASSIGNED'));
  }

  openReturnAsset(asset: ItAssetAssignmentDto): void {
    this.returningAsset.set(asset);
  }

  onAssetReturned(): void {
    this.returningAsset.set(null);
    this.loadItAssets(true);
    this.notify.success(this.translate.instant('PROFILES.IT_ASSETS.RETURNED_OK'));
  }

  /**
   * Pulls anything marked 'fourni' on the IT provisioning dossier that is not in the ledger
   * yet. Idempotent server-side, so the button is safe to press twice; an empty result means
   * the ledger is already up to date, which is worth saying rather than looking like a no-op.
   */
  syncItAssets(): void {
    if (this.assetsSyncing()) return;
    this.assetsSyncing.set(true);
    this.assetSvc.syncFromProvisioning(this.profileId).subscribe({
      next: (added) => {
        this.assetsSyncing.set(false);
        this.loadItAssets(true);
        this.notify.success(this.translate.instant(
          added.length ? 'PROFILES.IT_ASSETS.SYNC_ADDED' : 'PROFILES.IT_ASSETS.SYNC_NONE',
          { count: added.length }));
      },
      error: (err) => {
        this.assetsSyncing.set(false);
        this.notify.error(err?.error?.message
          ?? this.translate.instant('PROFILES.IT_ASSETS.SYNC_ERROR'));
      },
    });
  }

  onContractCreated(_contract: ContractDetailDto): void {
    this.showNewContractModal.set(false);
    // One refresh covers both lists now: refreshContracts re-reads the contracts, the
    // lifecycle timeline AND the dossier log, all of which that single submit wrote to.
    this.refreshContracts();
  }

  openValidateTrialModal(contractId: number): void {
    this.selectedContractId = contractId;
    this.trialApproved = true;
    this.trialComment = '';
    this.lcError.set(null);
    const tpl = this.validateTrialTpl();
    if (!tpl) return;
    this.modalService.open({
      title: this.translate.instant('PROFILES.TRIAL.MODAL_TITLE'),
      body: tpl,
      buttons: [
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'),  variant: 'secondary', action: ref => ref.close() },
        { label: this.translate.instant('PROFILES.COMMON.CONFIRM'), variant: 'primary',   action: ref => this.confirmValidateTrial(ref) },
      ],
    });
  }

  confirmValidateTrial(ref: ModalRef): void {
    if (this.selectedContractId === null || this.lcSaving()) return;
    this.lcSaving.set(true);
    this.lcSvc.validateTrial(this.selectedContractId, {
      approved: this.trialApproved, commentaire: this.trialComment || null,
    }).pipe(catchError(err => {
      this.lcError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.COMMON.GENERIC_ERROR')));
      this.lcSaving.set(false);
      return of(null);
    })).subscribe(r => {
      if (r) { this.lcSaving.set(false); this.refreshContracts(); ref.close(); }
    });
  }

  openRenewCDDModal(contractId: number): void {
    this.selectedContractId = contractId;
    this.renewDateFin = '';
    this.renewComment = '';
    this.lcError.set(null);
    const tpl = this.renewCDDTpl();
    if (!tpl) return;
    this.modalService.open({
      title: this.translate.instant('PROFILES.RENEW.MODAL_TITLE'),
      body: tpl,
      buttons: [
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'), variant: 'secondary', action: ref => ref.close() },
        { label: this.translate.instant('PROFILES.RENEW.CONFIRM'), variant: 'primary',   action: ref => this.confirmRenewCDD(ref) },
      ],
    });
  }

  confirmRenewCDD(ref: ModalRef): void {
    if (this.selectedContractId === null || !this.renewDateFin) {
      this.lcError.set(this.translate.instant('PROFILES.RENEW.ERR_DATE'));
      return;
    }
    if (this.lcSaving()) return;
    this.lcSaving.set(true);
    this.lcSvc.renewCDD(this.selectedContractId, {
      newDateFin: this.renewDateFin, commentaire: this.renewComment || null,
    }).pipe(catchError(err => {
      this.lcError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.COMMON.GENERIC_ERROR')));
      this.lcSaving.set(false);
      return of(null);
    })).subscribe(r => {
      if (r) { this.lcSaving.set(false); this.refreshContracts(); ref.close(); }
    });
  }

  openConvertCDIModal(contractId: number): void {
    this.selectedContractId = contractId;
    this.cdiStartDate = '';
    this.cdiComment = '';
    this.lcError.set(null);
    const tpl = this.convertCDITpl();
    if (!tpl) return;
    this.modalService.open({
      title: this.translate.instant('PROFILES.CONVERT.MODAL_TITLE'),
      body: tpl,
      buttons: [
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'),   variant: 'secondary', action: ref => ref.close() },
        { label: this.translate.instant('PROFILES.CONVERT.CONFIRM'), variant: 'primary',   action: ref => this.confirmConvertCDI(ref) },
      ],
    });
  }

  confirmConvertCDI(ref: ModalRef): void {
    if (this.selectedContractId === null || !this.cdiStartDate) {
      this.lcError.set(this.translate.instant('PROFILES.CONVERT.ERR_DATE'));
      return;
    }
    if (this.lcSaving()) return;
    this.lcSaving.set(true);
    this.lcSvc.convertToCDI(this.selectedContractId, {
      cdiStartDate: this.cdiStartDate, commentaire: this.cdiComment || null,
    }).pipe(catchError(err => {
      this.lcError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.COMMON.GENERIC_ERROR')));
      this.lcSaving.set(false);
      return of(null);
    })).subscribe(r => {
      if (r) { this.lcSaving.set(false); this.refreshContracts(); ref.close(); }
    });
  }

  // ── Modal-body field bridges ───────────────────────────────────────────────
  onTrialComment(v: string | number | null): void { this.trialComment = v == null ? '' : String(v); }
  onRenewComment(v: string | number | null): void { this.renewComment = v == null ? '' : String(v); }
  onCdiComment(v: string | number | null): void   { this.cdiComment   = v == null ? '' : String(v); }
}

/** `''`, `null` and `undefined` all mean "no value" when diffing form vs profile. */
function normalise(v: unknown): unknown {
  return v === '' || v === undefined ? null : v;
}
