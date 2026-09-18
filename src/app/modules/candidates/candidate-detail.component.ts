import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import {
  BreadcrumbItem,
  ButtonComponent,
  PageComponent,
  PageHeaderBadge,
  PageHeaderComponent,
  SelectOption,
  TabItem,
  TabsComponent,
  tabParam,
} from '@khalilrebhiitec/daf360';

import { UserStore } from '../../core/user.store';
import { NotificationService } from '../../core/notification.service';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem } from '../../core/ref/ref-data.model';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue } from '../../core/lists/configurable-list.model';
import { RecruitmentDemandService } from '../recruitment-demands/recruitment-demand.service';
import { ApprovedDemandOption } from '../recruitment-demands/recruitment-demand.model';
import { statusBadge } from '../../shared/status-badge.utils';
import { GENDER_OPTIONS } from '../../shared/utils/gender.utils';
import { CandidateService } from './candidate.service';
import {
  CandidateDetail, CandidateHistoryItem, HireCandidateRequest, UpdateCandidateRequest,
} from './candidate.model';
import { CandidateInterviewsComponent } from './candidate-interviews.component';
import { CandidateCostSimulationComponent } from './candidate-cost-simulation.component';
import { OfferSectionComponent } from './offer-section.component';
import { RejectModalComponent } from './reject-modal.component';
import { CandidateIdentityCardComponent, CandidatePill } from './detail-sections/candidate-identity-card.component';
import { CandidatePipelineCardComponent } from './detail-sections/candidate-pipeline-card.component';
import { CandidateProfileSectionComponent } from './detail-sections/candidate-profile-section.component';
import { CandidateSalarySectionComponent } from './detail-sections/candidate-salary-section.component';
import { CandidateCvSectionComponent } from './detail-sections/candidate-cv-section.component';
import { CandidateItSectionComponent } from './detail-sections/candidate-it-section.component';
import { CandidateHireModalComponent } from './detail-sections/candidate-hire-modal.component';

