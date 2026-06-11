import {
  Component, computed, inject, input, OnInit, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass, SlicePipe } from '@angular/common';
import { catchError, of } from 'rxjs';

import { ProfileService } from './profile.service';
import {
  EmployeeDocument, EmployeeProfile,
  LifecycleStatus, LIFECYCLE_TRANSITIONS, LIFECYCLE_LABELS,
  ProfileUpdateDto,
} from './models/profile.model';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { SpinnerComponent }     from '../../shared/spinner.component';
import { ModalComponent }       from '../../shared/modal.component';
import { UserStore }            from '../../core/user.store';
import { PdfDownloadButtonComponent } from '../../shared/pdf-download-button/pdf-download-button.component';
import { PdfDownloadService, GeneratedDocumentResponse } from '../../core/pdf/pdf-download.service';
import { RegimeService } from '../admin/regimes/regime.service';
import { ResolvedRegimeDto } from '../admin/regimes/regime.model';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem } from '../../core/ref/ref-data.model';
import { ContractHistoryComponent } from './contract-history/contract-history.component';

// ─────────────────────────────────────────────────────────────────────────────
// Reusable field display — defined here for colocation, imported below.
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
  styles: [`
    .field        { display: flex; flex-direction: column; gap: 2px; }
    .field-wide   { grid-column: span 2; }
    .field-label  { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--color-text-muted, #6B7280); }
    .field-value  { font-size: 13px; color: var(--color-text, #1A1C1E); }
  `],
})
export class FieldComponent {
  label = input.required<string>();
  value = input<string | null | undefined>(null);
  wide  = input(false);
}

type SectionKey = 'identite' | 'emploi' | 'poste' | 'regime' | 'contact' | 'urgence' | 'bancaire' | 'contrats' | 'documents';

// ─────────────────────────────────────────────────────────────────────────────
// Profile Detail
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-profile-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass, SlicePipe, StatusBadgeComponent, SpinnerComponent, ModalComponent, FieldComponent, PdfDownloadButtonComponent, ContractHistoryComponent],
  templateUrl: './profile-detail.component.html',
  styleUrl:    './profile-detail.component.scss',
})
export class ProfileDetailComponent implements OnInit {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private svc        = inject(ProfileService);
  private userStore  = inject(UserStore);
  private pdfSvc     = inject(PdfDownloadService);
  private regimeSvc  = inject(RegimeService);
  private refSvc     = inject(RefDataService);

  profileId = 0;

  // ── State ──────────────────────────────────────────────────────────────────
  loading      = signal(true);
  saving       = signal(false);
  docsLoading  = signal(false);
  profile      = signal<EmployeeProfile | null>(null);
  documents    = signal<EmployeeDocument[]>([]);
  generatedDocs = signal<GeneratedDocumentResponse[]>([]);
  editMode    = signal(false);
  editForm: ProfileUpdateDto = { reason: '' };
  editSaveError = signal<string | null>(null);
  showTransitionModal = signal(false);

  // ── Ref data lists for edit dropdowns ─────────────────────────────────────
  grades        = signal<RefDataItem[]>([]);
  disciplines   = signal<RefDataItem[]>([]);
  nogLevels     = signal<RefDataItem[]>([]);
  departments   = signal<RefDataItem[]>([]);
  banks         = signal<RefDataItem[]>([]);
  nationalities = signal<RefDataItem[]>([]);

  resolvedRegime  = signal<ResolvedRegimeDto | null>(null);
  isLoadingRegime = signal(true);
  showRegimeModal = signal(false);

  photoUploading = signal(false);
  photoError     = signal<string | null>(null);

  transitionTarget = signal<LifecycleStatus | null>(null);
  transitionReason = '';
  uploadType       = 'CONTRACT';

  readonly docTypes = ['CONTRACT', 'ID_CARD', 'DIPLOMA', 'MEDICAL_CERTIFICATE', 'RIB', 'RESIGNATION', 'OTHER'];

  private openSections = signal<Set<SectionKey>>(
    new Set<SectionKey>(['identite', 'emploi', 'poste', 'contact'])
  );

