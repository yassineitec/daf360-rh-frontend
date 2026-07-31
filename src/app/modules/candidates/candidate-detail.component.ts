import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BreadcrumbItem,
  ButtonComponent,
  PageComponent,
  PageHeaderBadge,
  PageHeaderComponent,
  TabItem,
  TabsComponent,
} from '@khalilrebhiitec/daf360';

import { UserStore } from '../../core/user.store';
import { statusBadge } from '../../shared/status-badge.utils';
import { CandidateService } from './candidate.service';
import { CandidateDetail, HireCandidateRequest } from './candidate.model';
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
 * /rh/candidates/:id — the candidate record, laid out like `/rh/profiles/:id`
 * (UI-PLAYBOOK §1 + §10f): `daf-page` (`kpis="0"`, `breadcrumbs`) +
 * `daf-page-header`, then a **sticky left identity column** and a right column of
 * `daf-tabs`, one tab per section of the record.
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
  readonly userStore = inject(UserStore);

  private candidateId = 0;

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly candidate = signal<CandidateDetail | null>(null);
  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad = signal(true);
  readonly error     = signal<string | null>(null);

  // ── Permissions ────────────────────────────────────────────────────────────
  readonly canAcceptReject = computed(() => this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'));
  readonly canHire         = computed(() => this.userStore.hasPermission('RH_HIRE_CANDIDATE'));
  readonly canManageIt     = computed(() => this.userStore.hasPermission('IT_PROVISIONING'));
  readonly canOnboard      = computed(() => this.userStore.hasPermission('HR_ONBOARDING'));

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
  readonly activeTab = signal<TabId>('profil');

  /**
   * Tabs are **filtered out**, never disabled: a greyed "Rémunération" tab still
   * advertises that budget data exists. Which is also why the set depends on the
   * candidate's status — an interview tab on a rejected candidate is noise.
   */
  readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const items: TabItem[] = [{ id: 'profil', label: t('CANDIDATES.DETAIL.TABS.PROFILE') }];
    if (this.canViewSalary())         items.push({ id: 'salaire',    label: t('CANDIDATES.DETAIL.TABS.SALARY')     });
    if (this.showInterviewsSection()) items.push({ id: 'entretiens', label: t('CANDIDATES.DETAIL.TABS.INTERVIEWS') });
    if (this.showOfferSection())      items.push({ id: 'offre',      label: t('CANDIDATES.DETAIL.TABS.OFFER')      });
    items.push({ id: 'cv', label: t('CANDIDATES.DETAIL.TABS.CV') });
    if (this.showItSection())         items.push({ id: 'it',         label: t('CANDIDATES.DETAIL.TABS.IT')         });
    return items;
  });

  onTabChange(id: string): void {
    this.activeTab.set(id as TabId);
    // Shareable + survives a refresh or a back navigation.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.candidateId = +(this.route.snapshot.paramMap.get('id') ?? 0);
    const tab = this.route.snapshot.queryParamMap.get('tab') as TabId | null;
    if (tab) this.activeTab.set(tab); // daf-tabs falls back to the first tab if it isn't one
    this.loadCandidate();
  }

  private loadCandidate(): void {
    this.error.set(null);
    this.candidateService.getById(this.candidateId).subscribe({
      next: data => {
        this.candidate.set(data);
        this.salaryNetRh.set(data.salaireNetRh ?? null);
        this.salaryNetCandidat.set(data.salaireNetCandidat ?? null);
        this.firstLoad.set(false);
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
