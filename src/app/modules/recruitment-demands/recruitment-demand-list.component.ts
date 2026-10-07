import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import {
  FilterField,
  FilterResult,
  MetricCardComponent,
  PageComponent,
  PageHeaderComponent,
  PaginationComponent,
  SearchToolbarComponent,
  SearchToolbarFilterConfig,
  TabItem,
  TabsComponent,
  ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';

import { UserStore } from '../../core/user.store';
import { RecruitmentDemandService } from './recruitment-demand.service';
import { RECRUITMENT_REASONS, RecruitmentDemandSummary, RecruitmentDemandStatus } from './recruitment-demand.model';
import { RequestsService } from '../requests/requests.service';
import { EmployeeRequest, RequestStatus, RequestType, requestTypeName } from '../requests/models/request.model';
import { statusBadge } from '../../shared/status-badge.utils';
import { ListViewMode } from '../../shared/view-toggle.component';
import { RequestCardItem, RequestCardsSectionComponent, requestRef } from '../requests/request-cards-section.component';
import { RequestTableSectionComponent } from '../requests/request-table-section.component';
import { RecruitmentDemandCardsSectionComponent } from './sections/recruitment-demand-cards-section.component';
import { RecruitmentDemandTableSectionComponent } from './sections/recruitment-demand-table-section.component';

/** "En cours" (no response yet) belongs to /rh/requests — this page's "Demande" tab is
 *  the historique, so every other (decided) status shows here instead. */
const OTHER_ACTIVE_STATUSES: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'PENDING_L2'];

/** Local-time YYYY-MM-DD — never `toISOString()`, which shifts the day across time zones. */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inclusive [from, to] ISO-day bounds of a daterange value — one day = one-day range. */
function dayBounds(range: Date[] | null): { from: string; to: string } | null {
  if (!range?.[0]) return null;
  return { from: toIsoDay(range[0]), to: toIsoDay(range[1] ?? range[0]) };
}

/** Whether an ISO datetime's local day falls inside `bounds` (no bounds = always true). */
function inDayBounds(iso: string | null | undefined, bounds: { from: string; to: string } | null): boolean {
  if (!bounds) return true;
  if (!iso) return false;
  const day = toIsoDay(new Date(iso));
  return day >= bounds.from && day <= bounds.to;
}


/** "En cours" (no decision yet) belongs to the /rh/requests validation queue — this tab is
 *  the historique, so EN_ATTENTE is excluded from every filter/KPI/fetch below. */
type DecidedStatus = Exclude<RecruitmentDemandStatus, 'EN_ATTENTE'>;

const STATUS_FILTER_OPTS: { value: string; labelKey: string }[] = [
  { value: '',           labelKey: 'RECRUITMENT_DEMANDS.FILTER.ALL' },
  { value: 'APPROUVEE',  labelKey: 'RECRUITMENT_DEMANDS.FILTER.APPROUVEE' },
  { value: 'REJETEE',    labelKey: 'RECRUITMENT_DEMANDS.FILTER.REJETEE' },
  { value: 'ANNULEE',    labelKey: 'RECRUITMENT_DEMANDS.FILTER.ANNULEE' },
  { value: 'CLOTUREE',   labelKey: 'RECRUITMENT_DEMANDS.FILTER.CLOTUREE' },
];

/** Same traffic-light mapping as the old `.badge-*` CSS classes, in `daf-badge` terms. */
const STATUS_VARIANT: Record<RecruitmentDemandStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  EN_ATTENTE: 'warning',
  APPROUVEE:  'success',
  REJETEE:    'danger',
  ANNULEE:    'neutral',
  CLOTUREE:   'info',
};

/** One KPI tile per decided status, same icon/colour language as the status badge above. */
const STATUS_KPI: Record<DecidedStatus, { labelKey: string; icon: string; iconColor: string; iconBg: string }> = {
  APPROUVEE:  { labelKey: 'RECRUITMENT_DEMANDS.FILTER.APPROUVEE',  icon: 'check_circle',    iconColor: 'text-success', iconBg: 'bg-success/10' },
  REJETEE:    { labelKey: 'RECRUITMENT_DEMANDS.FILTER.REJETEE',    icon: 'cancel',          iconColor: 'text-danger',  iconBg: 'bg-danger/10' },
  ANNULEE:    { labelKey: 'RECRUITMENT_DEMANDS.FILTER.ANNULEE',    icon: 'block',           iconColor: 'text-outline', iconBg: 'bg-surface-container' },
  CLOTUREE:   { labelKey: 'RECRUITMENT_DEMANDS.FILTER.CLOTUREE',   icon: 'task_alt',        iconColor: 'text-teal',    iconBg: 'bg-teal/10' },
};
const STATUS_KPI_ORDER: DecidedStatus[] = ['APPROUVEE', 'REJETEE', 'ANNULEE', 'CLOTUREE'];

