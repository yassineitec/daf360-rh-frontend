import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import {
  BadgeCell,
  BadgeOptions,
  ButtonComponent,
  DafHasPermissionDirective,
  FilterField,
  FilterResult,
  MetricCardComponent,
  MetricDelta,
  PageComponent,
  PageHeaderComponent,
  PaginationComponent,
  SearchToolbarComponent,
  SearchToolbarFilterConfig,
  ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CandidateService } from './candidate.service';
import { RejectModalComponent } from './reject-modal.component';
import { UserStore } from '../../core/user.store';
import { ConfirmService } from '../../core/confirm.service';
import { statusBadge } from '../../shared/status-badge.utils';
import {
  CandidateListItem,
  CandidateDashboardStats,
  CandidateStatus,
  PageResponse,
} from './candidate.model';
import { KANBAN_COLUMN_DEFS, KanbanColumn, KanbanColumnDef, byFitScoreDesc } from './kanban.model';
import { PipelineService, PipelineActivity, PipelineObjective } from '../pipeline/services/pipeline.service';
import { CandidatesBoardSectionComponent } from './sections/candidates-board-section.component';
import { CandidatesTableSectionComponent } from './sections/candidates-table-section.component';
import { CandidatesMobileSectionComponent } from './sections/candidates-mobile-section.component';
import { RecruitmentInsightsPanelComponent } from './sections/recruitment-insights-panel.component';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Kanban pulls the whole (tenant-scoped) candidate set in one page and groups it client-side. */
const KANBAN_FETCH_SIZE = 500;

/** Candidate status codes, in workflow order, for the status filter. */
const STATUS_CODES: CandidateStatus[] = [
  'PENDING', 'ACCEPTED', 'OFFER_SENT', 'REJECTED', 'IT_IN_PROGRESS',
  'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED', 'ARCHIVED',
];

type ViewMode = 'list' | 'kanban';

/**
 * /rh/recrutement — the single, canonical candidate board.
 *
 * Backed entirely by the candidate backend (`/api/hr/candidates`,
 * CandidateController); statuses come straight from `CandidateStatus` so the
 * board, the list and the KPIs all reflect the same source. The two pipeline
 * endpoints it does call (`/pipeline/activity`, `/pipeline/objectives`) only
 * feed the insights drawer.
 *
 * Architecture follows UI-PLAYBOOK §8b: this template is `daf-page` +
 * `daf-page-header` + the KPI row + `daf-search-toolbar` + one section
 * component per view, and every section is a stateless input/output shell.
 * **All view state lives here** — `searchText`, `statusFilter`, `viewMode`,
 * paging, drag state — which is what makes flipping between board and list
 * lossless.
 */
@Component({
  selector: 'rh-candidates',
  standalone: true,
  imports: [
    ButtonComponent,
    DafHasPermissionDirective,
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    RejectModalComponent,
    CandidatesBoardSectionComponent,
    CandidatesTableSectionComponent,
    CandidatesMobileSectionComponent,
    RecruitmentInsightsPanelComponent,
    TranslatePipe,
  ],
  templateUrl: './candidates.component.html',
})
export class CandidatesComponent implements OnInit {
  private svc         = inject(CandidateService);
  private confirm     = inject(ConfirmService);
  private pipelineSvc = inject(PipelineService);
  private router      = inject(Router);
  readonly userStore  = inject(UserStore);
  private translate   = inject(TranslateService);

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly page      = signal<PageResponse<CandidateListItem> | null>(null);
  readonly dashStats = signal<CandidateDashboardStats>({
    totalCandidates: 0, monthGrowthPct: null,
    avgRecruitmentDays: null, avgRecruitmentDaysDelta: null, urgentPositions: 0,
    activeCandidates: 0, hiredTotal: 0, offerAcceptanceRate: null,
  });
  readonly kanbanItems = signal<CandidateListItem[]>([]);
  readonly activities  = signal<PipelineActivity[]>([]);
  readonly objectives  = signal<PipelineObjective[]>([]);

  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad     = signal(true);
  /** Every subsequent fetch — skeletons inside the affected section only. */
  readonly loading       = signal(false);
  readonly kanbanLoading = signal(false);
  readonly kanbanLoaded  = signal(false);
  readonly extrasLoading = signal(true);

