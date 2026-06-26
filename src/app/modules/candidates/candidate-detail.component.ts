import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { CandidateService } from './candidate.service';
import { CandidateDetail, HireCandidateRequest } from './candidate.model';
import { CandidateFormComponent } from './candidate-form.component';
import { RejectModalComponent } from './reject-modal.component';
// import { StatusBadgeComponent }    from '../../shared/status-badge.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { UserStore } from '../../core/user.store';
import { PermissionDirective } from '../../shared/permission.directive';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue } from '../../core/lists/configurable-list.model';
import { ButtonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from 'src/app/shared/status-badge.utils';

const HIREABLE_STATUSES = ['ACCEPTED', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS'];
const NEEDS_END_DATE = ['CDD', 'CIVP', 'STAGE', 'DETACHEMENT'];
const CONTRACT_CODE_MAP: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  CIVP: 'CIVP',
  STAGE: 'STAGE',
  FREELANCE: 'PORTAGE',
  PORTAGE: 'PORTAGE',
  DETACHEMENT: 'DETACHEMENT',
};

@Component({
  selector: 'app-candidate-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    StatusBadgeComponent,
    ButtonComponent,
    RejectModalComponent,
    PermissionDirective,
  ],
  templateUrl: './candidate-detail.component.html',
})
export class CandidateDetailComponent implements OnInit {
  private readonly candidateService = inject(CandidateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listSvc = inject(ConfigurableListService);
  readonly userStore = inject(UserStore);

  candidate = signal<CandidateDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  showReject = signal(false);

  // ── Hire modal state ──────────────────────────────────────────────────────
  showHireModal = signal(false);
  hireLoading = signal(false);
  hireError = signal<string | null>(null);
  employmentTypes = signal<ListValue[]>([]);

  hireForm: HireCandidateRequest = {
    hireDate: '',
    managerProfile: false,
    notes: null,
  };

  readonly resolvedContractTypeCode = computed(() => {
    // const c = this.candidate();
    // if (!c?.employmentTypeId) return 'CDI';
    // const et = this.employmentTypes().find((v) => v.id === c.employmentTypeId);
    // if (!et) return c.employmentTypeLabel ?? 'CDI';
    // return CONTRACT_CODE_MAP[et.valueCode] ?? et.valueCode;
  });

  readonly requiresEndDate = computed(
    () =>
      // NEEDS_END_DATE.includes(this.resolvedContractTypeCode()),
      false,
  );

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

  ngOnInit(): void {
    this.candidateId = +(this.route.snapshot.paramMap.get('id') ?? 0);
    this.loadCandidate();
  }

  openHireModal(): void {
    const c = this.candidate();
    if (!c) return;
    this.hireForm = { hireDate: '', managerProfile: false, notes: null };
    this.hireError.set(null);
    this.listSvc
      .getListValues('EMPLOYMENT_TYPE', c.paysId)
      .subscribe({ next: (v) => this.employmentTypes.set(v), error: () => {} });
    this.showHireModal.set(true);
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

    const dto: HireCandidateRequest = {
      hireDate: this.hireForm.hireDate,
      // contractTypeCode: this.resolvedContractTypeCode() || undefined,
      dateFinPrevue: this.hireForm.dateFinPrevue || undefined,
      managerProfile: this.hireForm.managerProfile,
      notes: this.hireForm.notes || null,
    };

    this.candidateService.hireCandidate(this.candidateId, dto).subscribe({
      next: (res) => {
        this.hireLoading.set(false);
        this.showHireModal.set(false);
        this.router.navigate(['/hr/profiles', res.employeeProfileId]);
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
    this.router.navigate(['/it-provisioning', provId]);
  }

  goToOnboarding(): void {
    this.router.navigate(['/onboarding', this.candidateId]);
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

  contractLabel(type: string | null): string {
    const map: Record<string, string> = {
      PERMANENT: 'CDI',
      FIXED_TERM: 'CDD',
      INTERN: 'Stage',
      CONSULTANT: 'Consultant',
    };
    return type ? (map[type] ?? type) : '—';
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