  open(k: SectionKey)   { return this.openSections().has(k); }
  toggle(k: SectionKey) {
    this.openSections.update(s => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  // ── Permissions ────────────────────────────────────────────────────────────
  canEdit          = computed(() => this.userStore.isHrManager());
  canViewSensitive = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  canTransition    = computed(() =>
    this.profile() !== null && this.allowedTransitions().length > 0 && this.userStore.isHrManager()
  );

  allowedTransitions = computed((): LifecycleStatus[] => {
    const p = this.profile();
    return p ? (LIFECYCLE_TRANSITIONS[p.lifecycleStatus] ?? []) : [];
  });

  lifecycleLabel(s: LifecycleStatus) { return LIFECYCLE_LABELS[s] ?? s; }

  // ── Date helper ────────────────────────────────────────────────────────────
  fmt(iso: string | null | undefined): string | null {
    if (!iso) return null;
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.profileId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadProfile();
  }

  loadProfile() {
    this.loading.set(true);
    this.svc.getById(this.profileId).pipe(catchError(() => of(null)))
      .subscribe(p => {
        this.loading.set(false);
        this.profile.set(p);
        if (p) {
          this.loadResolvedRegime(p.id);
          this.pdfSvc.generateDocument('/api/hr/documents/by-profile/' + p.id, null)
            .subscribe({ next: (docs: any) => this.generatedDocs.set(docs), error: () => {} });
        }
      });
  }

  loadDocuments() {
    if (this.documents().length > 0) return;
    this.docsLoading.set(true);
    this.svc.listDocuments(this.profileId).pipe(catchError(() => of([])))
      .subscribe(docs => { this.docsLoading.set(false); this.documents.set(docs); });
  }

  // ── Lifecycle transition ────────────────────────────────────────────────────
  openTransitionModal() {
    this.transitionTarget.set(null);
    this.transitionReason = '';
    this.showTransitionModal.set(true);
  }

  confirmTransition() {
    const target = this.transitionTarget();
    if (!target || !this.transitionReason.trim()) return;
    this.saving.set(true);
    this.svc.transition(this.profileId, { newStatus: target, reason: this.transitionReason })
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.saving.set(false);
        if (updated) { this.profile.set(updated); this.showTransitionModal.set(false); }
      });
  }

  // ── Document upload ─────────────────────────────────────────────────────────
  onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.svc.uploadDocument(this.profileId, file, this.uploadType)
      .pipe(catchError(() => of(null)))
      .subscribe(doc => { if (doc) this.documents.update(d => [doc, ...d]); });
  }

  // ── Photo upload ────────────────────────────────────────────────────────────
  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    // Validate client-side
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.photoError.set('Format non supporté. Utilisez JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.photoError.set('Photo trop volumineuse (max 3 Mo).');
      return;
    }
    this.photoUploading.set(true);
    this.photoError.set(null);
    this.svc.uploadPhoto(this.profileId, file).subscribe({
      next: updated => {
        this.profile.set(updated);
        this.photoUploading.set(false);
      },
      error: err => {
        this.photoUploading.set(false);
        this.photoError.set(err?.error?.message ?? 'Erreur lors du téléversement.');
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
      next: r  => { this.resolvedRegime.set(r); this.isLoadingRegime.set(false); },
      error: () => this.isLoadingRegime.set(false),
    });
  }

  removeEmployeeRegimeOverride(): void {
    const p = this.profile();
    if (!p) return;
    if (!confirm('Supprimer l\'override de régime et revenir au régime du rôle ?')) return;
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
    this.refSvc.getGrades(paysId).subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines(paysId).subscribe(r => this.disciplines.set(r));
    this.refSvc.getNogLevels(paysId).subscribe(r => this.nogLevels.set(r));
    this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));
    this.refSvc.getBanks(paysId).subscribe(r => this.banks.set(r));
    this.refSvc.getNationalities().subscribe(r => this.nationalities.set(r));
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
      homeAddress: p.homeAddress ?? '',
      emergencyContactName: p.emergencyContactName ?? '',
      emergencyContactRelation: p.emergencyContactRelation ?? '',
      emergencyContactPhone: p.emergencyContactPhone ?? '',
      bankId: p.bankId ?? null,
      iban: p.iban ?? '',
      bankAccountNumber: p.bankAccountNumber ?? '',
      rib: p.rib ?? '',
      socialSecurityNumber: p.socialSecurityNumber ?? '',
      taxId: p.taxId ?? '',
      salaireNetCandidat: p.salaireNetCandidat ?? null,
      salaireNetRh:       p.salaireNetRh       ?? null,
    };
  }

  saveProfile(): void {
    if (!this.editForm.reason?.trim()) {
      this.editSaveError.set('La raison de modification est obligatoire.');
      return;
    }
    this.saving.set(true);
    this.editSaveError.set(null);
    const dto: ProfileUpdateDto = { ...this.editForm };
    // Convert empty strings to undefined for optional fields
    Object.keys(dto).forEach(k => {
      if (k !== 'reason' && (dto as any)[k] === '') (dto as any)[k] = undefined;
    });
    this.svc.update(this.profileId, dto)
      .pipe(catchError(err => {
        this.saving.set(false);
        this.editSaveError.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
        return of(null);
      }))
      .subscribe(updated => {
        if (updated) {
          this.profile.set(updated);
          this.editMode.set(false);
          this.saving.set(false);
          this.editSaveError.set(null);
        }
      });
  }
}