  // ── View state (survives a view-mode switch) ───────────────────────────────
  readonly viewMode     = signal<ViewMode>('kanban');
  readonly search       = signal('');
  readonly statusFilter = signal('');
  readonly currentPage  = signal(0);
  readonly pageSize     = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly candidates    = computed(() => this.page()?.content ?? []);
  readonly totalElements = computed(() => this.page()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this.page()?.totalPages ?? 0);

  // ── Funnel-health KPIs ─────────────────────────────────────────────────────
  readonly kpiActive     = computed(() => this.dashStats().activeCandidates);
  readonly kpiHired      = computed(() => this.dashStats().hiredTotal);
  readonly kpiAcceptance = computed(() => this.dashStats().offerAcceptanceRate);

  readonly activeMetricValue = computed(() => this.kpiActive().toLocaleString('fr-FR'));
  readonly hiredMetricValue  = computed(() => this.kpiHired().toLocaleString('fr-FR'));
  readonly acceptanceMetricValue = computed(() => {
    const r = this.kpiAcceptance();
    return r == null ? '—' : `${Math.round(r)}%`;
  });

  /**
   * 30-day growth in *new candidatures*. It belongs to the "Candidats actifs"
   * tile only — the "Recrutés" tile used to show the very same number, which
   * read as a hiring trend the backend never computes.
   */
  readonly activeDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const growth = this.dashStats().monthGrowthPct;
    if (growth == null) return null;
    return {
      value: this.translate.instant('CANDIDATES.PIPELINE_RH.DELTA_VS_LAST_MONTH', {
        pct: `${growth > 0 ? '+' : ''}${Math.round(growth)}`,
      }),
      direction: growth > 0 ? 'up' : growth < 0 ? 'down' : 'neutral',
    };
  });

  // ── Insights drawer ────────────────────────────────────────────────────────
  readonly recentActivities = computed(() => this.activities().slice(0, 8));

  readonly currentObjective = computed<PipelineObjective | null>(() => {
    const o = this.objectives();
    return o.length ? o[o.length - 1] : null;
  });

  readonly objectiveProgress = computed<number>(() => {
    const o = this.currentObjective();
    if (!o || o.target === 0) return 0;
    return Math.min(100, Math.round((o.actual / o.target) * 100));
  });

  // ── Kanban ─────────────────────────────────────────────────────────────────
  private readonly columnDefs = KANBAN_COLUMN_DEFS;
  readonly columnSortDirs = signal<Record<string, 'asc' | 'desc'>>({});

  toggleColumnSort(key: string): void {
    this.columnSortDirs.update(dirs => ({ ...dirs, [key]: dirs[key] === 'asc' ? 'desc' : 'asc' }));
  }

  /**
   * The status filter is applied here as well as in the list query, so picking a
   * status narrows the board too. Before, it silently only affected the list.
   */
  readonly kanbanColumns = computed<KanbanColumn[]>(() => {
    this.translate.currentLang();
    const status = this.statusFilter();
    const all  = status ? this.kanbanItems().filter(c => c.status === status) : this.kanbanItems();
    const dirs = this.columnSortDirs();
    return this.columnDefs.map(def => {
      const dir = dirs[def.key] ?? 'desc';
      return {
        ...def,
        label:   this.translate.instant(def.labelKey),
        sortDir: dir,
        candidates: all
          .filter(c => def.statuses.includes(c.status))
          .sort((a, b) => (dir === 'asc' ? -byFitScoreDesc(a, b) : byFitScoreDesc(a, b))),
      };
    });
  });

  readonly visibleKanbanCount = computed(() =>
    this.kanbanColumns().reduce((sum, col) => sum + col.candidates.length, 0),
  );

  // ── Mobile ─────────────────────────────────────────────────────────────────
  readonly mobileStageFilter = signal<string | null>(null);

  readonly mobileCandidates = computed(() => {
    const key = this.mobileStageFilter();
    const cols = this.kanbanColumns();
    if (key) return cols.find(c => c.key === key)?.candidates ?? [];
    return cols.flatMap(c => c.candidates).sort(byFitScoreDesc);
  });

  // ── Drag & drop (native HTML5 — no CDK, avoids Native Federation issues) ────
  readonly draggedId   = signal<number | null>(null);
  readonly dragOverKey = signal<string | null>(null);
  private draggedCandidate: CandidateListItem | null = null;

  // ── Actions ────────────────────────────────────────────────────────────────
  readonly rejectTarget = signal<CandidateListItem | null>(null);
  readonly actioningId  = signal<number | null>(null);
  readonly actionError  = signal<string | null>(null);
  readonly notice       = signal<string | null>(null);

  readonly canAcceptReject = computed(() => this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'));

  // ── Toolbar ────────────────────────────────────────────────────────────────
  /**
   * The status dropdown belongs *inside* the filter panel — `daf-search-toolbar`
   * renders no free-standing selects next to the search box.
   */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    return [{
      name: 'status',
      label: this.translate.instant('CANDIDATES.LIST.COL_STATUS'),
      type: 'select',
      placeholder: this.translate.instant('CANDIDATES.FILTERS.ALL_STATUSES'),
      options: STATUS_CODES.map(code => ({
        value: code,
        label: this.translate.instant('CANDIDATES.STATUS.' + code),
      })),
    }];
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
      initialValues: { status: this.statusFilter() ? [this.statusFilter()] : [] },
    };
  });

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'kanban', icon: 'view_kanban', tooltip: this.translate.instant('CANDIDATES.PIPELINE_RH.VIEW_KANBAN') },
      { id: 'list',   icon: 'view_list',   tooltip: this.translate.instant('CANDIDATES.PIPELINE_RH.VIEW_LIST')   },
    ];
  });

  // ── Presentation callbacks handed to the sections ──────────────────────────
  /** Translated status label; the hardcoded-French `statusBadge` map is display-only. */
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

  readonly accentFor  = computed(() => (status: string) => this.columnForStatus(status)?.accent ?? '#64748b');
  readonly badgeBgFor = computed(() => (status: string) => this.columnForStatus(status)?.badgeBg ?? 'rgba(100,116,139,0.12)');

  private columnForStatus(status: string): KanbanColumnDef | undefined {
    return this.columnDefs.find(d => d.statuses.includes(status as CandidateStatus));
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    forkJoin({
      stats:  this.svc.getDashboardStats().pipe(catchError(() => of(null))),
      kanban: this.svc.getCandidates(this.kanbanQuery()).pipe(catchError(() => of(null))),
    }).subscribe(({ stats, kanban }) => {
      if (stats) this.dashStats.set(stats);
      if (kanban) {
        this.kanbanItems.set(kanban.content);
        this.kanbanLoaded.set(true);
      }
      this.firstLoad.set(false);
    });

    // The drawer's two feeds are independent — they must never hold up the board.
    forkJoin({
      activity:   this.pipelineSvc.getActivity().pipe(catchError(() => of([] as PipelineActivity[]))),
      objectives: this.pipelineSvc.getObjectives().pipe(catchError(() => of([] as PipelineObjective[]))),
    }).subscribe(({ activity, objectives }) => {
      this.activities.set(activity);
      this.objectives.set(objectives);
      this.extrasLoading.set(false);
    });
  }

  private loadStats(): void {
    this.svc.getDashboardStats().subscribe({ next: s => this.dashStats.set(s), error: () => {} });
  }

  private kanbanQuery() {
    return {
      paysId: this.userStore.currentUser()?.paysId,
      search: this.search() || undefined,
      page:   0,
      size:   KANBAN_FETCH_SIZE,
    };
  }

  private loadCandidates(): void {
    this.loading.set(true);
    this.svc.getCandidates({
      paysId: this.userStore.currentUser()?.paysId,
      status: this.statusFilter() || undefined,
      search: this.search()       || undefined,
      page:   this.currentPage(),
      size:   this.pageSize(),
    }).subscribe({
      next:  r  => { this.page.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadKanban(): void {
    this.kanbanLoading.set(true);
    this.svc.getCandidates(this.kanbanQuery()).subscribe({
      next: r => {
        this.kanbanItems.set(r.content);
        this.kanbanLoaded.set(true);
        this.kanbanLoading.set(false);
      },
      error: () => this.kanbanLoading.set(false),
    });
  }

  private reload(): void {
    this.loadStats();
    if (this.page())        this.loadCandidates();
    if (this.kanbanLoaded()) this.loadKanban();
  }

  // ── Toolbar handlers ───────────────────────────────────────────────────────
  setView(mode: string): void {
    const next = mode as ViewMode;
    if (this.viewMode() === next) return;
    this.viewMode.set(next);
    this.notice.set(null);
    if (next === 'kanban' && !this.kanbanLoaded()) this.loadKanban();
    if (next === 'list'   && !this.page())         this.loadCandidates();
  }

  onSearch(value: string): void {
    if (value === this.search()) return; // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
    this.loadKanban();
    if (this.page()) this.loadCandidates();
  }

  applyFilters(result: FilterResult): void {
    const status = typeof result['status'] === 'string' ? result['status'] : '';
    this.statusFilter.set(status);
    this.currentPage.set(0);
    // The board filters `kanbanItems` client-side, so only the list needs a re-fetch.
    if (this.page() || this.viewMode() === 'list') this.loadCandidates();
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

  // ── Accept / reject (PENDING candidates only) ──────────────────────────────
  async quickAccept({ candidate, event }: { candidate: CandidateListItem; event: Event }): Promise<void> {
    event.stopPropagation();
    if (!(await this.confirm.ask({
      title:   this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_TITLE'),
      message: this.translate.instant('CANDIDATES.CONFIRM.ACCEPT_MESSAGE', { name: `${candidate.firstName} ${candidate.lastName}` }),
      confirmLabel: this.translate.instant('CANDIDATES.ACTIONS.ACCEPT'), icon: 'check_circle',
    }))) return;
    this.accept(candidate);
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

  private accept(c: CandidateListItem): void {
    this.actioningId.set(c.id);
    this.actionError.set(null);
    this.svc.accept(c.id).subscribe({
      next:  () => { this.actioningId.set(null); this.reload(); },
      error: err => {
        this.actioningId.set(null);
        this.actionError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.ACCEPT'));
      },
    });
  }

  // ── Drag & drop workflow ───────────────────────────────────────────────────
  onDragStart(c: CandidateListItem): void {
    this.draggedCandidate = c;
    this.draggedId.set(c.id);
  }

  onDragEnd(): void {
    this.draggedCandidate = null;
    this.draggedId.set(null);
    this.dragOverKey.set(null);
  }

  onDragOver(key: string): void { this.dragOverKey.set(key); }

  onDragLeave(key: string): void {
    if (this.dragOverKey() === key) this.dragOverKey.set(null);
  }

  onDrop(col: KanbanColumn): void {
    const candidate = this.draggedCandidate;
    this.onDragEnd();
    if (candidate) this.applyStageMove(candidate, col);
  }

  /**
   * Applies a card dropped onto another column. Each move maps to the REAL coded
   * transition — no blind status flips (which would skip provisioning / contract
   * creation). Immediate transitions call the guarded endpoints; multi-step ones
   * route the user to the dedicated flow.
   */
  private applyStageMove(candidate: CandidateListItem, target: KanbanColumn): void {
    const status = candidate.status;
    if (target.statuses.includes(status)) return; // dropped in its own column
    this.notice.set(null);
    this.actionError.set(null);

    switch (target.key) {
      case 'accepted':
        if (status === 'PENDING') this.dragAccept(candidate);
        else this.notice.set(this.translate.instant('CANDIDATES.NOTICE.ONLY_PENDING_ACCEPT'));
        break;

      case 'rejected':
        if (status === 'PENDING') this.rejectTarget.set(candidate);
        else this.notice.set(this.translate.instant('CANDIDATES.NOTICE.ONLY_PENDING_REJECT'));
        break;

      case 'progress':
        if (status === 'ACCEPTED') {
          this.notice.set(this.translate.instant('CANDIDATES.NOTICE.IT_DEDICATED'));
          this.router.navigate(['/rh/it-provisioning']);
        } else {
          this.notice.set(this.translate.instant('CANDIDATES.NOTICE.ACCEPT_FIRST'));
        }
        break;

      case 'hired':
        if (status === 'EMAIL_RECEIVED' || status === 'HR_IN_PROGRESS') {
          this.router.navigate(['/rh/onboarding', candidate.id]);
        } else {
          this.notice.set(this.translate.instant('CANDIDATES.NOTICE.HIRE_FLOW'));
        }
        break;

      default:
        this.notice.set(this.translate.instant('CANDIDATES.NOTICE.MOVE_NOT_ALLOWED'));
    }
  }

  private dragAccept(c: CandidateListItem): void {
    this.actioningId.set(c.id);
    this.patchLocalStatus(c.id, 'ACCEPTED'); // optimistic — the card jumps to Acceptés
    this.svc.accept(c.id).subscribe({
      next:  () => { this.actioningId.set(null); this.reload(); },
      error: err => {
        this.actioningId.set(null);
        this.actionError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.ERRORS.ACCEPT'));
        this.loadKanban(); // revert the optimistic move
      },
    });
  }

  private patchLocalStatus(id: number, status: CandidateStatus): void {
    this.kanbanItems.update(items => items.map(c => (c.id === id ? { ...c, status } : c)));
  }
}
