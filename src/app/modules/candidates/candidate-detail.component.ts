import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CandidateService }     from './candidate.service';
import { CandidateDetail }      from './candidate.model';
import { RejectModalComponent } from './reject-modal.component';
import { StatusBadgeComponent, ButtonComponent } from '@khalilrebhiitec/daf360';
import { statusBadge }            from '../../shared/status-badge.utils';
import { UserStore }              from '../../core/user.store';

@Component({
  selector: 'app-candidate-detail',
  standalone: true,
  imports: [
    StatusBadgeComponent,
    ButtonComponent,
    RejectModalComponent,
  ],
  templateUrl: './candidate-detail.component.html',
})
export class CandidateDetailComponent implements OnInit {

  private readonly candidateService = inject(CandidateService);
  private readonly route            = inject(ActivatedRoute);
  protected readonly router         = inject(Router);
  readonly userStore                = inject(UserStore);

  candidate  = signal<CandidateDetail | null>(null);
  loading    = signal(true);
  error      = signal<string | null>(null);
  showReject = signal(false);

  cvUploading  = signal(false);
  cvError      = signal<string | null>(null);
  cvSuccess    = signal<string | null>(null);

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

  private loadCandidate(): void {
    this.loading.set(true);
    this.error.set(null);
    this.candidateService.getById(this.candidateId).subscribe({
      next:  data => { this.candidate.set(data); this.loading.set(false); },
      error: err  => { this.error.set(err?.error?.message ?? 'Impossible de charger le candidat.'); this.loading.set(false); },
    });
  }

  onAccept(): void {
    this.candidateService.accept(this.candidateId).subscribe({
      next:  () => this.loadCandidate(),
      error: err => this.error.set(err?.error?.message ?? 'Erreur lors de l\'acceptation.'),
    });
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

  goToProvisioning(provId: number): void {
    this.router.navigate(['/it-provisioning', provId]);
  }

  goToOnboarding(): void {
    this.router.navigate(['/onboarding', this.candidateId]);
  }

  onCvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.type)) { this.cvError.set('Format non supporté — PDF, DOC ou DOCX uniquement'); return; }
    if (file.size > 10 * 1024 * 1024) { this.cvError.set('Fichier trop volumineux — max 10 Mo'); return; }

    this.cvError.set(null);
    this.cvSuccess.set(null);
    this.cvUploading.set(true);

    this.candidateService.uploadCv(this.candidateId, file).subscribe({
      next: updated => {
        this.candidate.set(updated);
        this.cvUploading.set(false);
        this.cvSuccess.set(`CV "${file.name}" téléversé avec succès.`);
        input.value = '';
        setTimeout(() => this.cvSuccess.set(null), 4000);
      },
      error: err => {
        this.cvUploading.set(false);
        this.cvError.set(err?.error?.detail ?? err?.error?.message ?? 'Erreur lors du téléversement.');
      },
    });
  }

  downloadCv(): void {
    window.open(this.candidateService.cvDownloadUrl(this.candidateId), '_blank');
  }
}
