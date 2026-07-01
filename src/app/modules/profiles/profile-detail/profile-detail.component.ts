import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  FormFieldComponent, SelectComponent, ButtonComponent, SectionTitleComponent, MultiDatePickerComponent,
} from '@khalilrebhiitec/daf360';

import { ProfileService }           from '../profile.service';
import { ContractHistoryService }   from '../contract-history/contract-history.service';
import { ProfileDetailService }     from '../services/profile-detail.service';
import { RegimeService }            from '../../admin/regimes/regime.service';
import { RefDataService }           from '../../../core/ref/ref-data.service';
import { ContractLifecycleService } from '../lifecycle/contract-lifecycle.service';
import { PdfDownloadService, GeneratedDocumentResponse } from '../../../core/pdf/pdf-download.service';
import { UserStore }                from '../../../core/user.store';

import {
  EmployeeProfile, EmployeeDocument,
  LifecycleStatus, LIFECYCLE_TRANSITIONS, LIFECYCLE_LABELS,
  ProfileUpdateDto,
} from '../models/profile.model';
import { ContractHistoryDto }  from '../contract-history/contract-history.model';
import {
  ContractListDto, ContractDetailDto, ContractTransitionHistoryDto,
} from '../lifecycle/contract-lifecycle.model';
import { ResolvedRegimeDto }   from '../../admin/regimes/regime.model';
import { RefDataItem }         from '../../../core/ref/ref-data.model';
import type { LeaveBalanceDto, LeaveHistoryDto } from '../services/profile-detail.service';

import { ProfileHeaderComponent }       from './components/profile-header/profile-header.component';
import { ProfileSidebarInfoComponent }  from './components/profile-sidebar-info/profile-sidebar-info.component';
import { ProfileInfoTabComponent }      from './components/profile-info-tab/profile-info-tab.component';
import { ProfileContractTabComponent }  from './components/profile-contract-tab/profile-contract-tab.component';
import { ProfileDocumentsTabComponent } from './components/profile-documents-tab/profile-documents-tab.component';
import { ProfileLeavesTabComponent }    from './components/profile-leaves-tab/profile-leaves-tab.component';
import { ModalComponent }               from '../../../shared/modal.component';
import { NewContractFormComponent }     from '../lifecycle/new-contract-form.component';

type TabId = 'info' | 'contrat' | 'documents' | 'conges';

@Component({
  selector: 'rh-profile-detail',
  standalone: true,
  imports: [
    FormFieldComponent,
    SelectComponent,
    ButtonComponent,
    SectionTitleComponent,
    MultiDatePickerComponent,
    ProfileHeaderComponent,
    ProfileSidebarInfoComponent,
    ProfileInfoTabComponent,
    ProfileContractTabComponent,
    ProfileDocumentsTabComponent,
    ProfileLeavesTabComponent,
    ModalComponent,
    NewContractFormComponent,
  ],
  templateUrl: './profile-detail.component.html',
  styles: [`
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 4px; }
    .col2 { grid-column: span 2; }
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fee2e2; border: 1px solid #fca5a5; border-radius: 8px;
      padding: 10px 14px; font-size: 13px; color: #991b1b; margin-bottom: 12px;
    }
  `],
})
export class ProfileDetailComponent implements OnInit {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private profileSvc  = inject(ProfileService);
  private contractSvc = inject(ContractHistoryService);
  private detailSvc   = inject(ProfileDetailService);
  private regimeSvc   = inject(RegimeService);
  private refSvc      = inject(RefDataService);
  private lcSvc       = inject(ContractLifecycleService);
  private pdfSvc      = inject(PdfDownloadService);
  readonly userStore  = inject(UserStore);

  // ── Data ──────────────────────────────────────────────────────────────────
  profile       = signal<EmployeeProfile | null>(null);
  contracts     = signal<ContractHistoryDto[]>([]);
  documents     = signal<EmployeeDocument[]>([]);
  leaveBalances = signal<LeaveBalanceDto[]>([]);
  leaveHistory  = signal<LeaveHistoryDto[]>([]);
  generatedDocs = signal<GeneratedDocumentResponse[]>([]);
  loading       = signal(true);
  activeTab     = signal<TabId>('info');
  profileId     = signal<number>(0);

  // ── Edit ──────────────────────────────────────────────────────────────────
  editMode      = signal(false);
  saving        = signal(false);
  editSaveError = signal<string | null>(null);
  editForm: ProfileUpdateDto = { reason: '' };