@Component({
  selector: 'app-recruitment-demand-list',
  standalone: true,
  imports: [
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    TabsComponent,
    TranslatePipe,
    RecruitmentDemandCardsSectionComponent,
    RecruitmentDemandTableSectionComponent,
    RequestCardsSectionComponent,
    RequestTableSectionComponent,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="0">

      <!-- No "Nouvelle demande" button, same as /rh/requests: requests and recruitment
           demands are raised from the shell's self-service page — this is the historique. -->
      <daf-page-header
        [title]="'RECRUITMENT_DEMANDS.LIST.TITLE' | translate" />

      <!-- KPI row above the tabs, same place as on /rh/requests: it swaps with the active
           tab — one tile per decided status (EN_ATTENTE lives on the /rh/requests
           validation queue instead), so the whole historique's shape is visible before
           scrolling to any single card below. Purely informational: filtering still
           happens through the "Filtres" toolbar underneath. -->
      @if (mainTab() === 'recruitment') {
        <section class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          <daf-metric-card
            [label]="'RECRUITMENT_DEMANDS.LIST.KPI_TOTAL' | translate"
            [value]="kpiGrandTotal().toString()"
            [options]="{ icon: 'work', iconColor: 'text-primary', iconBg: 'bg-primary/10' }" />
          @for (kpi of statusKpis(); track kpi.status) {
            <daf-metric-card
              [label]="kpi.label"
              [value]="kpi.count.toString()"
              [options]="{ icon: kpi.icon, iconColor: kpi.iconColor, iconBg: kpi.iconBg }" />
          }
        </section>
      } @else {
        <section class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
          <daf-metric-card
            [label]="'RECRUITMENT_DEMANDS.LIST.OTHER_KPI_TOTAL' | translate"
            [value]="otherDecidedCount().toString()"
            [options]="{ icon: 'inbox', iconColor: 'text-primary', iconBg: 'bg-primary/10' }" />
          @for (kpi of otherStatusKpis(); track kpi.key) {
            <daf-metric-card
              [label]="kpi.label"
              [value]="kpi.count.toString()"
              [options]="{ icon: kpi.icon, iconColor: kpi.iconColor, iconBg: kpi.iconBg }" />
          }
        </section>
      }

      <!-- Two tabs: this page is "Historique de demande" now, not just recruitment —
           its history must cover both demand types, same daf-tabs pattern as the
           Demandes page's own "Demande" / "Demande de recrutement" split. -->
      <daf-tabs
        variant="underline"
        [tabs]="mainTabs()"
        [active]="mainTab()"
        (activeChange)="onMainTabChange($event)"
        [tabsLabel]="'RECRUITMENT_DEMANDS.LIST.MAIN_TABS_ARIA' | translate" />

      @if (mainTab() === 'recruitment') {
        <!-- Same daf-search-toolbar as the "Demande de recrutement" tab on the Demandes
             page — search on the left, the cards/table switch then "Filtres" on the right. -->
        <daf-search-toolbar
          [placeholder]="'RECRUITMENT_DEMANDS.LIST.SEARCH_PLACEHOLDER' | translate"
          [(value)]="searchQuery"
          [debounce]="200"
          [filterFields]="filterFields()"
          [filterConfig]="filterConfig()"
          (filterApply)="onFilterApply($event)"
          [views]="viewOptions()"
          [view]="viewMode()"
          (viewChange)="setView($event)"
          [table]="recruitmentTableSection()?.table() ?? null" />

        <!-- daf-entity-card grid or daf-data-table — same two views as /rh/it-provisioning. -->
        @if (viewMode() === 'grid') {
          <app-recruitment-demand-cards-section
            [items]="visibleItems()"
            [loading]="loading()"
            emptyIcon="work_off"
            [emptyMessage]="'RECRUITMENT_DEMANDS.LIST.EMPTY' | translate"
            (action)="viewDetail($event.demand.id)" />
        } @else {
          <app-recruitment-demand-table-section
            [items]="visibleItems()"
            [loading]="loading()"
            [skeletonRows]="pageSize()"
            [tools]="true"
            [serverSort]="true"
            (serverSortChange)="onSortChange($event)"
            [emptyMessage]="'RECRUITMENT_DEMANDS.LIST.EMPTY' | translate"
            (action)="viewDetail($event.demand.id)" />
        }

        <!-- Same daf-pagination configuration as /rh/profiles — page-size selector +
             "1–20 sur 137" summary, always shown. -->
        <daf-pagination
          [currentPage]="page()"
          [totalPages]="totalPages()"
          [totalElements]="recruitmentDisplayTotal()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
          [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
          (pageChange)="changePage($event)"
          (pageSizeChange)="onPageSizeChange($event)" />
      } @else {
        <!-- "Demande" — the employee_requests history, same card / table sections as the
             Demandes page's own "Demande" tab. Same permission split too: HR managers/admins
             see everyone's requests here, everyone else sees only their own. -->
        <!-- Same "Filtres" button folded into the toolbar as everywhere else on this page
             (and on the Demandes page's own "Demande" tab), with the same view switch. -->
        <daf-search-toolbar
          [placeholder]="'RECRUITMENT_DEMANDS.LIST.OTHER_SEARCH_PLACEHOLDER' | translate"
          [(value)]="otherSearchQuery"
          [debounce]="200"
          [filterFields]="otherFilterFields()"
          [filterConfig]="otherFilterConfig()"
          (filterApply)="onOtherFilterApply($event)"
          [views]="viewOptions()"
          [view]="viewMode()"
          (viewChange)="setView($event)"
          [table]="otherTableSection()?.table() ?? null" />

        <!-- Same card / table sections as /rh/requests, in history mode: no cancel action
             (a decided request has nothing left to cancel), decision date instead of SLA. -->
        @if (viewMode() === 'grid') {
          <app-request-cards-section
            [items]="otherCards()"
            [loading]="otherLoading()"
            [history]="true"
            emptyIcon="inbox"
            [emptyMessage]="'RECRUITMENT_DEMANDS.LIST.OTHER_EMPTY' | translate"
            (action)="viewOtherDemand($event.item.id)" />
        } @else {
          <app-request-table-section
            [items]="otherCards()"
            [loading]="otherLoading()"
            [skeletonRows]="otherPageSize()"
            [history]="true"
            [tools]="true"
            [serverSort]="true"
            (serverSortChange)="onOtherSortChange($event)"
            [emptyMessage]="'RECRUITMENT_DEMANDS.LIST.OTHER_EMPTY' | translate"
            (action)="viewOtherDemand($event.item.id)" />
        }

        <!-- Same daf-pagination configuration as /rh/profiles — page-size selector +
             "1–20 sur 137" summary, always shown. -->
        <daf-pagination
          [currentPage]="otherPage()"
          [totalPages]="otherTotalPages()"
          [totalElements]="otherDecidedCount()"
          [pageSize]="otherPageSize()"
          [pageSizeOptions]="pageSizeOptions"
          [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
          [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
          (pageChange)="changeOtherPage($event)"
          (pageSizeChange)="onOtherPageSizeChange($event)" />
      }

    </daf-page>
  `,
})
export class RecruitmentDemandListComponent implements OnInit {
  /** "Demande de recrutement" tab, table view only — its `daf-data-table` goes to the toolbar's `[table]`. */
  readonly recruitmentTableSection = viewChild(RecruitmentDemandTableSectionComponent);
  /** "Demande" tab, table view only — its `daf-data-table` goes to the toolbar's `[table]`. */
  readonly otherTableSection = viewChild(RequestTableSectionComponent);

  private svc          = inject(RecruitmentDemandService);
  private requestsSvc  = inject(RequestsService);
  private userStore    = inject(UserStore);
  private router       = inject(Router);
  private route        = inject(ActivatedRoute);
  private translate    = inject(TranslateService);

  readonly canViewAll = () => this.userStore.hasPermission('RH_VIEW_RECRUITMENT_DEMAND');
  /** Same gate as the Demandes page's own "Demande" tab — HR managers/admins see
   *  every employee's request history here too, not just their own. */
  readonly canViewAllRequests = () => this.userStore.isHrManager() || this.userStore.isAdmin();

  readonly currentProfileId = computed(() => {
    const u = this.userStore.currentUser();
    if (!u) return 0;
    const fromEmployee = parseInt(u.employeeId ?? '', 10);
    return isNaN(fromEmployee) ? u.userId : fromEmployee;
  });

  readonly currentPaysId = computed(() => this.userStore.currentUser()?.paysId ?? 1);

  /** Which of the two tabs is showing — "Demande" first and by default, same order and
   *  default as the Demandes page itself; "Recrutement" is one tab away. */
  mainTab = signal<'recruitment' | 'other'>('other');

  /** Cards or table — one choice for both tabs; always opens on cards, like the other lists. */
  readonly viewMode = signal<ListViewMode>('grid');
  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'grid',  icon: 'grid_view', tooltip: this.translate.instant('REQUESTS.LIST.VIEW_GRID') },
      { id: 'table', icon: 'view_list', tooltip: this.translate.instant('REQUESTS.LIST.VIEW_TABLE') },
    ];
  });

  setView(id: string): void {
    if (id !== 'grid' && id !== 'table') return;
    this.viewMode.set(id);
  }
  private recruitmentLoaded = false;

  readonly mainTabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'other',       label: this.translate.instant('RECRUITMENT_DEMANDS.LIST.MAIN_TAB_OTHER') },
      { id: 'recruitment', label: this.translate.instant('RECRUITMENT_DEMANDS.LIST.MAIN_TAB_RECRUITMENT') },
    ];
  });

  onMainTabChange(id: string): void {
    if (id !== 'recruitment' && id !== 'other') return;
    this.mainTab.set(id);
    // Lazy: no point fetching the recruitment history until someone actually looks.
    if (id === 'recruitment' && !this.recruitmentLoaded) {
      this.recruitmentLoaded = true;
      this.reload();
      this.loadCounts();
    }
  }

  items       = signal<RecruitmentDemandSummary[]>([]);
  total       = signal(0);
  totalPages  = signal(0);
  page        = signal(0);
  pageSize    = signal(20);
  /** Spring `sort` from the "Recrutement" table header (e.g. `submittedAt,asc`); null = server default. */
  sort        = signal<string | null>(null);
  readonly pageSizeOptions = [10, 20, 50, 100];
  firstLoad   = signal(true);
  loading     = signal(false);
  filterStatut = signal('');
  searchQuery  = signal('');
  /** Department label ('' = all) — client-side, on the current page only (backend takes `statut` only). */
  filterDepartment = signal('');
  /** Recruitment reason code ('' = all) — client-side, on the current page only. */
  filterReason = signal('');
  /** Submission date range: one day or [from, to]; null = no bound — client-side, current page only. */
  filterSubmitted = signal<Date[] | null>(null);

  /** One count per decided status, independent of the current filter — feeds the KPI row. */
  private readonly statusCounts = signal<Record<DecidedStatus, number>>({
    APPROUVEE: 0, REJETEE: 0, ANNULEE: 0, CLOTUREE: 0,
  });

  readonly kpiGrandTotal = computed(() =>
    Object.values(this.statusCounts()).reduce((sum, n) => sum + n, 0));

  /**
   * `total()` mirrors the raw backend page — exact when a specific status is selected
   * (the backend already filtered to it), but inflated by EN_ATTENTE when "Tous" fetches
   * every status at once. `kpiGrandTotal` (summed from the dedicated per-status counts
   * fetched for the KPI row) is the true historique total in that case, so the header
   * badge and the pagination summary use it instead of the raw backend figure.
   */
  readonly recruitmentDisplayTotal = computed(() =>
    this.filterStatut() ? this.total() : this.kpiGrandTotal());

  readonly statusKpis = computed(() => {
    this.translate.currentLang();
    const counts = this.statusCounts();
    return STATUS_KPI_ORDER.map((status) => ({
      status,
      count: counts[status],
      label: this.translate.instant(STATUS_KPI[status].labelKey),
      icon: STATUS_KPI[status].icon,
      iconColor: STATUS_KPI[status].iconColor,
      iconBg: STATUS_KPI[status].iconBg,
    }));
  });

  /** Departments present in the fetched page (plus the selected one, so it never vanishes). */
  /**
   * `value` is the stored (French) label — the filter matches on it — while the shown
   * label follows the UI language, using the English name from the admin when there is one.
   */
  private readonly departmentOptions = computed(() => {
    const isEn = (this.translate.currentLang() ?? '').startsWith('en');
    const byValue = new Map<string, string>();
    for (const d of this.items()) {
      if (d.department && !byValue.has(d.department)) {
        byValue.set(d.department, (isEn && d.departmentLabelEn) || d.department);
      }
    }
    const current = this.filterDepartment();
    if (current && !byValue.has(current)) byValue.set(current, current);
    return [...byValue]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      {
        name: 'status',
        label: t('RECRUITMENT_DEMANDS.LIST.FILTERS.STATUS_LABEL'),
        type: 'select',
        options: STATUS_FILTER_OPTS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
      },
      {
        name: 'department',
        label: t('RECRUITMENT_DEMANDS.FORM.DEPARTMENT'),
        type: 'select',
        searchable: true,
        placeholder: t('RECRUITMENT_DEMANDS.LIST.FILTERS.DEPARTMENT_ALL'),
        options: this.departmentOptions(),
      },
      {
        name: 'reason',
        label: t('RECRUITMENT_DEMANDS.LIST.COL_REASON'),
        type: 'select',
        placeholder: t('RECRUITMENT_DEMANDS.LIST.FILTERS.REASON_ALL'),
        options: RECRUITMENT_REASONS.map((r) => ({
          value: r.value,
          label: t('RECRUITMENT_DEMANDS.FORM.REASON.' + r.value + '_LABEL'),
        })),
      },
      {
        name: 'submitted',
        label: t('RECRUITMENT_DEMANDS.LIST.COL_SUBMITTED'),
        type: 'daterange',
      },
    ];
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('RECRUITMENT_DEMANDS.LIST.FILTERS.' + k);
    return {
      title:        t('TITLE'),
      triggerLabel: t('TRIGGER'),
      applyLabel:   t('APPLY'),
      cancelLabel:  t('CANCEL'),
      resetLabel:   t('RESET'),
      align:        'right',
      initialValues: {
        status:     [this.filterStatut()],
        department: this.filterDepartment() ? [this.filterDepartment()] : [],
        reason:     this.filterReason() ? [this.filterReason()] : [],
        submitted:  this.filterSubmitted(),
      },
    };
  });

  readonly statusVariant = (s: RecruitmentDemandStatus) => STATUS_VARIANT[s];

  /** Search is scoped to the current (server-paginated) page, like typing to narrow what's
   *  already on screen — it does not reach into pages not yet fetched. EN_ATTENTE is always
   *  excluded here too: the "Tous" filter option fetches every status from the backend (it
   *  has no "everything decided" filter of its own), so this is what actually keeps the
   *  "en cours" ones out of the historique when no more specific status is selected. */
  /** Department / reason / submission-date filters work the same way — on the fetched page
   *  only, since the backend list endpoints accept no parameter besides `statut`. */
  readonly visibleItems = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const department = this.filterDepartment();
    const reason = this.filterReason();
    const submitted = dayBounds(this.filterSubmitted());
    return this.items().filter((d) =>
      d.statut !== 'EN_ATTENTE'
      && (!department || d.department === department)
      && (!reason || d.recruitmentReason === reason)
      && inDayBounds(d.submittedAt, submitted)
      && (!q
        || (d.jobExactTitle ?? d.jobTitle).toLowerCase().includes(q)
        || (d.department ?? '').toLowerCase().includes(q)));
  });

  // ── "Autres demandes" tab (employee_requests history) ─────────────────────
  otherItems      = signal<EmployeeRequest[]>([]);
  otherTotal      = signal(0);
  otherTotalPages = signal(0);
  otherPage       = signal(0);
  otherPageSize   = signal(100);
  otherLoading    = signal(false);
  otherSearchQuery = signal('');
  otherStatusFilter = signal<'all' | 'approved' | 'rejected' | 'cancelled'>('all');
  /** Request type id as a string ('' = all) — server-side, sent as `typeId`. */
  otherTypeFilter = signal('');
  /** Submission date range: one day or [from, to]; null = no bound — client-side, on the fetched batch. */
  otherSubmittedFilter = signal<Date[] | null>(null);
  /** Decision date range (resolution date, or last update for cancelled ones) — client-side, fetched batch. */
  otherDecidedFilter = signal<Date[] | null>(null);
  /** Server-side sort of the "Demande" table (Spring `sort`, e.g. `resolutionDate,desc`) — test of `manualSort`. */
  otherSort = signal<string | null>(null);
  /** Request type catalogue of the current pays — feeds the "Type de demande" filter. */
  private readonly requestTypes = signal<RequestType[]>([]);

  /** "En cours" never appears in this filter — that status lives on /rh/requests only.
   *  "Tout" here means every decided request, not literally every status. */
  readonly otherFilterFields = computed<FilterField[]>(() => {
    const lang = this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [{
      name: 'status',
      label: this.translate.instant('REQUESTS.LIST.FILTERS.STATUS_LABEL'),
      type: 'select',
      options: [
        { value: 'all',       label: this.translate.instant('RECRUITMENT_DEMANDS.LIST.OTHER_FILTER_ALL', { count: this.otherDecidedCount() }) },
        { value: 'approved',  label: this.translate.instant('RECRUITMENT_DEMANDS.LIST.OTHER_FILTER_APPROVED', { count: this.otherApprovedCount() }) },
        { value: 'rejected',  label: this.translate.instant('RECRUITMENT_DEMANDS.LIST.OTHER_FILTER_REJECTED', { count: this.otherRejectedCount() }) },
        { value: 'cancelled', label: this.translate.instant('RECRUITMENT_DEMANDS.LIST.OTHER_FILTER_CANCELLED', { count: this.otherCancelledCount() }) },
      ],
    }, {
      name: 'type',
      label: t('REQUESTS.LIST.COL_TYPE'),
      type: 'select',
      searchable: true,
      placeholder: t('REQUESTS.LIST.FILTERS.TYPE_ALL'),
      options: this.requestTypes().map((rt) => ({
        value: String(rt.id),
        label: (lang === 'en' ? rt.displayNameEn : rt.displayNameFr) || rt.displayNameFr || rt.typeCode,
      })),
    }, {
      name: 'submitted',
      label: t('REQUESTS.LIST.COL_SUBMITTED'),
      type: 'daterange',
    }, {
      name: 'decided',
      label: t('REQUESTS.LIST.FILTERS.DECIDED_LABEL'),
      type: 'daterange',
    }];
  });

  readonly otherFilterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('REQUESTS.LIST.FILTERS.' + k);
    return {
      title:        t('TITLE'),
      triggerLabel: t('TRIGGER'),
      applyLabel:   t('APPLY'),
      cancelLabel:  t('CANCEL'),
      resetLabel:   t('RESET'),
      align:        'right',
      initialValues: {
        status:    [this.otherStatusFilter()],
        type:      this.otherTypeFilter() ? [this.otherTypeFilter()] : [],
        submitted: this.otherSubmittedFilter(),
        decided:   this.otherDecidedFilter(),
      },
    };
  });

  onOtherFilterApply(result: FilterResult): void {
    const value = result['status'];
    // A reset clears the select — fall back to "all" rather than keeping the old status.
    this.otherStatusFilter.set(
      value === 'approved' || value === 'rejected' || value === 'cancelled' ? value : 'all');
    const type = result['type'];
    this.otherTypeFilter.set(typeof type === 'string' ? type : '');
    const submitted = result['submitted'];
    this.otherSubmittedFilter.set(Array.isArray(submitted) && submitted.length ? submitted as Date[] : null);
    const decided = result['decided'];
    this.otherDecidedFilter.set(Array.isArray(decided) && decided.length ? decided as Date[] : null);
    // `typeId` is a real backend filter, so the batch itself changes — back to page 0.
    this.otherPage.set(0);
    this.loadOther();
  }

  /** Only decided requests (already have a response) ever reach this tab — "en cours" ones
   *  belong to /rh/requests instead. */
  private readonly otherDecidedItems = computed(() =>
    this.otherItems().filter((r) => !OTHER_ACTIVE_STATUSES.includes(r.status)));

  private readonly otherStatusFilteredItems = computed(() => {
    switch (this.otherStatusFilter()) {
      case 'approved':  return this.otherDecidedItems().filter((r) => r.status === 'APPROVED');
      case 'rejected':  return this.otherDecidedItems().filter((r) => r.status === 'REJECTED');
      case 'cancelled': return this.otherDecidedItems().filter((r) => r.status === 'CANCELLED');
      default:          return this.otherDecidedItems();
    }
  });

  /** Client-side, like the recruitment table's own search — narrows what this page
   *  already fetched rather than reaching into pages not yet loaded. */
  readonly otherVisibleItems = computed(() => {
    const q = this.otherSearchQuery().trim().toLowerCase();
    const submitted = dayBounds(this.otherSubmittedFilter());
    const decided = dayBounds(this.otherDecidedFilter());
    return this.otherStatusFilteredItems().filter((r) =>
      inDayBounds(r.submissionDate, submitted)
      // Cancelling never sets `resolutionDate` backend-side — `updatedAt` is when it happened.
      && inDayBounds(r.resolutionDate ?? r.updatedAt, decided)
      && (!q || (r.employeeName ?? '').toLowerCase().includes(q)));
  });

  /**
   * Counted from the fetched batch (like the Demandes page's own tab counts) rather than
   * with a separate count-per-status call: `loadOther` already pulls up to 100 at once.
   */
  readonly otherDecidedCount = computed(() => this.otherDecidedItems().length);
  readonly otherApprovedCount = computed(
    () => this.otherDecidedItems().filter((r) => r.status === 'APPROVED').length);
  readonly otherRejectedCount = computed(
    () => this.otherDecidedItems().filter((r) => r.status === 'REJECTED').length);
  readonly otherCancelledCount = computed(
    () => this.otherDecidedItems().filter((r) => r.status === 'CANCELLED').length);

  readonly otherStatusKpis = computed(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('RECRUITMENT_DEMANDS.LIST.' + k);
    return [
      { key: 'approved',  count: this.otherApprovedCount(),  label: t('OTHER_KPI_APPROVED'),
        icon: 'check_circle', iconColor: 'text-success', iconBg: 'bg-success/10' },
      { key: 'rejected',  count: this.otherRejectedCount(),  label: t('OTHER_KPI_REJECTED'),
        icon: 'cancel',       iconColor: 'text-danger',  iconBg: 'bg-danger/10' },
      { key: 'cancelled', count: this.otherCancelledCount(), label: t('OTHER_KPI_CANCELLED'),
        icon: 'block',        iconColor: 'text-outline', iconBg: 'bg-surface-container' },
    ];
  });

  /** Same view model as the /rh/requests cards, flagged as decided: no SLA, no cancel. */
  readonly otherCards = computed<RequestCardItem[]>(() => {
    this.translate.currentLang();
    const categories = new Map(this.requestTypes().map((t) => [t.id, t.category]));
    return this.otherVisibleItems().map((r) => {
      const category = categories.get(r.requestTypeId);
      return {
        id: r.id,
        ref: requestRef(r),
        employeeLabel: r.employeeName
          ?? this.translate.instant('REQUESTS.COMMON.PROFILE_NUMBER', { id: r.employeeProfileId }),
        type: requestTypeName(r, this.translate.currentLang()) ?? this.translate.instant('REQUESTS.COMMON.REQUEST_NUMBER', { id: r.requestTypeId }),
        categoryLabel: category ? this.translate.instant('REQUESTS.CATEGORY.' + category) : '',
        status: statusBadge(r.status, this.translate),
        isActive: false,
        sla: null,
        slaLabel: '',
        slaVariant: 'neutral',
        submissionDate: r.submissionDate,
        cancelDisabledReason: this.translate.instant('REQUESTS.LIST.CANCEL_REASON_CLOSED'),
        source: r,
      };
    });
  });

  /** A header click in the table: the backend sorts, so re-fetch from page 0 in the new order. */
  onOtherSortChange(sort: string | null): void {
    this.otherSort.set(sort);
    this.otherPage.set(0);
    this.loadOther();
  }

  changeOtherPage(p: number): void {
    this.otherPage.set(p);
    this.loadOther();
  }

  /** `pageSizeChange` fires alone — go back to page 0 with the new size (same as /rh/profiles). */
  onOtherPageSizeChange(size: number): void {
    this.otherPageSize.set(size);
    this.otherPage.set(0);
    this.loadOther();
  }

  viewOtherDemand(id: number): void {
    this.router.navigate(['/rh/requests', id]);
  }

  private loadOther(): void {
    this.otherLoading.set(true);
    const paysId = this.userStore.currentUser()?.paysId;
    // Size 100, same as the Demandes page's own "Demande" tab: large enough that the KPI
    // tiles above can be counted straight from this batch, no separate count-per-status call.
    const typeId = this.otherTypeFilter() ? Number(this.otherTypeFilter()) : undefined;
    const filter = this.canViewAllRequests()
      ? { paysId: paysId ?? undefined, typeId, page: this.otherPage(), size: this.otherPageSize() }
      : { profileId: this.currentProfileId() || undefined, typeId, page: this.otherPage(), size: this.otherPageSize() };
    const sort = this.otherSort() ?? undefined;

    this.requestsSvc.listRequests({ ...filter, sort })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.otherLoading.set(false);
        // "Demande" is the default tab, so its first fetch is what clears the whole-page
        // skeleton — recruitment's own `load()` only runs once someone switches tabs.
        this.firstLoad.set(false);
        if (res) {
          this.otherItems.set(res.content);
          this.otherTotal.set(res.totalElements);
          this.otherTotalPages.set(res.totalPages);
        }
      });
  }

  ngOnInit(): void {
    this.loadOther();
    this.requestsSvc.listTypes(this.currentPaysId())
      .pipe(catchError(() => of([] as RequestType[])))
      .subscribe((types) => this.requestTypes.set(types));
  }

  reload(): void {
    this.page.set(0);
    this.load();
  }

  onFilterApply(result: FilterResult): void {
    const value = result['status'];
    this.filterStatut.set(typeof value === 'string' ? value : '');
    const department = result['department'];
    this.filterDepartment.set(typeof department === 'string' ? department : '');
    const reason = result['reason'];
    this.filterReason.set(typeof reason === 'string' ? reason : '');
    const submitted = result['submitted'];
    this.filterSubmitted.set(Array.isArray(submitted) && submitted.length ? submitted as Date[] : null);
    this.reload();
  }

  /** Server-side sort from the table (`manualSort`): the backend orders every page, so re-fetch from page 0. */
  onSortChange(sort: string | null): void {
    this.sort.set(sort);
    this.page.set(0);
    this.load();
  }

  changePage(p: number): void {
    this.page.set(p);
    this.load();
  }

  /** `pageSizeChange` fires alone — go back to page 0 with the new size (same as /rh/profiles). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(0);
    this.load();
  }

  viewDetail(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }

  private load(): void {
    this.loading.set(true);
    const paysId = this.userStore.currentUser()?.paysId;
    const statut = this.filterStatut() as RecruitmentDemandStatus | '';

    const obs$ = (paysId && this.canViewAll())
      ? this.svc.listByPays(paysId, statut, this.page(), this.pageSize(), this.sort())
      : this.svc.listMine(statut, this.page(), this.pageSize(), this.sort());

    obs$.pipe(catchError(() => of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: this.pageSize() })))
      .subscribe((r) => {
        this.items.set(r.content);
        this.total.set(r.totalElements);
        this.totalPages.set(r.totalPages);
        this.loading.set(false);
        this.firstLoad.set(false);
      });
  }

  /**
   * One page-of-1 request per status just to read `totalElements` off each response —
   * there is no dedicated counts endpoint, and this is cheaper than fetching every
   * demand to count them client-side.
   */
  private loadCounts(): void {
    const paysId = this.userStore.currentUser()?.paysId;
    const countFor = (statut: RecruitmentDemandStatus) =>
      ((paysId && this.canViewAll())
        ? this.svc.listByPays(paysId, statut, 0, 1)
        : this.svc.listMine(statut, 0, 1)
      ).pipe(catchError(() => of(null)));

    forkJoin(Object.fromEntries(STATUS_KPI_ORDER.map((s) => [s, countFor(s)])) as Record<
      DecidedStatus, ReturnType<typeof countFor>
    >).subscribe((res) => {
      this.statusCounts.set(
        STATUS_KPI_ORDER.reduce((acc, s) => {
          acc[s] = res[s]?.totalElements ?? 0;
          return acc;
        }, {} as Record<DecidedStatus, number>),
      );
    });
  }
}
