import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import {
  BadgeCell,
  BadgeOptions,
  ButtonComponent,
  DafHasPermissionDirective,
  FilterField,
  FilterResult,
  MetricCardComponent,
  PageComponent,
  PageHeaderComponent,
  PaginationComponent,
  SearchToolbarComponent,
  SearchToolbarFilterConfig,
} from '@khalilrebhiitec/daf360';

import { ConfirmService } from '../../core/confirm.service';
import { UserStore } from '../../core/user.store';
import { statusBadge } from '../../shared/status-badge.utils';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem } from '../../core/ref/ref-data.model';
import { RecruitmentDemandService } from '../recruitment-demands/recruitment-demand.service';
import { ApprovedDemandOption } from '../recruitment-demands/recruitment-demand.model';
import { CandidateService } from './candidate.service';
import { RejectModalComponent } from './reject-modal.component';
import {
  CandidateHistoryItem,
  CandidateListItem,
  CandidateListQuery,
  CandidateStats,
  CandidateStatus,
  PageResponse,
} from './candidate.model';
import { CandidatesTableSectionComponent } from './sections/candidates-table-section.component';
import { CandidateDossierPanelComponent } from './sections/candidate-dossier-panel.component';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Candidate status codes, in workflow order, for the status filter. */
const STATUS_CODES: CandidateStatus[] = [
  'PENDING', 'ACCEPTED', 'OFFER_SENT', 'REJECTED', 'IT_IN_PROGRESS',
  'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED', 'ARCHIVED',
];

/** Demand filter value for "no recruitment demand" — never a real demand id. */
const SPONTANEOUS = 'SPONTANEOUS';

/** Local calendar day as `yyyy-MM-dd` — `toISOString()` would shift it to UTC. */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * /rh/candidates/list — the flat, server-paginated candidate register.
 *
 * Architecture follows UI-PLAYBOOK §1 + §8b: `daf-page` + `daf-page-header` +
 * the KPI row + `daf-search-toolbar` + `rh-candidates-table-section` +
 * `daf-pagination`, with the per-candidate decision history and the MS365
 * automation explainer moved into `rh-candidate-dossier-panel`, a right-edge
 * `daf-drawer` (§10e). All state lives here; both sections are stateless.
 *
 * The table is the **same component** /rh/recrutement's list view uses — the two
 * were byte-for-byte identical `daf-data-table` blocks maintained separately.
 */
@Component({
  selector: 'app-candidate-list',
  standalone: true,
  imports: [
    ButtonComponent,
    DafHasPermissionDirective,
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    CandidatesTableSectionComponent,
    CandidateDossierPanelComponent,
    RejectModalComponent,
    TranslatePipe,
  ],
  templateUrl: './candidate-list.component.html',
})
export class CandidateListComponent implements OnInit {
  private svc       = inject(CandidateService);
  private confirm   = inject(ConfirmService);
  private router    = inject(Router);
  private translate = inject(TranslateService);
  private refData   = inject(RefDataService);
  private demandSvc = inject(RecruitmentDemandService);
  readonly userStore = inject(UserStore);

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly page  = signal<PageResponse<CandidateListItem> | null>(null);
  readonly stats = signal<CandidateStats>({ total: 0, pending: 0, accepted: 0, hired: 0 });
  /** Filter-panel option sources, loaded once for the user's entity. */
  private readonly departments   = signal<RefDataItem[]>([]);
  private readonly demandOptions = signal<ApprovedDemandOption[]>([]);

  readonly candidates    = computed(() => this.page()?.content ?? []);
  readonly totalElements = computed(() => this.page()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this.page()?.totalPages ?? 0);

  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad = signal(true);
  /** Every subsequent fetch — skeleton rows inside the table only. */
  readonly loading   = signal(false);

  // ── View state ─────────────────────────────────────────────────────────────
  readonly search       = signal('');
  readonly statusFilter = signal('');
  /** Department id as a string ('' = all) — the filter panel's select value. */
  readonly departmentFilter = signal('');
  /** Demand id as a string, `SPONTANEOUS`, or '' = all. */
  readonly demandFilter     = signal('');
  /** Application-date range from the panel: one day or [from, to]; null = no bound. */
  readonly createdRange     = signal<Date[] | null>(null);
  readonly currentPage  = signal(0);
  readonly pageSize     = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // ── Dossier drawer ─────────────────────────────────────────────────────────
  readonly selectedId       = signal<number | null>(null);
  readonly dossierOpen      = signal(false);
  readonly history        = signal<CandidateHistoryItem[]>([]);
  readonly historyLoading = signal(false);

