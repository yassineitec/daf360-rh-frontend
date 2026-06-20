import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink }           from '@angular/router';
import { FormsModule }                                   from '@angular/forms';

import { CandidateService }        from './candidate.service';
import { CandidateDetail, HireCandidateRequest } from './candidate.model';
import { CandidateFormComponent }  from './candidate-form.component';
import { RejectModalComponent }    from './reject-modal.component';
import { StatusBadgeComponent }    from '../../shared/status-badge.component';
import { SpinnerComponent }        from '../../shared/spinner.component';
import { UserStore }               from '../../core/user.store';
import { PermissionDirective }     from '../../shared/permission.directive';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue }               from '../../core/lists/configurable-list.model';

const HIREABLE_STATUSES = ['ACCEPTED', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS'];
const NEEDS_END_DATE    = ['CDD', 'CIVP', 'STAGE', 'DETACHEMENT'];
const CONTRACT_CODE_MAP: Record<string, string> = {
  CDI: 'CDI', CDD: 'CDD', CIVP: 'CIVP', STAGE: 'STAGE',
  FREELANCE: 'PORTAGE', PORTAGE: 'PORTAGE', DETACHEMENT: 'DETACHEMENT',
};

@Component({
  selector: 'app-candidate-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    StatusBadgeComponent,
    SpinnerComponent,
    CandidateFormComponent,
    RejectModalComponent,
    PermissionDirective,
  ],
  templateUrl: './candidate-detail.component.html',
  styleUrls: ['./candidate-detail.component.scss'],
})
export class CandidateDetailComponent implements OnInit {

  private readonly candidateService = inject(CandidateService);
  private readonly route            = inject(ActivatedRoute);
  private readonly router           = inject(Router);
  private readonly listSvc          = inject(ConfigurableListService);
  readonly userStore                = inject(UserStore);

  candidate    = signal<CandidateDetail | null>(null);
  loading      = signal(true);
  error        = signal<string | null>(null);
  showForm     = signal(false);
  showReject   = signal(false);

  // ── Hire modal state ──────────────────────────────────────────────────────
  showHireModal  = signal(false);
  hireLoading    = signal(false);
  hireError      = signal<string | null>(null);
  employmentTypes = signal<ListValue[]>([]);

  hireForm: HireCandidateRequest = {
    hireDate: '',
    managerProfile: false,
    notes: null,
  };

  readonly resolvedContractTypeCode = computed(() => {
    const c = this.candidate();
    if (!c?.employmentTypeId) return 'CDI';
    const et = this.employmentTypes().find(v => v.id === c.employmentTypeId);
    if (!et) return c.employmentTypeLabel ?? 'CDI';
    return CONTRACT_CODE_MAP[et.valueCode] ?? et.valueCode;
  });

  readonly requiresEndDate = computed(() =>
    NEEDS_END_DATE.includes(this.resolvedContractTypeCode())
  );

  readonly canHire = computed(() =>
    this.userStore.hasPermission('RH_HIRE_CANDIDATE')
  );

  readonly canHireThisCandidate = computed(() => {
    const c = this.candidate();
    return c !== null && HIREABLE_STATUSES.includes(c.status) && this.canHire();
  });

  // ── CV upload state ───────────────────────────────────────────────────────
  cvUploading  = signal(false);
  cvError      = signal<string | null>(null);
  cvSuccess    = signal<string | null>(null);

  private candidateId = 0;

  readonly canAcceptReject = computed(() =>
    this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'),
  );

  readonly canEdit = computed(() =>
    this.userStore.hasPermission('EDIT_CANDIDATE'),
  );

