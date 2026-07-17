import { Component, computed, inject, input, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ProfileService } from './profile.service';
import {
  EmployeeDocument,
  EmployeeProfile,
  LifecycleStatus,
  LIFECYCLE_TRANSITIONS,
  LIFECYCLE_LABELS,
  ProfileUpdateDto,
} from './models/profile.model';
import {
  StatusBadgeComponent,
  ButtonComponent,
  CardComponent,
  SelectComponent,
  FormFieldComponent,
  MultiDatePickerComponent,
  ToggleComponent,
  RadioGroupComponent,
  AmountFieldComponent,
  FileUploadComponent,
  ModalService,
  type ModalRef,
  type SelectOption,
  type UploadedFile,
} from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { GENDER_OPTIONS, genderLabel } from '../../shared/utils/gender.utils';
import { isoToDate, dateToIso } from '../../shared/date-picker.utils';
import { SpinnerComponent } from '../../shared/spinner.component';
import { UserStore } from '../../core/user.store';
import { PdfDownloadButtonComponent } from '../../shared/pdf-download-button/pdf-download-button.component';
import { PdfDownloadService, GeneratedDocumentResponse } from '../../core/pdf/pdf-download.service';
import { RegimeService } from '../admin/regimes/regime.service';
import { ResolvedRegimeDto } from '../admin/regimes/regime.model';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem } from '../../core/ref/ref-data.model';
import { ContractHistoryComponent } from './contract-history/contract-history.component';
import { ContractLifecycleService } from './lifecycle/contract-lifecycle.service';
import {
  ContractListDto,
  ContractDetailDto,
  ContractTransitionHistoryDto,
  STATUS_CONFIG,
  CONTRACT_TYPE_CONFIG,
} from './lifecycle/contract-lifecycle.model';
import { NewContractFormComponent } from './lifecycle/new-contract-form.component';
import { ConfirmService } from '../../core/confirm.service';

// ─────────────────────────────────────────────────────────────────────────────
// Reusable field display — defined here for colocation, imported below.
// No lib equivalent exists for a plain label+value display, so this stays local.
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-field',
  standalone: true,
  template: `
    <div class="field" [class.field-wide]="wide()">
      <span class="field-label">{{ label() }}</span>
      <span class="field-value">{{ value() ?? '—' }}</span>
    </div>
  `,
  styles: [
    `
      .field {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .field-wide {
        grid-column: span 2;
      }
      .field-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--color-text-muted, #6b7280);
      }
      .field-value {
        font-size: 13px;
        color: var(--color-text, #1a1c1e);
      }
    `,
  ],
})
export class FieldComponent {
  label = input.required<string>();
  value = input<string | null | undefined>(null);
  wide = input(false);
}

type SectionKey =
  | 'identite'
  | 'emploi'
  | 'poste'
  | 'regime'
  | 'contact'
  | 'urgence'
  | 'bancaire'
  | 'lifecycle'
  | 'contrats'
  | 'documents';