const HIREABLE_STATUSES = ['ACCEPTED', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS'];
/** Contract codes the backend requires an end date for (also enforced server-side). */
const NEEDS_END_DATE = ['CDD', 'CIVP', 'STAGE', 'DETACHEMENT'];

const CV_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const CV_MAX_BYTES = 10 * 1024 * 1024;

type TabId = 'profil' | 'salaire' | 'entretiens' | 'offre' | 'cv' | 'it';

/**
 * Which `UpdateCandidateRequest` keys belong to which tab. Drives the per-tab
 * dirty marker: with one tab on screen at a time, a pending change on a tab you
 * have navigated away from is otherwise invisible until you save.
 *
 * Only 'profil' has an entry. The identity card is never hidden, so it needs no
 * marker, and Rémunération keeps its own Save button (a separate, narrower call
 * that predates this edit mode) — its two fields are deliberately NOT part of the
 * global form, or the two savers would fight over the same record.
 */
const TAB_FIELDS: Partial<Record<TabId, (keyof UpdateCandidateRequest)[]>> = {
  profil: ['appliedPosition', 'employmentTypeId', 'recruitmentDemandId',
           'departmentId', 'appliedGradeId', 'appliedDisciplineId',
           'experienceYears', 'expectedStartDate', 'notes'],
};

/**
 * /rh/candidates/:id — the candidate record, laid out like `/rh/profiles/:id`
 * (UI-PLAYBOOK §1 + §10f): `daf-page` (`kpis="0"`, `breadcrumbs`) +
 * `daf-page-header`, then a **sticky left identity column** and a right column
 * holding the recruitment rail and `daf-tabs`, one tab per section of the record.
 *
 * The rail follows `/rh/offboarding/:id`'s treatment — a full-width card above the
 * tabs with progress and the next step — rather than the vertical strip it was in
 * the 32%-wide left column, where none of that fitted.
 *
 * Replaces a full-bleed teal hero header, a hand-rolled `h1`, a 12-column grid of
 * eight `bg-white rounded-xl border` cards and a full-page spinner. Every
 * behaviour is unchanged — accept / reject, hire, salary edit, CV upload, offer
 * and interview panels, IT provisioning, and all four permission gates.
 *
 * The page owns every piece of state; the sections are stateless input/output
 * shells, which is why the tab strip can be `daf-tabs` (strip only) with our own
 * panel: the offer and interview panels keep their own fetching.
 */
@Component({
  selector: 'app-candidate-detail',
  standalone: true,
  imports: [
    ButtonComponent,
    PageComponent,
    PageHeaderComponent,
    TabsComponent,
    CandidateIdentityCardComponent,
    CandidatePipelineCardComponent,
    CandidateProfileSectionComponent,
    CandidateSalarySectionComponent,
    CandidateCvSectionComponent,
    CandidateItSectionComponent,
    CandidateHireModalComponent,
    CandidateInterviewsComponent,
    CandidateCostSimulationComponent,
    OfferSectionComponent,
    RejectModalComponent,
    TranslatePipe,
  ],
  templateUrl: './candidate-detail.component.html',
})
export class CandidateDetailComponent implements OnInit {
  private readonly candidateService = inject(CandidateService);
  private readonly route     = inject(ActivatedRoute);
  private readonly router    = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly refSvc    = inject(RefDataService);
  private readonly listSvc   = inject(ConfigurableListService);
  private readonly demandSvc = inject(RecruitmentDemandService);
  private readonly notify    = inject(NotificationService);
  readonly userStore = inject(UserStore);

  private candidateId = 0;

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly candidate = signal<CandidateDetail | null>(null);
  /**
   * The audit trail, read for ONE thing: the date each pipeline step was reached, so the
   * rail says when as well as where. `getHistory` swallows its own errors and returns [],
   * and the rail degrades to undated steps — it must never block the page.
   */
  readonly history   = signal<CandidateHistoryItem[]>([]);
  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad = signal(true);
  readonly error     = signal<string | null>(null);

  // ── Edit state ─────────────────────────────────────────────────────────────
  // Declared up here, above the tab strip, because `tabs()` reads them through
  // `dirtyTabs()` — see the Edit section below for the rest of the machinery.
  readonly editMode      = signal(false);
  readonly editForm      = signal<UpdateCandidateRequest>({});
  readonly editSaveError = signal<string | null>(null);
  readonly saving        = signal(false);

  // ── Permissions ────────────────────────────────────────────────────────────
  readonly canAcceptReject = computed(() => this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'));
  readonly canHire         = computed(() => this.userStore.hasPermission('RH_HIRE_CANDIDATE'));
  readonly canManageIt     = computed(() => this.userStore.hasPermission('IT_PROVISIONING'));
  readonly canOnboard      = computed(() => this.userStore.hasPermission('HR_ONBOARDING'));

  /**
   * Exactly what `PUT /api/hr/candidates/{id}` enforces, not a looser page-level
   * rule: an edit button that leads to a 403 is worse than no button.
   *
   * A HIRED candidate is excluded. At that point the record has been copied into
   * an employee profile, and the dossier that matters is `/rh/profiles/:id` —
   * editing the candidature here would silently diverge from it.
   */
  readonly canEdit = computed(() =>
    this.candidate()?.status !== 'HIRED' && this.userStore.hasPermission('HR_ONBOARDING'),
  );

  /** Salary + cost simulation are budget data — RH hiring rights or admin. */
  readonly canViewSalary = computed(() => this.canHire() || this.userStore.isAdmin());

  readonly canHireThisCandidate = computed(() => {
    const c = this.candidate();
    return c !== null && HIREABLE_STATUSES.includes(c.status) && this.canHire();
  });

  /** Human contract-type label from the backend (resolved EMPLOYMENT_TYPE list value). */
  readonly contractTypeLabel = computed(() => this.candidate()?.employmentTypeLabel ?? null);

  /** Whether the hire form must ask for an end date (backend enforces this too). */
  readonly requiresEndDate = computed(() => {
    const label = (this.candidate()?.employmentTypeLabel ?? '').toUpperCase();
    return NEEDS_END_DATE.some(code => label.includes(code));
  });

  // ── Which sections apply to this candidate ─────────────────────────────────
  readonly showItSection = computed(() => {
    const c = this.candidate();
    return c !== null && !['PENDING', 'REJECTED'].includes(c.status);
  });

  readonly showInterviewsSection = computed(() => {
    const c = this.candidate();
    return c !== null && !['REJECTED', 'ARCHIVED'].includes(c.status);
  });

  /** Offer/negotiation: relevant from acceptance onward (and to show a refused offer). */
  readonly showOfferSection = computed(() => {
    const c = this.candidate();
    return c !== null && !['PENDING', 'ARCHIVED'].includes(c.status);
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.translate.currentLang();
    const c = this.candidate();
    return [
      { label: this.translate.instant('CANDIDATES.DETAIL.BREADCRUMB'), link: '/rh/candidates' },
      { label: c ? `${c.firstName} ${c.lastName}` : `#${this.candidateId}` },
    ];
  });

  readonly headerTitle = computed(() => {
    const c = this.candidate();
    return c ? `${c.firstName} ${c.lastName}` : `#${this.candidateId}`;
  });

  /** Poste · département — the contract type is a badge, as on the profile page. */
  readonly headerSubtitle = computed(() => {
    const c = this.candidate();
    if (!c) return '';
    return [c.appliedPosition, c.department].filter(Boolean).join(' · ');
  });

  readonly headerBadges = computed<PageHeaderBadge[]>(() => {
    this.translate.currentLang();
    const c = this.candidate();
    if (!c) return [];
    const badges: PageHeaderBadge[] = [{
      label:   this.translate.instant('CANDIDATES.STATUS.' + c.status),
      variant: statusBadge(c.status).options.variant,
      size:    'sm',
    }];
    if (c.employmentTypeLabel) {
      badges.push({ label: c.employmentTypeLabel, variant: 'neutral', size: 'sm' });
    }
    if (c.appliedGrade) {
      badges.push({ label: c.appliedGrade, variant: 'secondary', size: 'sm', icon: 'badge' });
    }
    return badges;
  });

  /** Status + contract type, the pills under the name in the identity card. */
  readonly identityPills = computed<CandidatePill[]>(() => {
    this.translate.currentLang();
    const c = this.candidate();
    if (!c) return [];
    const pills: CandidatePill[] = [{
      label:   this.translate.instant('CANDIDATES.STATUS.' + c.status),
      variant: statusBadge(c.status).options.variant ?? 'neutral',
    }];
    if (c.employmentTypeLabel) pills.push({ label: c.employmentTypeLabel, variant: 'secondary' });
    if (c.appliedDiscipline)   pills.push({ label: c.appliedDiscipline,   variant: 'neutral'   });
    return pills;
  });

  // ── Tabs ───────────────────────────────────────────────────────────────────
  /**
   * Adossé au paramètre d'URL : survit au rechargement, au signet, au lien partagé et au
   * bouton précédent.
   *
   * La liste d'ids est passée en SIGNAL, et c'est indispensable ici : les onglets sont
   * filtrés par permission et par statut du candidat (voir `tabs` juste en dessous), donc
   * elle n'est pas connue à la construction et elle change ensuite. Un lien vers
   * `?tab=salaire` reçu par quelqu'un sans droit sur la rémunération retombe ainsi sur
   * « profil » au lieu de laisser le bandeau sans onglet sélectionné — ce que faisait la
   * restauration manuelle précédente, qui ne validait rien.
   *
   * Le `computed` est créé ici et non plus haut : son corps n'est évalué que
   * paresseusement, donc `this.tabs` est déjà défini quand il s'exécute.
   */
  readonly activeTab = tabParam<TabId>(
    computed(() => this.tabs().map(t => t.id as TabId)), 'profil');

  /**
   * Tabs are **filtered out**, never disabled: a greyed "Rémunération" tab still
   * advertises that budget data exists. Which is also why the set depends on the
   * candidate's status — an interview tab on a rejected candidate is noise.
   */
  readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const dirty = this.dirtyTabs();
    const items: TabItem[] = [
      { id: 'profil', label: t('CANDIDATES.DETAIL.TABS.PROFILE'), marker: dirty.has('profil') },
    ];
    if (this.canViewSalary())         items.push({ id: 'salaire',    label: t('CANDIDATES.DETAIL.TABS.SALARY')     });
    if (this.showInterviewsSection()) items.push({ id: 'entretiens', label: t('CANDIDATES.DETAIL.TABS.INTERVIEWS') });
    if (this.showOfferSection())      items.push({ id: 'offre',      label: t('CANDIDATES.DETAIL.TABS.OFFER')      });
    items.push({ id: 'cv', label: t('CANDIDATES.DETAIL.TABS.CV') });
    if (this.showItSection())         items.push({ id: 'it',         label: t('CANDIDATES.DETAIL.TABS.IT')         });
    return items;
  });

  /** Tabs whose fields differ from the loaded candidate. Empty outside edit mode. */
  private readonly dirtyTabs = computed<Set<TabId>>(() => {
    const out = new Set<TabId>();
    if (!this.editMode()) return out;
    const c = this.candidate();
    const f = this.editForm();
    if (!c) return out;
    // The DTO and the record share these names but not their types (and the DTO has
    // no index signature), so the candidate side is read through an indexable view.
    // `normalise` then treats '' / null / undefined alike: the form seeds '' where
    // the record holds null, and that is not a user edit.
    const fields = c as unknown as Record<string, unknown>;
    for (const [tab, keys] of Object.entries(TAB_FIELDS) as [TabId, (keyof UpdateCandidateRequest)[]][]) {
      if (keys.some(k => normalise(f[k]) !== normalise(fields[k]))) out.add(tab);
    }
    return out;
  });

  // ── Edit ───────────────────────────────────────────────────────────────────
  //
  // Global, not per-tab, and modelled on `/rh/profiles/:id`: the header/card
  // button flips the whole page and one sticky bar closes it. Because `editForm`
  // lives here, moving between tabs mid-edit keeps every pending change.
  //
  // One deliberate difference from the profile page: there is no audited `reason`
  // field. `UpdateCandidateRequest` has none server-side — the candidate audit log
  // records the actor and the diff by itself — so asking for one would be a
  // required field that goes nowhere.
  //
  // The four signals themselves are declared at the top of the class, next to the
  // loaded record: `tabs()` reads them to draw its dirty marker.

  /** Sections emit partials; the page is the only writer. */
  patch(part: Partial<UpdateCandidateRequest>): void {
    this.editForm.update(f => ({ ...f, ...part }));
  }

  toggleEdit(): void {
    if (this.editMode()) {
      this.editMode.set(false);
      this.editSaveError.set(null);
    } else {
      this.startEdit();
    }
  }

  startEdit(): void {
    const c = this.candidate();
    if (!c) return;
    // Salary is left out on purpose — the Rémunération tab saves it on its own.
    this.editForm.set({
      firstName: c.firstName ?? '', lastName: c.lastName ?? '',
      emailPersonal: c.emailPersonal ?? '', phone: c.phone ?? '',
      dateOfBirth: c.dateOfBirth ?? '', gender: c.gender ?? '',
      nationalityId: c.nationalityId ?? null, nationalId: c.nationalId ?? '',
      location: c.location ?? '',
      appliedPosition: c.appliedPosition ?? '',
      employmentTypeId: c.employmentTypeId ?? null,
      recruitmentDemandId: c.recruitmentDemandId ?? null,
      departmentId: c.departmentId ?? null,
      appliedGradeId: c.appliedGradeId ?? null,
      appliedDisciplineId: c.appliedDisciplineId ?? null,
      experienceYears: c.experienceYears ?? null,
      expectedStartDate: c.expectedStartDate ?? '',
      notes: c.notes ?? '',
    });
    this.editMode.set(true);
    this.editSaveError.set(null);

    // Scoped to the candidate's own entity, like the hire and contract forms:
    // grades and departments are per-pays, and the unscoped list would offer
    // another entity's structure. Nationalities are global.
    const paysId = c.paysId;
    this.refSvc.getGrades(paysId).subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines(paysId).subscribe(r => this.disciplines.set(r));
    this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));
    this.refSvc.getNationalities().subscribe(r => this.nationalities.set(r));
    // The same two lists the create wizard offers, and for contract types the exact
    // set the backend now validates against (active EMPLOYMENT_TYPE values of this pays).
    this.listSvc.getListValues('EMPLOYMENT_TYPE', paysId)
      .pipe(catchError(() => of([] as ListValue[])))
      .subscribe(v => this.employmentTypes.set(v));
    this.demandSvc.getApprovedOptions(paysId)
      .pipe(catchError(() => of([] as ApprovedDemandOption[])))
      .subscribe(d => this.demands.set(d));
  }

  saveCandidate(): void {
    if (this.saving()) return;
    const form = this.editForm();

    // Required by the backend's own column constraints — caught here so the user
    // is not sent round a 400 for a field they can see is blank.
    if (!form.firstName?.trim() || !form.lastName?.trim() || !form.emailPersonal?.trim()) {
      this.editSaveError.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.EDIT_REQUIRED'));
      return;
    }

    this.saving.set(true);
    this.editSaveError.set(null);

    // Empty strings mean "not provided", not "clear it": the backend maps with
    // NullValuePropertyMappingStrategy.IGNORE, so an absent key is a no-change.
    const dto: UpdateCandidateRequest = { ...form };
    Object.keys(dto).forEach(k => {
      if ((dto as Record<string, unknown>)[k] === '') (dto as Record<string, unknown>)[k] = undefined;
    });

    /*
     * The vacancy is the one key where presence itself is the instruction: the server
     * reads "key present, value null" as DETACH. So it is sent only when it actually
     * changed, and dropped otherwise.
     *
     * Dropping it is not an optimisation. `applyRecruitmentDemand` re-validates on every
     * write, and a demand that has since left APPROUVEE would make an unrelated edit —
     * fixing a phone number — fail on a field the user never touched.
     */
    if ((this.candidate()?.recruitmentDemandId ?? null) === (form.recruitmentDemandId ?? null)) {
      delete dto.recruitmentDemandId;
    } else {
      dto.recruitmentDemandId = form.recruitmentDemandId ?? null;
    }

    this.candidateService.update(this.candidateId, dto)
      .pipe(catchError(err => {
        this.saving.set(false);
        const message = this.extractErrorMessage(err, this.translate.instant('CANDIDATES.DETAIL_ERRORS.EDIT_SAVE'));
        // Both surfaces on purpose: the toast is what the user notices, the inline
        // error stays next to the button they pressed.
        this.editSaveError.set(message);
        this.notify.error(message);
        return of(null);
      }))
      .subscribe(updated => {
        if (!updated) return;
        this.candidate.set(updated);
        // The Rémunération tab holds its own copy of the two salary figures and is
        // not part of this form; re-seed it so the saved record and that tab agree.
        this.salaryNetRh.set(updated.salaireNetRh ?? null);
        this.salaryNetCandidat.set(updated.salaireNetCandidat ?? null);
        this.editMode.set(false);
        this.saving.set(false);
        this.editSaveError.set(null);
        this.notify.success(this.translate.instant('CANDIDATES.DETAIL.EDIT_SAVED'));
      });
  }

  /**
   * Backend errors are Spring ProblemDetail bodies — the message is under `detail`
   * (and, for validation failures, a per-field `errors` map), never `message`.
   */
  private extractErrorMessage(err: unknown, fallback: string): string {
    const body = (err as { error?: { detail?: string; message?: string; errors?: Record<string, string> } })?.error;
    if (body?.errors && typeof body.errors === 'object') {
      const messages = Object.values(body.errors).filter((v): v is string => typeof v === 'string');
      if (messages.length) return messages.join(' ');
    }
    return body?.detail ?? body?.message ?? fallback;
  }

  // ── Ref data for the edit dropdowns ────────────────────────────────────────
  private readonly grades        = signal<RefDataItem[]>([]);
  private readonly disciplines   = signal<RefDataItem[]>([]);
  private readonly departments   = signal<RefDataItem[]>([]);
  private readonly nationalities = signal<RefDataItem[]>([]);
  private readonly employmentTypes = signal<ListValue[]>([]);
  private readonly demands         = signal<ApprovedDemandOption[]>([]);

  private blankOption(): SelectOption {
    return { value: '', label: this.translate.instant('CANDIDATES.COMMON.SELECT_PLACEHOLDER') };
  }
  private refOptions(items: RefDataItem[]): SelectOption[] {
    return [this.blankOption(), ...items.map(i => ({ value: String(i.id), label: i.labelFr }))];
  }

  readonly nationalityOptions = computed(() => this.refOptions(this.nationalities()));
  readonly departmentOptions  = computed(() => this.refOptions(this.departments()));
  readonly gradeOptions       = computed(() => this.refOptions(this.grades()));
  readonly disciplineOptions  = computed(() => this.refOptions(this.disciplines()));

  /** Homme / Femme, the same canonical codes the create wizard offers. */
  readonly genderOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [this.blankOption(), ...GENDER_OPTIONS.map(o => ({ value: o.value, label: o.label }))];
  });

  /**
   * Contract types — no blank option, deliberately. There is no "no contract type":
   * downstream, an unset one silently resolves to CDI (ContractTypeBridge), so offering
   * an empty choice would be offering a hidden default.
   */
  readonly employmentTypeOptions = computed<SelectOption[]>(() =>
    this.employmentTypes().map(t => ({ value: String(t.id), label: t.labelFr || t.labelEn })),
  );

  /**
   * Approved vacancies, plus — when the candidate is attached to one that is no longer
   * approved — that one, kept at the top.
   *
   * Without the fallback the select would render blank for a candidature attached to a
   * since-closed demand, and the first edit of any other field would read as "you detached
   * this candidature" when the user never touched the field.
   */
  readonly demandOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    const c = this.candidate();
    const options = this.demands().map(d => ({
      value: String(d.id),
      label: d.department ? `${d.label} — ${d.department}` : d.label,
    }));
    const current = c?.recruitmentDemandId;
    if (current != null && !options.some(o => o.value === String(current))) {
      options.unshift({
        value: String(current),
        label: c?.recruitmentDemandJobTitle
          ?? this.translate.instant('CANDIDATES.DETAIL.VACANCY_NUM', { id: current }),
      });
    }
    // Blank IS meaningful here, unlike the contract type: it detaches a spontaneous
    // application from a vacancy it turned out not to match.
    return [
      { value: '', label: this.translate.instant('CANDIDATES.DETAIL.VACANCY_NONE') },
      ...options,
    ];
  });

  // ── Load ───────────────────────────────────────────────────────────────────
  /** `?edit=true` — "open this dossier for editing", as on `/rh/profiles/:id`. */
  private openInEditMode = false;

  ngOnInit(): void {
    this.candidateId = +(this.route.snapshot.paramMap.get('id') ?? 0);
    this.openInEditMode = this.route.snapshot.queryParamMap.get('edit') === 'true';
    this.loadCandidate();
  }

  private loadCandidate(): void {
    this.error.set(null);
    // Refetched alongside the record, not once: every reload here follows an action that
    // moved the pipeline (accept, reject, offer, hire), which is exactly what adds a row.
    this.candidateService.getHistory(this.candidateId).subscribe(h => this.history.set(h));
    this.candidateService.getById(this.candidateId).subscribe({
      next: data => {
        this.candidate.set(data);
        this.salaryNetRh.set(data.salaireNetRh ?? null);
        this.salaryNetCandidat.set(data.salaireNetCandidat ?? null);
        this.firstLoad.set(false);
        // Once only: a later reload (after accept, hire or an offer change) must
        // not silently reopen the editor.
        if (this.openInEditMode) {
          this.openInEditMode = false;
          if (this.canEdit()) this.startEdit();
        }
      },
      error: err => {
        this.error.set(err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.LOAD_CANDIDATE'));
        this.firstLoad.set(false);
      },
    });
  }

  // ── Accept / reject ────────────────────────────────────────────────────────
  readonly showReject = signal(false);

  onAccept(): void {
    this.candidateService.accept(this.candidateId).subscribe({
      next:  () => this.loadCandidate(),
      error: err => this.error.set(err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.ACCEPT')),
    });
  }

  onRejected(): void {
    this.showReject.set(false);
    this.loadCandidate();
  }

  // ── Hire workflow ──────────────────────────────────────────────────────────
  readonly showHireModal = signal(false);
  readonly hireLoading   = signal(false);
  readonly hireError     = signal<string | null>(null);

  openHireModal(): void {
    if (!this.candidate()) return;
    this.hireError.set(null);
    this.showHireModal.set(true);
  }

  confirmHire(form: HireCandidateRequest): void {
    if (!form.hireDate) {
      this.hireError.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.HIRE_DATE_REQUIRED'));
      return;
    }
    if (this.requiresEndDate() && !form.dateFinPrevue) {
      this.hireError.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.END_DATE_REQUIRED'));
      return;
    }
    this.hireLoading.set(true);
    this.hireError.set(null);

    // contractTypeCode is intentionally omitted — the backend derives it from the
    // candidate's employmentTypeId (CandidateService#hireCandidate).
    this.candidateService.hireCandidate(this.candidateId, {
      hireDate:       form.hireDate,
      dateFinPrevue:  form.dateFinPrevue || undefined,
      managerProfile: form.managerProfile,
      notes:          form.notes || null,
    }).subscribe({
      next: res => {
        this.hireLoading.set(false);
        this.showHireModal.set(false);
        this.router.navigate(['/rh/profiles', res.employeeProfileId]);
      },
      error: err => {
        this.hireLoading.set(false);
        this.hireError.set(
          err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.DETAIL_ERRORS.HIRE'),
        );
      },
    });
  }

  // ── Salary ─────────────────────────────────────────────────────────────────
  readonly salaryNetRh       = signal<number | null>(null);
  readonly salaryNetCandidat = signal<number | null>(null);
  readonly salarySaving      = signal(false);
  readonly salaryError       = signal<string | null>(null);
  readonly salarySuccess     = signal<string | null>(null);

  saveSalary(): void {
    this.salarySaving.set(true);
    this.salaryError.set(null);
    this.salarySuccess.set(null);
    this.candidateService.update(this.candidateId, {
      salaireNetRh:       this.salaryNetRh(),
      salaireNetCandidat: this.salaryNetCandidat(),
    }).subscribe({
      next: updated => {
        this.candidate.set(updated);
        this.salarySaving.set(false);
        this.salarySuccess.set(this.translate.instant('CANDIDATES.DETAIL.SALARY_SAVED'));
        setTimeout(() => this.salarySuccess.set(null), 3500);
      },
      error: err => {
        this.salarySaving.set(false);
        this.salaryError.set(
          err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.DETAIL_ERRORS.SALARY_SAVE'),
        );
      },
    });
  }

  // ── CV ─────────────────────────────────────────────────────────────────────
  readonly cvUploading = signal(false);
  readonly cvError     = signal<string | null>(null);
  readonly cvSuccess   = signal<string | null>(null);

  onCvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!CV_ALLOWED_TYPES.includes(file.type)) {
      this.cvError.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.CV_FORMAT'));
      return;
    }
    if (file.size > CV_MAX_BYTES) {
      this.cvError.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.CV_SIZE'));
      return;
    }

    this.cvError.set(null);
    this.cvSuccess.set(null);
    this.cvUploading.set(true);

    this.candidateService.uploadCv(this.candidateId, file).subscribe({
      next: updated => {
        this.candidate.set(updated);
        this.cvUploading.set(false);
        this.cvSuccess.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.CV_UPLOAD_SUCCESS', { name: file.name }));
        input.value = ''; // so re-picking the same file still fires `change`
        setTimeout(() => this.cvSuccess.set(null), 4000);
      },
      error: err => {
        this.cvUploading.set(false);
        this.cvError.set(
          err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.DETAIL_ERRORS.CV_UPLOAD'),
        );
      },
    });
  }

  downloadCv(): void {
    window.open(this.candidateService.cvDownloadUrl(this.candidateId), '_blank');
  }

  // ── Offer panel ────────────────────────────────────────────────────────────
  onOfferChanged(): void {
    this.loadCandidate();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  goToProvisioning(provId: number): void { this.router.navigate(['/rh/it-provisioning', provId]); }
  goToOnboarding(): void { this.router.navigate(['/rh/onboarding', this.candidateId]); }
  navigateToCandidate(): void { this.router.navigate(['/rh/candidates']); }
  navigateToProfiles(): void { this.router.navigate(['/rh/profiles']); }
}

/** `''`, `null` and `undefined` all mean "no value" when diffing form vs record. */
function normalise(v: unknown): unknown {
  return v === '' || v === undefined ? null : v;
}