  readonly showItSection = computed(() => {
    const c = this.candidate();
    const noProvisioning: string[] = ['PENDING', 'REJECTED'];
    return c !== null && !noProvisioning.includes(c.status);
  });

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    if (!rawId || rawId === 'new') {
      this.loading.set(false);
      this.showForm.set(true);
      return;
    }
    this.candidateId = +rawId;
    this.loadCandidate();
  }

  openHireModal(): void {
    const c = this.candidate();
    if (!c) return;
    this.hireForm = { hireDate: '', managerProfile: false, notes: null };
    this.hireError.set(null);
    this.listSvc.getListValues('EMPLOYMENT_TYPE', c.paysId)
      .subscribe({ next: v => this.employmentTypes.set(v), error: () => {} });
    this.showHireModal.set(true);
  }

  confirmHire(): void {
    if (!this.hireForm.hireDate) {
      this.hireError.set('La date d\'embauche est obligatoire.');
      return;
    }
    if (this.requiresEndDate() && !this.hireForm.dateFinPrevue) {
      this.hireError.set('La date de fin est obligatoire pour ce type de contrat.');
      return;
    }
    this.hireLoading.set(true);
    this.hireError.set(null);

    const dto: HireCandidateRequest = {
      hireDate:          this.hireForm.hireDate,
      contractTypeCode:  this.resolvedContractTypeCode() || undefined,
      dateFinPrevue:     this.hireForm.dateFinPrevue   || undefined,
      managerProfile:    this.hireForm.managerProfile,
      notes:             this.hireForm.notes            || null,
    };

    this.candidateService.hireCandidate(this.candidateId, dto).subscribe({
      next: (res) => {
        this.hireLoading.set(false);
        this.showHireModal.set(false);
        this.router.navigate(['/hr/profiles', res.employeeProfileId]);
      },
      error: (err) => {
        this.hireLoading.set(false);
        this.hireError.set(err?.error?.detail ?? err?.error?.message ?? 'Erreur lors de l\'embauche.');
      },
    });
  }

  private loadCandidate(): void {
    this.loading.set(true);
    this.error.set(null);

    this.candidateService
      .getById(this.candidateId)
      .subscribe({
        next: (data) => {
          this.candidate.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(
            err?.error?.message ?? 'Impossible de charger le candidat.',
          );
          this.loading.set(false);
        },
      });
  }

  onAccept(): void {
    this.candidateService.accept(this.candidateId).subscribe({
      next: () => this.loadCandidate(),
      error: (err) =>
        this.error.set(err?.error?.message ?? 'Erreur lors de l\'acceptation.'),
    });
  }

  onFormClosed(): void {
    this.showForm.set(false);
    if (!this.candidateId) {
      this.router.navigate(['/hr/candidates']);
    }
  }

  onFormSaved(): void {
    this.showForm.set(false);
    if (!this.candidateId) {
      this.router.navigate(['/hr/candidates']);
      return;
    }
    this.loadCandidate();
  }

  onRejected(): void {
    this.showReject.set(false);
    this.loadCandidate();
  }

  readonly canManageIt = computed(() =>
    this.userStore.hasPermission('IT_PROVISIONING'),
  );

  readonly canOnboard = computed(() =>
    this.userStore.hasPermission('HR_ONBOARDING'),
  );

  goBack(): void {
    this.router.navigate(['/hr/candidates']);
  }

  goToProvisioning(provId: number): void {
    this.router.navigate(['/hr/it-provisioning', provId]);
  }

  goToOnboarding(): void {
    this.router.navigate(['/hr/onboarding', this.candidateId]);
  }

  // ── CV ────────────────────────────────────────────────────────────────────

  onCvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    const allowed = ['application/pdf',
                     'application/msword',
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
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
        setTimeout(() => this.cvSuccess.set(null), 4000);
        // Reset file input so the same file can be re-uploaded if needed
        input.value = '';
      },
      error: (err) => {
        this.cvUploading.set(false);
        this.cvError.set(err?.error?.detail ?? err?.error?.message ?? 'Erreur lors du téléversement.');
      },
    });
  }

  downloadCv(): void {
    window.open(this.candidateService.cvDownloadUrl(this.candidateId), '_blank');
  }
}
