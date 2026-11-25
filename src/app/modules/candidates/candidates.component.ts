import { Component, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { injectHeaderPays } from '../../core/header-pays';
import { Router } from '@angular/router';
import { Observable, forkJoin, catchError, map, of } from 'rxjs';
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
import { RecrutementStateService } from './recrutement-state.service';
import { UserStore } from '../../core/user.store';
import { ConfirmService } from '../../core/confirm.service';
import { statusBadge } from '../../shared/status-badge.utils';
import {
  CandidateListItem,
  CandidateDashboardStats,
  CandidateListQuery,
  CandidateStatus,
  PageResponse,
} from './candidate.model';
import { KANBAN_COLUMN_DEFS, KanbanColumnDef } from './kanban.model';
import {
  KanbanCandidate, PipelineService, PipelineActivity, PipelineObjective,
} from '../pipeline/services/pipeline.service';
import { OffboardingService } from '../offboarding/offboarding.service';
import { OffboardingWorkflowInstance } from '../offboarding/models/offboarding.model';
import { DepartureReasonLabelService } from '../offboarding/departure-reason-labels.service';
import { ItProvisioningService } from '../it-provisioning/it-provisioning.service';
import { ProvisioningListItem } from '../it-provisioning/it-provisioning.model';
import { OnboardingService } from '../onboarding/onboarding.service';
import { OnboardingListItem } from '../onboarding/onboarding.model';
import { CdiConversionService } from '../cdi-conversions/cdi-conversion.service';
import { CdiConversion } from '../cdi-conversions/cdi-conversion.model';
import {
  LIFECYCLE_COLUMNS, LifecycleCard, LifecycleColumn, LifecycleColumnDef, LifecycleColumnKey,
  candidateCard, cdiCard, itCard, offboardingCard, onboardingCard,
} from './lifecycle-board.model';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem } from '../../core/ref/ref-data.model';
import { RecruitmentDemandService } from '../recruitment-demands/recruitment-demand.service';
import { ApprovedDemandOption } from '../recruitment-demands/recruitment-demand.model';
import { CandidatesTableSectionComponent } from './sections/candidates-table-section.component';
import { LifecycleBoardSectionComponent } from './sections/lifecycle-board-section.component';
import { RecruitmentInsightsPanelComponent } from './sections/recruitment-insights-panel.component';
import { PageGuideComponent } from '../../shared/guide/page-guide.component';
import { GuideStep } from '../../shared/guide/page-guide.types';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Candidate status codes, in lifecycle order, for the list view's status filter — every one
 * of them: the list is the whole candidate lifecycle (see `panelFilterQuery`).
 * IT_IN_PROGRESS / EMAIL_RECEIVED are legacy codes of the onboarding phase, still filterable
 * since old files carry them.
 */
const STATUS_CODES: CandidateStatus[] = [
  'PENDING', 'ACCEPTED', 'OFFER_SENT', 'HR_IN_PROGRESS', 'IT_IN_PROGRESS', 'EMAIL_RECEIVED',
  'HIRED', 'REJECTED', 'ARCHIVED',
];

type ViewMode = 'list' | 'kanban';

/**
 * Guided tour of the page, started from the help center. `target` names a
 * `data-guide` anchor in the template; the board steps point at whichever view is shown.
 * No « moves » step any more: the board is not draggable.
 */
const GUIDE_STEPS: GuideStep[] = [
  { icon: 'waving_hand',  titleKey: 'RECRUITMENT.GUIDE.WELCOME.TITLE',  textKey: 'RECRUITMENT.GUIDE.WELCOME.TEXT' },
  { icon: 'monitoring',   titleKey: 'RECRUITMENT.GUIDE.KPIS.TITLE',     textKey: 'RECRUITMENT.GUIDE.KPIS.TEXT',     target: 'kpis' },
  { icon: 'search',       titleKey: 'RECRUITMENT.GUIDE.TOOLBAR.TITLE',  textKey: 'RECRUITMENT.GUIDE.TOOLBAR.TEXT',  target: 'toolbar' },
  { icon: 'view_kanban',  titleKey: 'RECRUITMENT.GUIDE.BOARD.TITLE',    textKey: 'RECRUITMENT.GUIDE.BOARD.TEXT',    target: 'board' },
  { icon: 'check_circle', titleKey: 'RECRUITMENT.GUIDE.ACTIONS.TITLE',  textKey: 'RECRUITMENT.GUIDE.ACTIONS.TEXT',  target: 'board' },
  { icon: 'insights',     titleKey: 'RECRUITMENT.GUIDE.INSIGHTS.TITLE', textKey: 'RECRUITMENT.GUIDE.INSIGHTS.TEXT' },
  { icon: 'help',         titleKey: 'RECRUITMENT.GUIDE.END.TITLE',      textKey: 'RECRUITMENT.GUIDE.END.TEXT' },
];