  // ── Ref data for edit dropdowns ───────────────────────────────────────────
  grades        = signal<RefDataItem[]>([]);
  disciplines   = signal<RefDataItem[]>([]);
  nogLevels     = signal<RefDataItem[]>([]);
  departments   = signal<RefDataItem[]>([]);
  banks         = signal<RefDataItem[]>([]);
  nationalities = signal<RefDataItem[]>([]);

  // ── Photo ─────────────────────────────────────────────────────────────────
  photoUploading = signal(false);
  photoError     = signal<string | null>(null);

  // ── Lifecycle transition ──────────────────────────────────────────────────
  showTransitionModal = signal(false);
  transitionTarget    = signal<LifecycleStatus | null>(null);
  transitionReason    = '';

  // ── Regime ───────────────────────────────────────────────────────────────
  resolvedRegime  = signal<ResolvedRegimeDto | null>(null);
  isLoadingRegime = signal(false);

  // ── Contract lifecycle ────────────────────────────────────────────────────
  lcContracts = signal<ContractListDto[]>([]);
  lcHistory   = signal<ContractTransitionHistoryDto[]>([]);
  lcLoading   = signal(false);
  lcSaving    = signal(false);
  lcError     = signal<string | null>(null);
  private lcLoaded = false;

  showNewContractModal   = signal(false);
  showValidateTrialModal = signal(false);
  showRenewCDDModal      = signal(false);
  showConvertCDIModal    = signal(false);

  selectedContractId: number | null = null;
  trialApproved   = true;
  trialComment    = '';
  renewDateFin    = '';
  renewComment    = '';
  cdiStartDate    = '';
  cdiComment      = '';

  // ── Tabs ──────────────────────────────────────────────────────────────────
  readonly tabs = [
    { id: 'info'      as TabId, label: 'Informations' },
    { id: 'contrat'   as TabId, label: 'Contrat & Salaire' },
    { id: 'documents' as TabId, label: 'Documents' },
    { id: 'conges'    as TabId, label: 'Congés' },
  ];