// ─────────────────────────────────────────────────────────────────────────────
// Profile Detail
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-profile-detail',
  standalone: true,
  imports: [
    RouterLink,
    StatusBadgeComponent,
    ButtonComponent,
    CardComponent,
    SelectComponent,
    FormFieldComponent,
    MultiDatePickerComponent,
    ToggleComponent,
    RadioGroupComponent,
    AmountFieldComponent,
    FileUploadComponent,
    SpinnerComponent,
    FieldComponent,
    PdfDownloadButtonComponent,
    ContractHistoryComponent,
    NewContractFormComponent,
    TranslatePipe,
  ],
  templateUrl: './profile-detail.component.html',
  styleUrl: './profile-detail.component.scss',
})
export class ProfileDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  private svc = inject(ProfileService);
  private userStore = inject(UserStore);
  private pdfSvc = inject(PdfDownloadService);
  private regimeSvc = inject(RegimeService);
  private refSvc = inject(RefDataService);
  private lcSvc = inject(ContractLifecycleService);
  private modalService = inject(ModalService);
  private translate = inject(TranslateService);

  readonly statusCfg = STATUS_CONFIG;
  readonly typeCfg = CONTRACT_TYPE_CONFIG;

  lcStatusCfg(code: string) {
    const cfg = this.statusCfg[code as keyof typeof STATUS_CONFIG];
    return {
      label: cfg ? this.translate.instant('PROFILES.CONTRACT_STATUS.' + code) : code,
      variant: cfg?.variant ?? ('neutral' as const),
    };
  }
  lcTypeCfg(code: string) {
    const cfg = this.typeCfg[code as keyof typeof CONTRACT_TYPE_CONFIG];
    return {
      label: cfg ? this.translate.instant('PROFILES.CONTRACT_TYPE.' + code) : code,
      needsEndDate: cfg?.needsEndDate ?? false,
      hasTrial: cfg?.hasTrial ?? false,
    };
  }
  protected readonly statusBadge = statusBadge;

  profileId = 0;

  // ── State ──────────────────────────────────────────────────────────────────
  loading = signal(true);
  saving = signal(false);
  docsLoading = signal(false);
  profile = signal<EmployeeProfile | null>(null);
  documents = signal<EmployeeDocument[]>([]);
  generatedDocs = signal<GeneratedDocumentResponse[]>([]);
  editMode = signal(false);
  editForm: ProfileUpdateDto = { reason: '' };
  editSaveError = signal<string | null>(null);

  // ── Ref data lists for edit dropdowns ─────────────────────────────────────
  grades = signal<RefDataItem[]>([]);
  disciplines = signal<RefDataItem[]>([]);
  nogLevels = signal<RefDataItem[]>([]);
  departments = signal<RefDataItem[]>([]);
  banks = signal<RefDataItem[]>([]);
  nationalities = signal<RefDataItem[]>([]);

  private blankOption(): SelectOption {
    return { value: '', label: this.translate.instant('PROFILES.COMMON.SELECT_PLACEHOLDER') };
  }

  readonly genderOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      this.blankOption(),
      ...GENDER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    ];
  });

  // Read-mode display helper: code (MALE/FEMALE/…) -> French label.
  readonly genderLabel = genderLabel;

  readonly maritalStatusOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      this.blankOption(),
      { value: 'Célibataire', label: this.translate.instant('PROFILES.MARITAL.SINGLE') },
      { value: 'Marié(e)', label: this.translate.instant('PROFILES.MARITAL.MARRIED') },
      { value: 'Divorcé(e)', label: this.translate.instant('PROFILES.MARITAL.DIVORCED') },
      { value: 'Veuf(ve)', label: this.translate.instant('PROFILES.MARITAL.WIDOWED') },
    ];
  });

  readonly contractTypeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      this.blankOption(),
      { value: 'PERMANENT', label: this.translate.instant('PROFILES.CONTRACT_TYPE.PERMANENT') },
      { value: 'FIXED_TERM', label: this.translate.instant('PROFILES.CONTRACT_TYPE.FIXED_TERM') },
      { value: 'INTERN', label: this.translate.instant('PROFILES.CONTRACT_TYPE.INTERN') },
      { value: 'CONSULTANT', label: this.translate.instant('PROFILES.CONTRACT_TYPE.CONSULTANT') },
    ];
  });

  nationalityOptions = computed<SelectOption[]>(() => [
    this.blankOption(),
    ...this.nationalities().map((n) => ({ value: String(n.id), label: n.labelFr })),
  ]);
  departmentOptions = computed<SelectOption[]>(() => [
    this.blankOption(),
    ...this.departments().map((d) => ({ value: String(d.id), label: d.labelFr })),
  ]);
  gradeOptions = computed<SelectOption[]>(() => [
    this.blankOption(),
    ...this.grades().map((g) => ({ value: String(g.id), label: g.labelFr })),
  ]);
  disciplineOptions = computed<SelectOption[]>(() => [
    this.blankOption(),
    ...this.disciplines().map((d) => ({ value: String(d.id), label: d.labelFr })),
  ]);
  nogLevelOptions = computed<SelectOption[]>(() => [
    this.blankOption(),
    ...this.nogLevels().map((n) => ({ value: String(n.id), label: n.labelFr })),
  ]);
  bankOptions = computed<SelectOption[]>(() => [
    this.blankOption(),
    ...this.banks().map((b) => ({ value: String(b.id), label: b.labelFr })),
  ]);

  // Bridges nullable FK ids used by editForm to the string[] selection model of daf-select.
  toSelected(id: number | null | undefined): string[] {
    return id != null ? [String(id)] : [];
  }
  fromSelected(values: string[]): number | null {
    return values[0] ? Number(values[0]) : null;
  }

  // Bridges daf-form-field's `string | number | null` value model to plain text/number fields.
  asText(v: string | number | null): string {
    return v == null ? '' : String(v);
  }
  asNumber(v: string | number | null): number | null {
    return v == null || v === '' ? null : Number(v);
  }

  // Bridges plain ISO date strings to daf-multi-date-picker's Date-based value model.
  protected readonly toDate = isoToDate;
  protected readonly fromDate = dateToIso;

  // Backend errors are Spring ProblemDetail bodies — the message is under `detail`
  // (and, for validation failures, a per-field `errors` map), never `message`.
  private extractErrorMessage(err: unknown, fallback: string): string {
    const body = (err as { error?: { detail?: string; errors?: Record<string, string> } })?.error;
    if (body?.errors && typeof body.errors === 'object') {
      const messages = Object.values(body.errors).filter((v): v is string => typeof v === 'string');
      if (messages.length) return messages.join(' ');
    }
    return body?.detail ?? fallback;
  }

  resolvedRegime = signal<ResolvedRegimeDto | null>(null);
  isLoadingRegime = signal(true);

  photoUploading = signal(false);
  photoError = signal<string | null>(null);

  transitionTarget = signal<LifecycleStatus | null>(null);
  transitionReason = '';
  transitionError = signal<string | null>(null);

  uploadType = 'CONTRACT';
  uploadFiles = signal<UploadedFile[]>([]);

  // ── Contract Lifecycle Engine ───────────────────────────────────────────────
  lcContracts = signal<ContractListDto[]>([]);
  lcLoading = signal(false);
  lcLoaded = false;
  lcHistory = signal<ContractTransitionHistoryDto[]>([]);
  lcSaving = signal(false);
  lcError = signal<string | null>(null);

  showNewContractModal = signal(false);

  selectedContractId: number | null = null;

  // trial validation form
  trialApproved = true;
  trialComment = '';
  // CDD renewal form
  renewDateFin = '';
  renewComment = '';
  // CDI conversion form
  cdiStartDate = '';
  cdiComment = '';

  readonly docTypes = [
    'CONTRACT',
    'ID_CARD',
    'DIPLOMA',
    'MEDICAL_CERTIFICATE',
    'RIB',
    'RESIGNATION',
    'OTHER',
  ];
  readonly docTypeOptions: SelectOption[] = this.docTypes.map((t) => ({ value: t, label: t }));

  // ── Modal templates (opened imperatively via ModalService) ──────────────────
  transitionTpl = viewChild<TemplateRef<unknown>>('transitionTpl');
  validateTrialTpl = viewChild<TemplateRef<unknown>>('validateTrialTpl');
  renewCDDTpl = viewChild<TemplateRef<unknown>>('renewCDDTpl');
  convertCDITpl = viewChild<TemplateRef<unknown>>('convertCDITpl');

  private openSections = signal<Set<SectionKey>>(
    new Set<SectionKey>(['identite', 'emploi', 'poste', 'contact']),
  );

  open(k: SectionKey) {
    return this.openSections().has(k);
  }
  toggle(k: SectionKey) {
    this.openSections.update((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  // ── Permissions ────────────────────────────────────────────────────────────
  canEdit = signal(true);
  canViewSensitive = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  canTransition = computed(
    () =>
      this.profile() !== null &&
      this.allowedTransitions().length > 0 &&
      this.userStore.isHrManager(),
  );

  allowedTransitions = computed((): LifecycleStatus[] => {
    const p = this.profile();
    return p ? (LIFECYCLE_TRANSITIONS[p.lifecycleStatus] ?? []) : [];
  });

  lifecycleLabel(s: LifecycleStatus) {
    return LIFECYCLE_LABELS[s] ? this.translate.instant('PROFILES.LIFECYCLE.' + s) : s;
  }

  // ── Date helper ────────────────────────────────────────────────────────────
  fmt(iso: string | null | undefined): string | null {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('fr-FR');
    } catch {
      return iso;
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  private openInEditMode = false;

  ngOnInit() {
    this.profileId = Number(this.route.snapshot.paramMap.get('id'));
    this.openInEditMode = this.route.snapshot.queryParamMap.get('edit') === 'true';

    this.loadProfile();
  }

  loadProfile() {
    this.svc
      .getById(this.profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((p) => {
        this.loading.set(false);
        this.profile.set(p);

        if (p) {
          this.loadResolvedRegime(p.id);
          this.pdfSvc
            .generateDocument('/api/hr/documents/by-profile/' + p.id, null)
            .subscribe({ next: (docs: any) => this.generatedDocs.set(docs), error: () => {} });
          if (this.openInEditMode) {
            this.openInEditMode = false;
            this.startEdit();
          }
        }
      });
  }

  loadDocuments() {
    if (this.documents().length > 0) return;
    this.docsLoading.set(true);
    this.svc
      .listDocuments(this.profileId)
      .pipe(catchError(() => of([])))
      .subscribe((docs) => {
        this.docsLoading.set(false);
        this.documents.set(docs);
      });
  }

  // ── Lifecycle transition ────────────────────────────────────────────────────
  openTransitionModal() {
    this.transitionTarget.set(null);
    this.transitionReason = '';
    this.transitionError.set(null);
    const tpl = this.transitionTpl();
    if (!tpl) return;
    this.modalService.open({
      title: this.translate.instant('PROFILES.TRANSITION.MODAL_TITLE'),
      body: tpl,
      buttons: [
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'), variant: 'secondary', action: (ref) => ref.close() },
        { label: this.translate.instant('PROFILES.COMMON.CONFIRM'), variant: 'primary', action: (ref) => this.confirmTransition(ref) },
      ],
    });
  }

  confirmTransition(ref: ModalRef) {
    const target = this.transitionTarget();
    if (!target || !this.transitionReason.trim()) {
      this.transitionError.set(this.translate.instant('PROFILES.TRANSITION.ERR_SELECT'));
      return;
    }
    if (this.saving()) return;
    this.transitionError.set(null);
    this.saving.set(true);
    this.svc
      .transition(this.profileId, { newStatus: target, reason: this.transitionReason })
      .pipe(
        catchError((err) => {
          this.saving.set(false);
          this.transitionError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.TRANSITION.ERR_CHANGE')));
          return of(null);
        }),
      )
      .subscribe((updated) => {
        if (updated) {
          this.saving.set(false);
          this.profile.set(updated);
          ref.close();
        }
      });
  }

  // ── Document upload ─────────────────────────────────────────────────────────
  onDocumentFilesChange(files: UploadedFile[]): void {
    this.uploadFiles.set(files);
  }

  // ── Photo upload ────────────────────────────────────────────────────────────
  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    // Validate client-side
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.photoError.set(this.translate.instant('PROFILES.PHOTO.ERR_FORMAT'));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.photoError.set(this.translate.instant('PROFILES.PHOTO.ERR_SIZE'));
      return;
    }
    this.photoUploading.set(true);
    this.photoError.set(null);
    this.svc.uploadPhoto(this.profileId, file).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.photoUploading.set(false);
      },
      error: (err) => {
        this.photoUploading.set(false);
        this.photoError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.PHOTO.ERR_UPLOAD')));
      },
    });
  }

  // ── Template helper (avoids private access issues) ─────────────────────────
  photoUrl(path: string | null): string | null {
    return this.svc.photoUrl(path);
  }

  // ── Regime ─────────────────────────────────────────────────────────────────
  loadResolvedRegime(profileId: number): void {
    this.isLoadingRegime.set(true);
    this.regimeSvc.resolveForEmployee(profileId).subscribe({
      next: (r) => {
        this.resolvedRegime.set(r);
        this.isLoadingRegime.set(false);
      },
      error: () => this.isLoadingRegime.set(false),
    });
  }

  async removeEmployeeRegimeOverride(): Promise<void> {
    const p = this.profile();
    if (!p) return;
    if (!(await this.confirm.ask({
      title: this.translate.instant('PROFILES.REGIME_OVERRIDE.CONFIRM_TITLE'),
      message: this.translate.instant('PROFILES.REGIME_OVERRIDE.CONFIRM_MESSAGE'),
      confirmLabel: this.translate.instant('PROFILES.COMMON.DELETE'), icon: 'delete',
    }))) return;
    this.regimeSvc.removeEmployeeOverride(p.id).subscribe({
      next: () => this.loadResolvedRegime(p.id),
      error: () => {},
    });
  }

  // ── Inline edit ────────────────────────────────────────────────────────────
  startEdit(): void {
    this.initEditForm();
    this.editMode.set(true);
    this.editSaveError.set(null);
    // Load ref data lists for dropdowns
    const paysId = this.profile()!.paysId;
    this.refSvc.getGrades(paysId).subscribe((r) => this.grades.set(r));
    this.refSvc.getDisciplines(paysId).subscribe((r) => this.disciplines.set(r));
    this.refSvc.getNogLevels(paysId).subscribe((r) => this.nogLevels.set(r));
    this.refSvc.getDepartments(paysId).subscribe((r) => this.departments.set(r));
    this.refSvc.getBanks(paysId).subscribe((r) => this.banks.set(r));
    this.refSvc.getNationalities().subscribe((r) => this.nationalities.set(r));
  }

  initEditForm(): void {
    const p = this.profile();
    if (!p) return;
    this.editForm = {
      reason: '',
      dateOfBirth: p.dateOfBirth ?? '',
      gender: p.gender ?? '',
      nationalityId: p.nationalityId ?? null,
      nationalId: p.nationalId ?? '',
      passportNumber: p.passportNumber ?? '',
      maritalStatus: p.maritalStatus ?? '',
      numberOfChildren: p.numberOfChildren ?? null,
      hireDate: p.hireDate ?? '',
      contractType: p.contractType ?? '',
      contractEndDate: p.contractEndDate ?? '',
      probationEndDate: p.probationEndDate ?? '',
      isOnProbation: p.isOnProbation ?? false,
      departmentId: p.departmentId ?? null,
      gradeId: p.gradeId ?? null,
      disciplineId: p.disciplineId ?? null,
      nogLevelId: p.nogLevelId ?? null,
      personalEmail: p.personalEmail ?? '',
      phone: p.phone ?? '',
      personalAddress: p.personalAddress ?? '',
      emergencyContactName: p.emergencyContactName ?? '',
      emergencyContactRelation: p.emergencyContactRelation ?? '',
      emergencyContactPhone: p.emergencyContactPhone ?? '',
      bankId: p.bankId ?? null,
      iban: p.iban ?? '',
      bankAccountNumber: p.bankAccountNumber ?? '',
      rib: p.rib ?? '',
      socialSecurityNumber: p.socialSecurityNumber ?? '',
      taxId: p.taxId ?? '',
      cnssNumber: p.cnssNumber ?? '',
      cnssAffiliationDate: p.cnssAffiliationDate ?? '',
      salaireNetCandidat: p.salaireNetCandidat ?? null,
      salaireNetRh: p.salaireNetRh ?? null,
    };
  }

  saveProfile(): void {
    if (!this.editForm.reason?.trim()) {
      this.editSaveError.set(this.translate.instant('PROFILES.EDIT.ERR_REASON_REQUIRED'));
      return;
    }
    this.saving.set(true);
    this.editSaveError.set(null);
    const dto: ProfileUpdateDto = { ...this.editForm };
    // Convert empty strings to undefined for optional fields
    Object.keys(dto).forEach((k) => {
      if (k !== 'reason' && (dto as any)[k] === '') (dto as any)[k] = undefined;
    });
    this.svc
      .update(this.profileId, dto)
      .pipe(
        catchError((err) => {
          this.saving.set(false);
          this.editSaveError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.EDIT.ERR_SAVE')));
          return of(null);
        }),
      )
      .subscribe((updated) => {
        if (updated) {
          this.profile.set(updated);
          this.editMode.set(false);
          this.saving.set(false);
          this.editSaveError.set(null);
        }
      });
  }

  // ── Contract Lifecycle Engine ───────────────────────────────────────────────

  loadContracts(): void {
    if (this.lcLoaded) return;
    this.lcLoaded = true;
    this.lcLoading.set(true);
    this.lcSvc
      .getContracts(this.profileId)
      .pipe(catchError(() => of([])))
      .subscribe((cs) => {
        this.lcContracts.set(cs);
        this.lcLoading.set(false);
      });
    this.lcSvc
      .getLifecycleHistory(this.profileId)
      .pipe(catchError(() => of([])))
      .subscribe((h) => this.lcHistory.set(h));
  }

  onContractCreated(contract: ContractDetailDto): void {
    this.showNewContractModal.set(false);
    this.lcLoaded = false;
    this.loadContracts();
  }

  daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
    return diff;
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
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'), variant: 'secondary', action: (ref) => ref.close() },
        { label: this.translate.instant('PROFILES.COMMON.CONFIRM'), variant: 'primary', action: (ref) => this.confirmValidateTrial(ref) },
      ],
    });
  }

  confirmValidateTrial(ref: ModalRef): void {
    if (this.selectedContractId === null || this.lcSaving()) return;
    this.lcSaving.set(true);
    this.lcSvc
      .validateTrial(this.selectedContractId, {
        approved: this.trialApproved,
        commentaire: this.trialComment || null,
      })
      .pipe(
        catchError((err) => {
          this.lcError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.COMMON.GENERIC_ERROR')));
          this.lcSaving.set(false);
          return of(null);
        }),
      )
      .subscribe((r) => {
        if (r) {
          this.lcSaving.set(false);
          this.lcLoaded = false;
          this.loadContracts();
          ref.close();
        }
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
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'), variant: 'secondary', action: (ref) => ref.close() },
        { label: this.translate.instant('PROFILES.RENEW.CONFIRM'), variant: 'primary', action: (ref) => this.confirmRenewCDD(ref) },
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
    this.lcSvc
      .renewCDD(this.selectedContractId, {
        newDateFin: this.renewDateFin,
        commentaire: this.renewComment || null,
      })
      .pipe(
        catchError((err) => {
          this.lcError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.COMMON.GENERIC_ERROR')));
          this.lcSaving.set(false);
          return of(null);
        }),
      )
      .subscribe((r) => {
        if (r) {
          this.lcSaving.set(false);
          this.lcLoaded = false;
          this.loadContracts();
          ref.close();
        }
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
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'), variant: 'secondary', action: (ref) => ref.close() },
        { label: this.translate.instant('PROFILES.CONVERT.CONFIRM'), variant: 'primary', action: (ref) => this.confirmConvertCDI(ref) },
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
    this.lcSvc
      .convertToCDI(this.selectedContractId, {
        cdiStartDate: this.cdiStartDate,
        commentaire: this.cdiComment || null,
      })
      .pipe(
        catchError((err) => {
          this.lcError.set(this.extractErrorMessage(err, this.translate.instant('PROFILES.COMMON.GENERIC_ERROR')));
          this.lcSaving.set(false);
          return of(null);
        }),
      )
      .subscribe((r) => {
        if (r) {
          this.lcSaving.set(false);
          this.lcLoaded = false;
          this.loadContracts();
          ref.close();
        }
      });
  }
}