/** Demand filter value for "no recruitment demand" — never a real demand id. */
const SPONTANEOUS = 'SPONTANEOUS';

/** Badge variant of each global status (lifecycle phase) in the list view. */
const GLOBAL_VARIANT: Record<string, BadgeOptions['variant']> = {
  recruiting: 'info',
  onboarding: 'warning',
  hired:      'success',
  closed:     'neutral',
};

/** Local calendar day as `yyyy-MM-dd` — `toISOString()` would shift it to UTC. */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The raw rows behind the board, one list per column. */
interface LifecycleSources {
  candidates: KanbanCandidate[];
  it: ProvisioningListItem[];
  onboarding: OnboardingListItem[];
  cdi: CdiConversion[];
  offboarding: OffboardingWorkflowInstance[];
}

const EMPTY_SOURCES: LifecycleSources = { candidates: [], it: [], onboarding: [], cdi: [], offboarding: [] };

/**
 * /rh/recrutement — « Pipeline RH », the HR LIFECYCLE board (own sidebar entry, outside the
 * « Lifecycle » group): Candidat → Provisioning IT → Onboarding → Passage en CDI →
 * Offboarding (see LIFECYCLE_COLUMNS). Every card shows its current step, where it stands
 * inside it, and the steps already validated in its footer.
 *
 * Each column reads its own module's endpoint and is only drawn with that endpoint's read
 * permission; a failing or 403'd call empties its column, never the board. The search box
 * filters the board client-side (name, position…).
 *
 * The list view is unchanged: the candidate lifecycle table (`/api/hr/candidates`,
 * stage=LIFECYCLE) with its filter panel, paging, sort and accept / reject actions.
 *
 * Architecture follows UI-PLAYBOOK §8b: this template is `daf-page` + `daf-page-header` +
 * the KPI row + `daf-search-toolbar` + one section component per view; all view state
 * lives here.
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
    CandidatesTableSectionComponent,
    LifecycleBoardSectionComponent,
    RecruitmentInsightsPanelComponent,
    PageGuideComponent,
    TranslatePipe,
  ],
  templateUrl: './candidates.component.html',
})
export class CandidatesComponent implements OnInit {
  /** Table view only (undefined in kanban view) — its `daf-data-table` goes to the toolbar's `[table]`. */
  readonly tableSection = viewChild(CandidatesTableSectionComponent);

  private svc         = inject(CandidateService);
  private confirm     = inject(ConfirmService);
  private pipelineSvc = inject(PipelineService);
  private offboardingSvc = inject(OffboardingService);
  private itSvc       = inject(ItProvisioningService);
  private onboardingSvc = inject(OnboardingService);
  private cdiSvc      = inject(CdiConversionService);
  private reasons     = inject(DepartureReasonLabelService);
  private router      = inject(Router);
  readonly userStore  = inject(UserStore);
  private translate   = inject(TranslateService);
  private refData     = inject(RefDataService);
  private demandSvc   = inject(RecruitmentDemandService);

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly page      = signal<PageResponse<CandidateListItem> | null>(null);
  readonly dashStats = signal<CandidateDashboardStats>({
    totalCandidates: 0, monthGrowthPct: null,
    avgRecruitmentDays: null, avgRecruitmentDaysDelta: null, urgentPositions: 0,
    activeCandidates: 0, hiredTotal: 0, offerAcceptanceRate: null,
  });
  readonly sources     = signal<LifecycleSources>(EMPTY_SOURCES);
  readonly activities  = signal<PipelineActivity[]>([]);
  readonly objectives  = signal<PipelineObjective[]>([]);
  /** Filter-panel option sources, loaded once for the user's entity. */
  private readonly departments   = signal<RefDataItem[]>([]);
  private readonly demandOptions = signal<ApprovedDemandOption[]>([]);

  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad     = signal(true);
  /** Every subsequent fetch — skeletons inside the affected section only. */
  readonly loading       = signal(false);
  readonly boardLoading  = signal(false);
  readonly extrasLoading = signal(true);

  // ── View state (survives a view-mode switch) ───────────────────────────────
  readonly viewMode     = signal<ViewMode>('kanban');
  readonly search       = signal('');
  readonly statusFilter = signal('');
  /** Department id as a string ('' = all) — the filter panel's select value. */
  readonly departmentFilter = signal('');
  /** Demand id as a string, `SPONTANEOUS`, or '' = all. */
  readonly demandFilter     = signal('');
  /** Application-date range from the panel: one day or [from, to]; null = no bound. */
  readonly createdRange     = signal<Date[] | null>(null);
  readonly currentPage  = signal(0);
  /** Server-side sort from the list table header (Spring `sort`); null = server default order. */
  readonly sort         = signal<string | null>(null);
  readonly pageSize     = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly guideSteps = GUIDE_STEPS;

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

  /** 30-day growth in *new candidatures* — the « Candidats actifs » tile only. */
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

  // ── Lifecycle board ────────────────────────────────────────────────────────
  /** The columns this user may read — the others are not drawn at all. */
  private readonly visibleColumnDefs = computed<LifecycleColumnDef[]>(() =>
    LIFECYCLE_COLUMNS.filter(def => def.permissions.some(p => this.userStore.hasPermission(p))));

  private canRead(key: LifecycleColumnKey): boolean {
    return this.visibleColumnDefs().some(d => d.key === key);
  }

  /** Each source mapped to cards, then narrowed by the search box. */
  readonly lifecycleColumns = computed<LifecycleColumn[]>(() => {
    const lang = this.translate.currentLang();
    const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
    const t = (key: string, params?: Record<string, unknown>) => this.translate.instant(key, params);
    const src = this.sources();
    const q = this.search().trim().toLowerCase();
    const cardsOf = (key: LifecycleColumnKey): LifecycleCard[] => {
      switch (key) {
        case 'CANDIDATE':   return src.candidates.map(c => candidateCard(c, t, locale)).filter(nonNull);
        case 'IT':          return src.it.map(p => itCard(p, t, locale)).filter(nonNull);
        case 'ONBOARDING':  return src.onboarding.map(o => onboardingCard(o, t, locale));
        case 'CDI':         return src.cdi.map(r => cdiCard(r, t, locale)).filter(nonNull);
        case 'OFFBOARDING': return src.offboarding
          .map(w => offboardingCard(w, t, locale, code => this.reasons.label(code))).filter(nonNull);
      }
    };
    return this.visibleColumnDefs().map(({ labelKey, permissions, ...def }) => ({
      ...def,
      label: t(labelKey),
      cards: cardsOf(def.key).filter(c => !q || c.haystack.includes(q)),
    }));
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  readonly rejectTarget = signal<CandidateListItem | null>(null);
  readonly actioningId  = signal<number | null>(null);
  readonly actionError  = signal<string | null>(null);

  readonly canAcceptReject = computed(() => this.userStore.hasPermission('ACCEPT_REJECT_CANDIDATE'));

  // ── Mémoire de la page ─────────────────────────────────────────────────────
  private pageState = inject(RecrutementStateService);

  /**
   * Chaque changement de vue, de recherche, de filtre, de tri ou de page est mémorisé,
   * pour que le retour depuis une fiche retrouve la page telle qu'on l'a quittée.
   * `columnSortDirs` / `mobileStageFilter` belonged to the old board — kept empty.
   */
  private readonly persistState = effect(() => {
    this.pageState.save({
      viewMode:          this.viewMode(),
      search:            this.search(),
      statusFilter:      this.statusFilter(),
      departmentFilter:  this.departmentFilter(),
      demandFilter:      this.demandFilter(),
      createdRange:      this.createdRange(),
      sort:              this.sort(),
      page:              this.currentPage(),
      pageSize:          this.pageSize(),
      columnSortDirs:    {},
      mobileStageFilter: null,
    });
  });

  /** Avant les premiers chargements et le premier rendu (`daf-filter` ne lit `initialValues` qu'une fois). */
  private restoreState(): void {
    const s = this.pageState.restore();
    if (!s) return;
    this.viewMode.set(s.viewMode);
    this.search.set(s.search);
    this.statusFilter.set(STATUS_CODES.includes(s.statusFilter as CandidateStatus) ? s.statusFilter : '');
    this.departmentFilter.set(s.departmentFilter);
    this.demandFilter.set(s.demandFilter);
    this.createdRange.set(s.createdRange);
    this.sort.set(s.sort);
    this.currentPage.set(s.page);
    this.pageSize.set(s.pageSize);
  }

  // ── Toolbar ────────────────────────────────────────────────────────────────
  /**
   * List view only: the panel filters candidates, and the board mixes five processes a
   * candidate status / demand / department filter means nothing to. An empty list hides
   * the toolbar's filter button.
   */
  readonly filterFields = computed<FilterField[]>(() => {
    if (this.viewMode() !== 'list') return [];
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

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'kanban', icon: 'view_kanban', tooltip: this.translate.instant('CANDIDATES.PIPELINE_RH.VIEW_KANBAN') },
      { id: 'list',   icon: 'view_list',   tooltip: this.translate.instant('CANDIDATES.PIPELINE_RH.VIEW_LIST')   },
    ];
  });

  // ── Presentation callbacks handed to the table ─────────────────────────────
  readonly statusBadgeCell = computed(() => {
    this.translate.currentLang();
    return (status: string): BadgeCell => ({
      label:   this.translate.instant('CANDIDATES.STATUS.' + status),
      options: statusBadge(status).options as BadgeOptions,
    });
  });

  /** Global status as a badge, for the list view's « Phase » column. */
  readonly globalBadgeCell = computed(() => {
    this.translate.currentLang();
    return (status: string): BadgeCell => {
      const def = this.columnForStatus(status);
      return {
        label:   def ? this.translate.instant(def.globalLabelKey) : '',
        options: { variant: GLOBAL_VARIANT[def?.key ?? ''] ?? 'neutral', dot: true } as BadgeOptions,
      };
    };
  });

  private columnForStatus(status: string): KanbanColumnDef | undefined {
    return KANBAN_COLUMN_DEFS.find(d => d.statuses.includes(status as CandidateStatus));
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.restoreState();
    this.loadedPays = this.pays();
    if (this.viewMode() === 'list') this.loadCandidates();

    forkJoin({
      stats:   this.svc.getDashboardStats(this.pays()).pipe(catchError(() => of(null))),
      sources: this.fetchSources(),
    }).subscribe(({ stats, sources }) => {
      if (stats) this.dashStats.set(stats);
      this.sources.set(sources);
      this.firstLoad.set(false);
    });

    this.loadFilterOptions();
    this.loadExtras();
  }

  // ── Pays : les drapeaux cochés dans la navbar du shell ─────────────────────
  /** `179,64` ; undefined = « Tous les pays » (tout le périmètre du rôle). */
  readonly pays = injectHeaderPays();
  /** Pays des données affichées — ne recharger que sur un VRAI changement de drapeaux. */
  private loadedPays: string | undefined;

  /**
   * Changement de drapeaux = tout est rechargé : KPI, colonnes du tableau, liste (page 1),
   * options du panneau, activité et objectifs. `ngOnInit` a déjà chargé la sélection du départ.
   */
  private readonly followHeaderPays = effect(() => {
    const pays = this.pays();
    untracked(() => {
      if (pays === this.loadedPays) return;
      this.loadedPays = pays;
      this.currentPage.set(0);
      this.reload();
      this.loadFilterOptions();
      this.loadExtras();
    });
  });

  /** Bumped per extras fetch: a slow answer for previous flags is dropped. */
  private extrasSeq = 0;

  /** The drawer's two feeds are independent — they must never hold up the board. */
  private loadExtras(): void {
    const seq = ++this.extrasSeq;
    const pays = this.pays();
    forkJoin({
      activity:   this.pipelineSvc.getActivity(pays).pipe(catchError(() => of([] as PipelineActivity[]))),
      objectives: this.pipelineSvc.getObjectives(pays).pipe(catchError(() => of([] as PipelineObjective[]))),
    }).subscribe(({ activity, objectives }) => {
      if (seq !== this.extrasSeq) return;
      this.activities.set(activity);
      this.objectives.set(objectives);
      this.extrasLoading.set(false);
    });
  }

  /**
   * One call per readable column, in parallel. A column the user cannot read is not
   * requested at all; a failing call empties its own column only.
   */
  private fetchSources(): Observable<LifecycleSources> {
    const safe = <T>(key: LifecycleColumnKey, call: () => Observable<T[]>): Observable<T[]> =>
      this.canRead(key) ? call().pipe(catchError(() => of([] as T[]))) : of([] as T[]);
    // Every column follows the navbar's flags (absent = the role's whole scope).
    const pays = this.pays();
    return forkJoin({
      // The « Candidats » board's own feed: it carries the interview / offer facts the step needs.
      candidates:  safe('CANDIDATE', () => this.pipelineSvc.getKanban(pays).pipe(
        map(cols => (cols ?? []).flatMap(c => c.candidates ?? [])))),
      it:          safe('IT', () => this.itSvc.getPendingList(pays)),
      onboarding:  safe('ONBOARDING', () => this.onboardingSvc.getPendingList(pays)),
      cdi:         safe('CDI', () => this.cdiSvc.list(false, pays)),
      offboarding: safe('OFFBOARDING', () => this.offboardingSvc.listOffboarding({ paysId: pays })),
    });
  }

  /** Bumped per board fetch: a slow answer for previous flags is dropped. */
  private boardSeq = 0;

  private loadBoard(): void {
    this.boardLoading.set(true);
    const seq = ++this.boardSeq;
    this.fetchSources().subscribe(sources => {
      if (seq !== this.boardSeq) return;
      this.sources.set(sources);
      this.boardLoading.set(false);
    });
  }

  private loadStats(): void {
    this.svc.getDashboardStats(this.pays()).subscribe({ next: s => this.dashStats.set(s), error: () => {} });
  }

  /** Demand / department / date filters of the list view — applied server-side. */
  private panelFilterQuery(): CandidateListQuery {
    const demand = this.demandFilter();
    const range  = this.createdRange();
    return {
      // Les drapeaux de la navbar ; absent = tout le périmètre du rôle (serveur).
      paysId:       this.pays(),
      // The whole lifecycle — in recruitment, in onboarding, hired, closed — newest first.
      stage:        'LIFECYCLE',
      search:       this.search() || undefined,
      departmentId: this.departmentFilter() ? Number(this.departmentFilter()) : undefined,
      spontaneous:  demand === SPONTANEOUS || undefined,
      demandId:     demand && demand !== SPONTANEOUS ? Number(demand) : undefined,
      createdFrom:  range?.[0] ? toIsoDay(range[0]) : undefined,
      // A single picked day is a one-day range.
      createdTo:    range?.[0] ? toIsoDay(range[1] ?? range[0]) : undefined,
    };
  }

  /**
   * The demand and department options of the filter panel, for the navbar's countries.
   * Both endpoints take ONE pays: one flag → that one; none → the user's own (as before);
   * several → departments unfiltered then narrowed here, demands fetched per country.
   */
  private loadFilterOptions(): void {
    const ids = (this.pays() ?? '').split(',').filter(Boolean).map(Number);
    const own = this.userStore.currentUser()?.paysId;
    const single = ids.length === 1 ? ids[0] : ids.length === 0 ? own : undefined;
    this.refData.getDepartments(single).subscribe(items =>
      this.departments.set((items ?? [])
        .filter(d => d.isActive !== false)
        .filter(d => ids.length < 2 || (d.paysId != null && ids.includes(d.paysId)))));
    const demandPays = single != null ? [single] : ids;
    if (demandPays.length === 0) { this.demandOptions.set([]); return; }
    forkJoin(demandPays.map(id => this.demandSvc.getApprovedOptions(id)
        .pipe(catchError(() => of([] as ApprovedDemandOption[])))))
      .subscribe(lists => this.demandOptions.set(lists.flat()));
  }

  private loadCandidates(): void {
    this.loading.set(true);
    this.svc.getCandidates({
      ...this.panelFilterQuery(),
      status: this.statusFilter() || undefined,
      sort:   this.sort() ?? undefined,
      page:   this.currentPage(),
      size:   this.pageSize(),
    }).subscribe({
      next: r => {
        // Page restaurée devenue hors limites : on retombe sur la première.
        if (r.content.length === 0 && this.currentPage() > 0) {
          this.currentPage.set(0);
          this.loadCandidates();
          return;
        }
        this.page.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private reload(): void {
    this.loadStats();
    if (this.page()) this.loadCandidates();
    this.loadBoard();
  }

  // ── Toolbar handlers ───────────────────────────────────────────────────────
  setView(mode: string): void {
    const next = mode as ViewMode;
    if (this.viewMode() === next) return;
    this.viewMode.set(next);
    if (next === 'list' && !this.page()) this.loadCandidates();
  }

  /** The board filters client-side on `search()`; the list re-queries the server. */
  onSearch(value: string): void {
    if (value === this.search()) return; // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
    if (this.page()) this.loadCandidates();
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

  /** A header click in the list table: the backend orders every page, so re-fetch from page 0. */
  onSortChange(sort: string | null): void {
    this.sort.set(sort);
    this.currentPage.set(0);
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

  /** `from=recrutement` : le fil d'Ariane de la fiche ramène alors ici. */
  onView(id: number): void {
    this.router.navigate(['/rh/candidates', id], { queryParams: { from: 'recrutement' } });
  }

  /** A board card: each one carries the screen of its own module. */
  onOpenCard(card: LifecycleCard): void {
    this.router.navigate(card.commands, card.queryParams ? { queryParams: card.queryParams } : {});
  }

  // ── Accept / reject (list view, PENDING candidates only) ───────────────────
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
}

function nonNull<T>(v: T | null): v is T {
  return v !== null;
}