  readonly selectedCandidate = computed(() =>
    this.candidates().find(c => c.id === this.selectedId()) ?? null,
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  readonly rejectTarget = signal<CandidateListItem | null>(null);
  readonly actioningId  = signal<number | null>(null);
  readonly actionError  = signal<string | null>(null);

  readonly canAcceptReject = computed(() => this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'));

  // ── Toolbar ────────────────────────────────────────────────────────────────
  /** The status dropdown belongs *inside* the filter panel, not loose in a toggled row. */
  readonly filterFields = computed<FilterField[]>(() => {
    const lang = this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      {
        name: 'status',
        label: t('CANDIDATES.LIST.COL_STATUS'),
        type: 'select',
        placeholder: t('CANDIDATES.FILTERS.ALL_STATUSES'),
        options: STATUS_CODES.map(code => ({
          value: code,
          label: t('CANDIDATES.STATUS.' + code),
        })),
      },
      {
        name: 'demand',
        label: t('CANDIDATES.FILTERS.DEMAND'),
        type: 'select',
        searchable: true,
        placeholder: t('CANDIDATES.FILTERS.ALL_DEMANDS'),
        options: [
          { value: SPONTANEOUS, label: t('CANDIDATES.FILTERS.SPONTANEOUS') },
          ...this.demandOptions().map(d => ({ value: String(d.id), label: d.label })),
        ],
      },
      {
        name: 'department',
        label: t('CANDIDATES.FILTERS.DEPARTMENT'),
        type: 'select',
        searchable: true,
        placeholder: t('CANDIDATES.FILTERS.ALL_DEPARTMENTS'),
        options: this.departments().map(d => ({
          value: String(d.id),
          label: (lang === 'en' ? d.labelEn : d.labelFr) || d.labelFr || d.labelEn,
        })),
      },
      {
        name: 'createdAt',
        label: t('CANDIDATES.FILTERS.APPLIED_ON'),
        type: 'daterange',
      },
    ];
  });

  /**
   * `initialValues` is a seed read once on first open, and a `select` needs the
   * panel's internal shape — a `string[]`, not a bare string (§10b).
   */
  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      title:        t('CANDIDATES.FILTERS.TITLE'),
      applyLabel:   t('CANDIDATES.FILTERS.APPLY'),
      cancelLabel:  t('CANDIDATES.FILTERS.CANCEL'),
      resetLabel:   t('CANDIDATES.FILTERS.RESET'),
      triggerLabel: t('CANDIDATES.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: {
        status:     this.statusFilter()     ? [this.statusFilter()]     : [],
        demand:     this.demandFilter()     ? [this.demandFilter()]     : [],
        department: this.departmentFilter() ? [this.departmentFilter()] : [],
        createdAt:  this.createdRange(),
      },
    };
  });

  // ── Presentation callbacks handed to the sections ──────────────────────────
  readonly statusLabel = computed(() => {
    this.translate.currentLang();
    return (status: string) => this.translate.instant('CANDIDATES.STATUS.' + status);
  });

  /** Translated label + the shared badge variant, for the table's badge column. */
  readonly statusBadgeCell = computed(() => {
    this.translate.currentLang();
    return (status: string): BadgeCell => ({
      label:   this.translate.instant('CANDIDATES.STATUS.' + status),
      options: statusBadge(status).options as BadgeOptions,
    });
  });

  // ── KPI tiles ──────────────────────────────────────────────────────────────
  readonly totalMetricValue   = computed(() => this.stats().total.toLocaleString('fr-FR'));
  readonly pendingMetricValue = computed(() => this.stats().pending.toLocaleString('fr-FR'));
  readonly hiredMetricValue   = computed(() => this.stats().hired.toLocaleString('fr-FR'));

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    forkJoin({
      stats: this.svc.getStats().pipe(catchError(() => of(null))),
      page:  this.svc.getCandidates(this.query()).pipe(catchError(() => of(null))),
    }).subscribe(({ stats, page }) => {
      if (stats) this.stats.set(stats);
      if (page)  this.page.set(page);
      this.firstLoad.set(false);
    });

    this.loadFilterOptions();
  }

  /** Every filter of the panel is applied server-side. */
  private query(): CandidateListQuery {
    const demand = this.demandFilter();
    const range  = this.createdRange();
    return {
      paysId:       this.userStore.currentUser()?.paysId,
      status:       this.statusFilter() || undefined,
      search:       this.search()       || undefined,
      departmentId: this.departmentFilter() ? Number(this.departmentFilter()) : undefined,
      spontaneous:  demand === SPONTANEOUS || undefined,
      demandId:     demand && demand !== SPONTANEOUS ? Number(demand) : undefined,
      createdFrom:  range?.[0] ? toIsoDay(range[0]) : undefined,
      // A single picked day is a one-day range.
      createdTo:    range?.[0] ? toIsoDay(range[1] ?? range[0]) : undefined,
      page:         this.currentPage(),
      size:         this.pageSize(),
    };
  }

  /** Once per page: the demand and department options of the filter panel. */
  private loadFilterOptions(): void {
    const paysId = this.userStore.currentUser()?.paysId;
    this.refData.getDepartments(paysId).subscribe(items =>
      this.departments.set((items ?? []).filter(d => d.isActive !== false)));
    if (paysId) {
      this.demandSvc.getApprovedOptions(paysId)
        .pipe(catchError(() => of([] as ApprovedDemandOption[])))
        .subscribe(opts => this.demandOptions.set(opts ?? []));
    }
  }

  private loadCandidates(): void {
    this.loading.set(true);
    this.svc.getCandidates(this.query()).subscribe({
      next:  r  => { this.page.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadStats(): void {
    this.svc.getStats().subscribe({ next: s => this.stats.set(s), error: () => {} });
  }

  // ── Toolbar handlers ───────────────────────────────────────────────────────
  onSearch(value: string): void {
    if (value === this.search()) return; // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
    this.loadCandidates();
  }

  applyFilters(result: FilterResult): void {
    const str = (key: string) => typeof result[key] === 'string' ? result[key] as string : '';
    const range = result['createdAt'];
    this.statusFilter.set(str('status'));
    this.demandFilter.set(str('demand'));
    this.departmentFilter.set(str('department'));
    this.createdRange.set(Array.isArray(range) && range.length ? range as Date[] : null);
    this.currentPage.set(0);
    this.loadCandidates();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadCandidates();
  }

  /** `pageSizeChange` fires alone — the page decides to go back to page 0 (§7). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.loadCandidates();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  onNewCandidate(): void { this.router.navigate(['/rh/candidates', 'new']); }
  onView(id: number): void { this.router.navigate(['/rh/candidates', id]); }

  // ── Dossier drawer ─────────────────────────────────────────────────────────
  /** A row click opens the dossier; the row's "Voir" button opens the candidate. */
  openDossier(candidateId: number): void {
    this.dossierOpen.set(true);
    if (this.selectedId() === candidateId) return; // already loaded
    this.selectedId.set(candidateId);
    this.historyLoading.set(true);
    this.history.set([]);
    this.svc.getHistory(candidateId).subscribe({
      next:  h  => { this.history.set(h); this.historyLoading.set(false); },
      error: () => this.historyLoading.set(false),
    });
  }

  // ── Accept / reject (PENDING candidates only) ──────────────────────────────
  async quickAccept({ candidate, event }: { candidate: CandidateListItem; event: Event }): Promise<void> {
    event.stopPropagation();
    if (!(await this.confirm.ask({
      title:   this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_TITLE'),
      message: this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_MESSAGE', { name: `${candidate.firstName} ${candidate.lastName}` }),
      confirmLabel: this.translate.instant('CANDIDATES.ACTIONS.ACCEPT'), icon: 'check_circle',
    }))) return;

    this.actioningId.set(candidate.id);
    this.actionError.set(null);
    this.svc.accept(candidate.id).subscribe({
      next:  () => { this.actioningId.set(null); this.reload(); },
      error: err => {
        this.actioningId.set(null);
        this.actionError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.GENERIC'));
      },
    });
  }

  openRejectModal({ candidate, event }: { candidate: CandidateListItem; event: Event }): void {
    event.stopPropagation();
    this.actionError.set(null);
    this.rejectTarget.set(candidate);
  }

  onRejected(): void {
    this.rejectTarget.set(null);
    this.reload();
  }

  /** After an action: the list, the KPIs and — if it's open — the dossier history. */
  private reload(): void {
    this.loadCandidates();
    this.loadStats();
    const id = this.selectedId();
    if (id != null) {
      this.historyLoading.set(true);
      this.svc.getHistory(id).subscribe({
        next:  h  => { this.history.set(h); this.historyLoading.set(false); },
        error: () => this.historyLoading.set(false),
      });
    }
  }
}