  // ── Permissions ───────────────────────────────────────────────────────────
  canEdit          = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  canViewSensitive = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());
  canTransition    = computed(() =>
    this.profile() !== null &&
    this.allowedTransitions().length > 0 &&
    (this.userStore.isHrManager() || this.userStore.isAdmin()),
  );

  allowedTransitions = computed((): LifecycleStatus[] => {
    const p = this.profile();
    return p ? (LIFECYCLE_TRANSITIONS[p.lifecycleStatus] ?? []) : [];
  });

  // ── daf-select option arrays ───────────────────────────────────────────────
  readonly genderOpts = [
    { value: 'MASCULIN', label: 'Masculin' },
    { value: 'FEMININ', label: 'Féminin' },
  ];
  readonly contractTypeOpts = [
    { value: 'CDI',         label: 'CDI' },
    { value: 'CDD',         label: 'CDD' },
    { value: 'CIVP',        label: 'CIVP' },
    { value: 'STAGE',       label: 'Stage' },
    { value: 'DETACHEMENT', label: 'Détachement' },
    { value: 'PORTAGE',     label: 'Portage' },
  ];
  nationalityOpts = computed(() => this.nationalities().map(n => ({ value: n.id.toString(), label: n.labelFr })));
  departmentOpts  = computed(() => this.departments().map(d => ({ value: d.id.toString(), label: d.labelFr })));
  gradeOpts       = computed(() => this.grades().map(g => ({ value: g.id.toString(), label: g.labelFr })));
  disciplineOpts  = computed(() => this.disciplines().map(d => ({ value: d.id.toString(), label: d.labelFr })));
  nogLevelOpts    = computed(() => this.nogLevels().map(n => ({ value: n.id.toString(), label: n.labelFr })));
  bankOpts        = computed(() => this.banks().map(b => ({ value: b.id.toString(), label: b.labelFr })));
  transitionOpts  = computed(() => this.allowedTransitions().map(t => ({ value: t, label: this.lifecycleLabel(t) })));

  lifecycleLabel(s: LifecycleStatus): string {
    return LIFECYCLE_LABELS[s] ?? s;
  }

  onTransitionSelect(sel: string[]): void {
    this.transitionTarget.set((sel[0] ?? null) as LifecycleStatus | null);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.profileId.set(id);
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    forkJoin({
      profile:   this.profileSvc.getById(this.profileId()),
      contracts: this.contractSvc.getHistory(this.profileId()),
      documents: this.profileSvc.listDocuments(this.profileId()).pipe(catchError(() => of([]))),
      balances:  this.detailSvc.getLeaveBalances(this.profileId(), new Date().getFullYear()).pipe(catchError(() => of([]))),
      history:   this.detailSvc.getLeaveHistory(this.profileId()).pipe(catchError(() => of([]))),
    }).subscribe({
      next: data => {
        this.profile.set(data.profile);
        this.contracts.set(data.contracts);
        this.documents.set(data.documents);
        this.leaveBalances.set(data.balances);
        this.leaveHistory.set(data.history);
        this.loading.set(false);
        this.loadResolvedRegime(data.profile.id);
        this.pdfSvc
          .generateDocument('/api/hr/documents/by-profile/' + data.profile.id, null)
          .subscribe({ next: (docs: any) => this.generatedDocs.set(docs), error: () => {} });
      },
      error: () => this.loading.set(false),
    });
  }

  onTabChange(tab: TabId): void {
    this.activeTab.set(tab);
    if (tab === 'contrat') this.loadContracts();
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  startEdit(): void {
    const p = this.profile();
    if (!p) return;
    this.initEditForm();
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

  initEditForm(): void {
    const p = this.profile();
    if (!p) return;
    this.editForm = {
      reason:                   '',
      dateOfBirth:              p.dateOfBirth ?? '',
      gender:                   p.gender ?? '',
      nationalityId:            p.nationalityId ?? null,
      nationalId:               p.nationalId ?? '',
      passportNumber:           p.passportNumber ?? '',
      hireDate:                 p.hireDate ?? '',
      contractType:             p.contractType ?? '',
      contractEndDate:          p.contractEndDate ?? '',
      probationEndDate:         p.probationEndDate ?? '',
      isOnProbation:            p.isOnProbation ?? false,
      departmentId:             p.departmentId ?? null,
      gradeId:                  p.gradeId ?? null,
      disciplineId:             p.disciplineId ?? null,
      nogLevelId:               p.nogLevelId ?? null,
      personalEmail:            p.personalEmail ?? '',
      phone:                    p.phone ?? '',
      personalAddress:          p.personalAddress ?? '',
      emergencyContactName:     p.emergencyContactName ?? '',
      emergencyContactRelation: p.emergencyContactRelation ?? '',
      emergencyContactPhone:    p.emergencyContactPhone ?? '',
      bankId:                   p.bankId ?? null,
      iban:                     p.iban ?? '',
      bankAccountNumber:        p.bankAccountNumber ?? '',
      rib:                      p.rib ?? '',
      socialSecurityNumber:     p.socialSecurityNumber ?? '',
      taxId:                    p.taxId ?? '',
      salaireNetCandidat:       p.salaireNetCandidat ?? null,
      salaireNetRh:             p.salaireNetRh ?? null,
    };
  }

  cancelEdit(): void {
    this.editMode.set(false);
    this.editSaveError.set(null);
  }

  saveProfile(): void {
    if (!this.editForm.reason?.trim()) {
      this.editSaveError.set('La raison de modification est obligatoire.');
      return;
    }
    this.saving.set(true);
    this.editSaveError.set(null);
    const dto: ProfileUpdateDto = { ...this.editForm };
    Object.keys(dto).forEach(k => {
      if (k !== 'reason' && (dto as any)[k] === '') (dto as any)[k] = undefined;
    });
    this.profileSvc.update(this.profileId(), dto)
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

  // ── Photo ─────────────────────────────────────────────────────────────────
  onPhotoChange(file: File): void {
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
    this.profileSvc.uploadPhoto(this.profileId(), file).subscribe({
      next: updated => { this.profile.set(updated); this.photoUploading.set(false); },
      error: err => {
        this.photoUploading.set(false);
        this.photoError.set(err?.error?.message ?? 'Erreur lors du téléversement.');
      },
    });
  }

  // ── Lifecycle transition ──────────────────────────────────────────────────
  openTransitionModal(): void {
    this.transitionTarget.set(null);
    this.transitionReason = '';
    this.showTransitionModal.set(true);
  }

  confirmTransition(): void {
    const target = this.transitionTarget();
    if (!target || !this.transitionReason.trim()) return;
    this.saving.set(true);
    this.profileSvc
      .transition(this.profileId(), { newStatus: target, reason: this.transitionReason })
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.saving.set(false);
        if (updated) {
          this.profile.set(updated);
          this.showTransitionModal.set(false);
        }
      });
  }

  // ── Regime ───────────────────────────────────────────────────────────────
  loadResolvedRegime(id: number): void {
    this.isLoadingRegime.set(true);
    this.regimeSvc.resolveForEmployee(id).subscribe({
      next: r => { this.resolvedRegime.set(r); this.isLoadingRegime.set(false); },
      error: () => this.isLoadingRegime.set(false),
    });
  }

  removeEmployeeRegimeOverride(): void {
    const p = this.profile();
    if (!p || !confirm("Supprimer l'override de régime et revenir au régime du rôle ?")) return;
    this.regimeSvc.removeEmployeeOverride(p.id).subscribe({
      next: () => this.loadResolvedRegime(p.id),
      error: () => {},
    });
  }

  // ── Contract lifecycle ────────────────────────────────────────────────────
  loadContracts(): void {
    if (this.lcLoaded) return;
    this.lcLoaded = true;
    this.lcLoading.set(true);
    this.lcSvc.getContracts(this.profileId())
      .pipe(catchError(() => of([])))
      .subscribe(cs => { this.lcContracts.set(cs); this.lcLoading.set(false); });
    this.lcSvc.getLifecycleHistory(this.profileId())
      .pipe(catchError(() => of([])))
      .subscribe(h => this.lcHistory.set(h));
  }

  onContractCreated(_contract: ContractDetailDto): void {
    this.showNewContractModal.set(false);
    this.lcLoaded = false;
    this.loadContracts();
  }

  openValidateTrialModal(contractId: number): void {
    this.selectedContractId = contractId;
    this.trialApproved = true;
    this.trialComment = '';
    this.lcError.set(null);
    this.showValidateTrialModal.set(true);
  }

  confirmValidateTrial(): void {
    if (this.selectedContractId === null) return;
    this.lcSaving.set(true);
    this.lcSvc.validateTrial(this.selectedContractId, {
      approved: this.trialApproved,
      commentaire: this.trialComment || null,
    }).pipe(catchError(err => {
      this.lcError.set(err?.error?.message ?? 'Erreur.');
      this.lcSaving.set(false);
      return of(null);
    })).subscribe(r => {
      if (r) {
        this.showValidateTrialModal.set(false);
        this.lcSaving.set(false);
        this.lcLoaded = false;
        this.loadContracts();
      }
    });
  }

  openRenewCDDModal(contractId: number): void {
    this.selectedContractId = contractId;
    this.renewDateFin = '';
    this.renewComment = '';
    this.lcError.set(null);
    this.showRenewCDDModal.set(true);
  }

  confirmRenewCDD(): void {
    if (this.selectedContractId === null || !this.renewDateFin) {
      this.lcError.set('La nouvelle date de fin est obligatoire.');
      return;
    }
    this.lcSaving.set(true);
    this.lcSvc.renewCDD(this.selectedContractId, {
      newDateFin: this.renewDateFin,
      commentaire: this.renewComment || null,
    }).pipe(catchError(err => {
      this.lcError.set(err?.error?.message ?? 'Erreur.');
      this.lcSaving.set(false);
      return of(null);
    })).subscribe(r => {
      if (r) {
        this.showRenewCDDModal.set(false);
        this.lcSaving.set(false);
        this.lcLoaded = false;
        this.loadContracts();
      }
    });
  }

  openConvertCDIModal(contractId: number): void {
    this.selectedContractId = contractId;
    this.cdiStartDate = '';
    this.cdiComment = '';
    this.lcError.set(null);
    this.showConvertCDIModal.set(true);
  }

  confirmConvertCDI(): void {
    if (this.selectedContractId === null || !this.cdiStartDate) {
      this.lcError.set('La date de début CDI est obligatoire.');
      return;
    }
    this.lcSaving.set(true);
    this.lcSvc.convertToCDI(this.selectedContractId, {
      cdiStartDate: this.cdiStartDate,
      commentaire: this.cdiComment || null,
    }).pipe(catchError(err => {
      this.lcError.set(err?.error?.message ?? 'Erreur.');
      this.lcSaving.set(false);
      return of(null);
    })).subscribe(r => {
      if (r) {
        this.showConvertCDIModal.set(false);
        this.lcSaving.set(false);
        this.lcLoaded = false;
        this.loadContracts();
      }
    });
  }

  daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  }

  // ── Date helpers for daf-multi-date-picker ───────────────────────────────
  toDate(iso: string | null | undefined): Date | null {
    if (!iso) return null;
    return new Date(iso);
  }

  fromDate(d: Date | Date[] | null | undefined): string {
    if (!d) return '';
    if (Array.isArray(d)) return d.length > 0 ? d[0].toISOString().split('T')[0] : '';
    return (d as Date).toISOString().split('T')[0];
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  onBack(): void { this.router.navigate(['/rh/profiles']); }
}
