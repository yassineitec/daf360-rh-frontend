import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CandidateService } from './candidate.service';
import { CandidateDetail, HireCandidateRequest } from './candidate.model';
import { CandidateInterviewsComponent } from './candidate-interviews.component';
import { OfferSectionComponent } from './offer-section.component';
import { RejectModalComponent } from './reject-modal.component';
import { ModalComponent } from '../../shared/modal.component';
import { UserStore } from '../../core/user.store';
import {
  BadgeOptions,
  ButtonComponent,
  CheckboxComponent,
  FormFieldComponent,
  MultiDatePickerComponent,
  StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';
import { statusBadge } from 'src/app/shared/status-badge.utils';
import { isoToDate, dateToIso } from '../../shared/date-picker.utils';
import { genderLabel } from '../../shared/utils/gender.utils';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const HIREABLE_STATUSES = ['ACCEPTED', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS'];
/** Contract codes the backend requires an end date for (also enforced server-side). */
const NEEDS_END_DATE = ['CDD', 'CIVP', 'STAGE', 'DETACHEMENT'];

@Component({
  selector: 'app-candidate-detail',
  standalone: true,
  imports: [
    StatusBadgeComponent,
    ButtonComponent,
    FormFieldComponent,
    MultiDatePickerComponent,
    CheckboxComponent,
    RejectModalComponent,
    CandidateInterviewsComponent,
    OfferSectionComponent,
    ModalComponent,
    TranslatePipe,
  ],
  templateUrl: './candidate-detail.component.html',
})
export class CandidateDetailComponent implements OnInit {
  private readonly candidateService = inject(CandidateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly userStore = inject(UserStore);
  private readonly translate = inject(TranslateService);

  candidate = signal<CandidateDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  showReject = signal(false);

  // ── Hire modal state ──────────────────────────────────────────────────────
  showHireModal = signal(false);
  hireLoading = signal(false);
  hireError = signal<string | null>(null);

  hireForm: HireCandidateRequest = {
    hireDate: '',
    managerProfile: false,
    notes: null,
  };

  /** Human contract-type label from the backend (resolved EMPLOYMENT_TYPE list value). */
  readonly contractTypeLabel = computed(() => this.candidate()?.employmentTypeLabel ?? null);

  /** French label for the stored gender code (MALE→Homme, …). */
  protected readonly genderLabel = genderLabel;

  /** Whether the hire form should require an end date (backend enforces this too). */
  readonly requiresEndDate = computed(() => {
    const label = (this.candidate()?.employmentTypeLabel ?? '').toUpperCase();
    return NEEDS_END_DATE.some((code) => label.includes(code));
  });

  readonly canHire = computed(() => this.userStore.hasPermission('RH_HIRE_CANDIDATE'));

  readonly canHireThisCandidate = computed(() => {
    const c = this.candidate();
    return c !== null && HIREABLE_STATUSES.includes(c.status) && this.canHire();
  });

  // ── CV upload state ───────────────────────────────────────────────────────
  cvUploading = signal(false);
  cvError = signal<string | null>(null);
  cvSuccess = signal<string | null>(null);

  private candidateId = 0;
  protected readonly statusBadge = statusBadge;

  readonly canAcceptReject = computed(() =>
    this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'),
  );

  readonly showItSection = computed(() => {
    const c = this.candidate();
    const noProvisioning: string[] = ['PENDING', 'REJECTED'];
    return c !== null && !noProvisioning.includes(c.status);
  });

  readonly showInterviewsSection = computed(() => {
    const c = this.candidate();
    return c !== null && !['REJECTED', 'ARCHIVED'].includes(c.status);
  });

  /** Offer/negotiation panel: relevant from acceptance onward (and to show a refused offer). */
  readonly showOfferSection = computed(() => {
    const c = this.candidate();
    return c !== null && !['PENDING', 'ARCHIVED'].includes(c.status);
  });

  onOfferChanged(): void {
    this.loadCandidate();
  }

  ngOnInit(): void {
    this.candidateId = +(this.route.snapshot.paramMap.get('id') ?? 0);
    this.loadCandidate();
  }

  // ── Hire workflow ─────────────────────────────────────────────────────────
  openHireModal(): void {
    if (!this.candidate()) return;
    this.hireForm = { hireDate: '', managerProfile: false, notes: null, dateFinPrevue: undefined };
    this.hireError.set(null);
    this.showHireModal.set(true);
  }

  setHireDate(v: Date | Date[] | null): void {
    this.hireForm.hireDate = dateToIso(v) || '';
  }

  setEndDate(v: Date | Date[] | null): void {
    this.hireForm.dateFinPrevue = dateToIso(v) || undefined;
  }

  setHireNotes(v: string | number | null): void {
    this.hireForm.notes = v == null || v === '' ? null : String(v);
  }

  getHireDate(): Date | null {
    return isoToDate(this.hireForm.hireDate || null);
  }

  getEndDate(): Date | null {
    return isoToDate(this.hireForm.dateFinPrevue || null);
  }

  confirmHire(): void {
    if (!this.hireForm.hireDate) {
      this.hireError.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.HIRE_DATE_REQUIRED'));
      return;
    }
    if (this.requiresEndDate() && !this.hireForm.dateFinPrevue) {
      this.hireError.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.END_DATE_REQUIRED'));
      return;
    }
    this.hireLoading.set(true);
    this.hireError.set(null);

    // contractTypeCode is intentionally omitted — the backend derives it from
    // the candidate's employmentTypeId (CandidateService#hireCandidate).
    const dto: HireCandidateRequest = {
      hireDate: this.hireForm.hireDate,
      dateFinPrevue: this.hireForm.dateFinPrevue || undefined,
      managerProfile: this.hireForm.managerProfile,
      notes: this.hireForm.notes || null,
    };

    this.candidateService.hireCandidate(this.candidateId, dto).subscribe({
      next: (res) => {
        this.hireLoading.set(false);
        this.showHireModal.set(false);
        this.router.navigate(['/rh/profiles', res.employeeProfileId]);
      },
      error: (err) => {
        this.hireLoading.set(false);
        this.hireError.set(
          err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.DETAIL_ERRORS.HIRE'),
        );
      },
    });
  }

  private loadCandidate(): void {
    this.loading.set(true);
    this.error.set(null);
    this.candidateService.getById(this.candidateId).subscribe({
      next: (data) => {
        this.candidate.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.LOAD_CANDIDATE'));
        this.loading.set(false);
      },
    });
  }

  onAccept(): void {
    this.candidateService.accept(this.candidateId).subscribe({
      next: () => this.loadCandidate(),
      error: (err) => this.error.set(err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.ACCEPT')),
    });
  }

  onRejected(): void {
    this.showReject.set(false);
    this.loadCandidate();
  }

  readonly canManageIt = computed(() => this.userStore.hasPermission('IT_PROVISIONING'));

  readonly canOnboard = computed(() => this.userStore.hasPermission('HR_ONBOARDING'));

  goToProvisioning(provId: number): void {
    this.router.navigate(['/rh/it-provisioning', provId]);
  }

  goToOnboarding(): void {
    this.router.navigate(['/rh/onboarding', this.candidateId]);
  }

  onCvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.type)) {
      this.cvError.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.CV_FORMAT'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.cvError.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.CV_SIZE'));
      return;
    }

    this.cvError.set(null);
    this.cvSuccess.set(null);
    this.cvUploading.set(true);

    this.candidateService.uploadCv(this.candidateId, file).subscribe({
      next: (updated) => {
        this.candidate.set(updated);
        this.cvUploading.set(false);
        this.cvSuccess.set(this.translate.instant('CANDIDATES.DETAIL_ERRORS.CV_UPLOAD_SUCCESS', { name: file.name }));
        input.value = '';
        setTimeout(() => this.cvSuccess.set(null), 4000);
      },
      error: (err) => {
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

  // ── Template helpers ──────────────────────────────────────────────────────

  initials(c: { firstName: string; lastName: string }): string {
    return ((c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '')).toUpperCase();
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  readonly pipelineSteps: { status: string }[] = [
    { status: 'PENDING' },
    { status: 'ACCEPTED' },
    { status: 'OFFER_SENT' },
    { status: 'IT_IN_PROGRESS' },
    { status: 'EMAIL_RECEIVED' },
    { status: 'HR_IN_PROGRESS' },
    { status: 'HIRED' },
  ];

  private readonly statusOrder = this.pipelineSteps.map((s) => s.status);

  isPast(stepStatus: string, currentStatus: string): boolean {
    return this.statusOrder.indexOf(stepStatus) < this.statusOrder.indexOf(currentStatus);
  }

  stepBg(stepStatus: string, currentStatus: string): string {
    if (stepStatus === currentStatus) return 'var(--color-teal)';
    if (this.isPast(stepStatus, currentStatus)) return 'var(--color-tertiary-container)';
    return 'var(--color-outline-variant)';
  }

  stepColor(stepStatus: string, currentStatus: string): string {
    if (stepStatus === currentStatus) return '#ffffff';
    return 'var(--color-on-surface-variant)';
  }

  /** Badge options for a license/entitlement pill (active vs. not provisioned). */
  licenseBadgeOptions(active: boolean): BadgeOptions {
    return { variant: active ? 'success' : 'neutral', size: 'sm', dot: true };
  }

  navigateToCandidate() {
    this.router.navigate(['/rh/candidates']);
  }

  navigateToProfiles() {
    this.router.navigate(['/rh/profiles']);
  }
}
