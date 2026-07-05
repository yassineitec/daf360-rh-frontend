import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CandidateService } from './candidate.service';
import { CandidateDetail, HireCandidateRequest } from './candidate.model';
import { CandidateInterviewsComponent } from './candidate-interviews.component';
import { RejectModalComponent } from './reject-modal.component';
import { UserStore } from '../../core/user.store';
import {
  ButtonComponent,
  CheckboxComponent,
  FormFieldComponent,
  MultiDatePickerComponent,
  StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';
import { statusBadge } from 'src/app/shared/status-badge.utils';
import { isoToDate, dateToIso } from '../../shared/date-picker.utils';

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
  ],
  templateUrl: './candidate-detail.component.html',
})
export class CandidateDetailComponent implements OnInit {
  private readonly candidateService = inject(CandidateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly userStore = inject(UserStore);

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
      this.hireError.set("La date d'embauche est obligatoire.");
      return;
    }
    if (this.requiresEndDate() && !this.hireForm.dateFinPrevue) {
      this.hireError.set('La date de fin est obligatoire pour ce type de contrat.');
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
          err?.error?.detail ?? err?.error?.message ?? "Erreur lors de l'embauche.",
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
        this.error.set(err?.error?.message ?? 'Impossible de charger le candidat.');
        this.loading.set(false);
      },
    });
  }

  onAccept(): void {
    this.candidateService.accept(this.candidateId).subscribe({
      next: () => this.loadCandidate(),
      error: (err) => this.error.set(err?.error?.message ?? "Erreur lors de l'acceptation."),
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
      this.cvError.set('Format non supporté — PDF, DOC ou DOCX uniquement');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.cvError.set('Fichier trop volumineux — max 10 Mo');
      return;
    }

    this.cvError.set(null);
    this.cvSuccess.set(null);
    this.cvUploading.set(true);

    this.candidateService.uploadCv(this.candidateId, file).subscribe({
      next: (updated) => {
        this.candidate.set(updated);
        this.cvUploading.set(false);
        this.cvSuccess.set(`CV "${file.name}" téléversé avec succès.`);
        input.value = '';
        setTimeout(() => this.cvSuccess.set(null), 4000);
      },
      error: (err) => {
        this.cvUploading.set(false);
        this.cvError.set(
          err?.error?.detail ?? err?.error?.message ?? 'Erreur lors du téléversement.',
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

  readonly pipelineSteps: { status: string; label: string }[] = [
    { status: 'PENDING', label: 'En attente' },
    { status: 'ACCEPTED', label: 'Accepté' },
    { status: 'IT_IN_PROGRESS', label: 'IT en cours' },
    { status: 'EMAIL_RECEIVED', label: 'Email reçu' },
    { status: 'HR_IN_PROGRESS', label: 'RH en cours' },
    { status: 'HIRED', label: 'Embauché' },
  ];

  private readonly statusOrder = this.pipelineSteps.map((s) => s.status);

  isPast(stepStatus: string, currentStatus: string): boolean {
    return this.statusOrder.indexOf(stepStatus) < this.statusOrder.indexOf(currentStatus);
  }

  stepBg(stepStatus: string, currentStatus: string): string {
    if (stepStatus === currentStatus) return '#1b3a4b';
    if (this.isPast(stepStatus, currentStatus)) return 'rgba(121,215,190,0.2)';
    return 'rgba(0,0,0,0.05)';
  }

  stepColor(stepStatus: string, currentStatus: string): string {
    if (stepStatus === currentStatus) return '#ffffff';
    if (this.isPast(stepStatus, currentStatus)) return '#50717b';
    return '#94a3b8';
  }

  navigateToCandidate() {
    this.router.navigate(['/rh/candidates']);
  }

  navigateToProfiles() {
    this.router.navigate(['/rh/profiles']);
  }
}
