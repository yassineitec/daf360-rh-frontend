import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

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

import { RequestsService } from './requests.service';
import { EmployeeRequest, RequestStatus, RequestType } from './models/request.model';
import { SlaCountdownPipe, SlaLevel, SlaResult } from '../../shared/sla-countdown.pipe';
import {
  RequestCardAction, RequestCardItem, RequestCardsSectionComponent, requestRef,
} from './request-cards-section.component';
import { RequestTableSectionComponent } from './request-table-section.component';
import { ListViewMode } from '../../shared/view-toggle.component';
import { UserStore } from '../../core/user.store';
import { statusBadge } from '../../shared/status-badge.utils';
import { ConfirmService } from '../../core/confirm.service';
import { NotificationService } from '../../core/notification.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  RecruitmentValidationSectionComponent,
  RECRUITMENT_APPROVE_PERMISSION,
} from '../recruitment-demands/recruitment-validation-section.component';
type MainTab = 'other' | 'recruitment';

const ACTIVE_STATUSES: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'PENDING_L2'];

/** Local calendar day as `yyyy-MM-dd` — `toISOString()` would shift it to UTC. */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}


const SLA_BADGE_VARIANT: Record<SlaLevel, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  warning: 'warning',
  critical: 'danger',
  none: 'neutral',
};

/** Card/row-ready view model — one per visible request, shared by both views. */
interface RequestCard {
  id: number;
  /** Display reference, e.g. `REQ-2026-000123`. */
  ref: string;
  employeeLabel: string;
  type: string;
  /** `RequestType.category`, translated — '' until the type catalog has loaded. */
  categoryLabel: string;
  status: ReturnType<typeof statusBadge>;
  isActive: boolean;
  sla: SlaResult | null;
  slaLabel: string;
  slaVariant: 'success' | 'warning' | 'danger' | 'neutral';
  submissionDate: string;
  /** null when the request can be cancelled; otherwise the reason to show as a tooltip. */
  cancelDisabledReason: string | null;
  source: EmployeeRequest;
}

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    RecruitmentValidationSectionComponent,
    RequestCardsSectionComponent,
    RequestTableSectionComponent,
    TabsComponent,
    TranslatePipe,
  ],
  template: `
    <!-- Canonical page per UI-PLAYBOOK §1: daf-page owns the 32px rhythm, so there are no
         space-y-* / mb-* between sections, and the title is the header's single h1. -->
    <daf-page [loading]="firstLoad()" [kpis]="4">

      <!-- No "Nouvelle demande" button here: requests are raised from the shell's
           self-service page — this page is where they are processed. -->
      <daf-page-header
        [title]="'REQUESTS.LIST.TITLE' | translate"
        [subtitle]="'REQUESTS.LIST.INTRO_TITLE' | translate" />

      <!-- KPI row — mounted once, above the tabs, and stays in place across a tab switch:
           only the four values (and what they mean) swap with the active tab, read straight
           off the "Demande de recrutement" section via viewChild when that tab is active, so
           the cards never disappear/reappear the way a per-tab block would. -->
      <section class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        @if (canValidateRecruitment() && mainTab() === 'recruitment') {
          <daf-metric-card
            [label]="'RECRUITMENT_VALIDATION.KPI_TOTAL' | translate"
            [value]="(recruitmentSection()?.total() ?? 0).toString()"
            [options]="{ icon: 'hourglass_empty', iconColor: 'text-warning', iconBg: 'bg-warning/10' }" />
          <daf-metric-card
            [label]="'RECRUITMENT_VALIDATION.KPI_HEADCOUNT' | translate"
            [value]="(recruitmentSection()?.demandKpis()?.headcount ?? 0).toString()"
            [options]="{ icon: 'groups', iconColor: 'text-primary', iconBg: 'bg-primary/10' }" />
          <daf-metric-card
            [label]="'RECRUITMENT_VALIDATION.KPI_NO_CANDIDATES' | translate"
            [value]="(recruitmentSection()?.demandKpis()?.noCandidates ?? 0).toString()"
            [options]="{ icon: 'person_search', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />
          <daf-metric-card
            [label]="'RECRUITMENT_VALIDATION.KPI_OLD' | translate"
            [value]="(recruitmentSection()?.demandKpis()?.old ?? 0).toString()"
            [options]="{ icon: 'schedule', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />
        } @else {
          <daf-metric-card
            [label]="'REQUESTS.LIST.KPI_TOTAL' | translate"
            [value]="totalActive().toString()"
            [options]="{ icon: 'inbox', iconColor: 'text-primary', iconBg: 'bg-primary/10' }" />
          <daf-metric-card
            [label]="'REQUESTS.LIST.KPI_URGENT' | translate"
            [value]="slaCounts().critical.toString()"
            [options]="{ icon: 'priority_high', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />
          <daf-metric-card
            [label]="'REQUESTS.LIST.KPI_SOON' | translate"
            [value]="slaCounts().warning.toString()"
            [options]="{ icon: 'schedule', iconColor: 'text-warning', iconBg: 'bg-warning/10' }" />
          <daf-metric-card
            [label]="'REQUESTS.LIST.KPI_OK' | translate"
            [value]="slaCounts().ok.toString()"
            [options]="{ icon: 'check_circle', iconColor: 'text-success', iconBg: 'bg-success/10' }" />
        }
      </section>

      <!-- ── Two top-level tabs, buttons above the content below — same daf-tabs
           pattern as the Affaires detail page and the recruitment popup, but as the
           page's own organizing structure this time: "Demande de recrutement" is a
           different table with a different approval chain than \`employee_requests\`,
           so it earns its own tab rather than living inside the other one.
           Only shown at all for RH_APPROVE_RECRUITMENT_DEMAND holders — everyone else
           has nothing to switch to, so they go straight to their own requests below. -->
      @if (mainTabs().length > 1) {
        <daf-tabs
          variant="underline"
          [tabs]="mainTabs()"
          [active]="mainTab()"
          (activeChange)="onMainTabChange($event)"
          [tabsLabel]="'REQUESTS.LIST.MAIN_TABS_ARIA' | translate" />
      }

      @if (canValidateRecruitment() && mainTab() === 'recruitment') {
        <app-recruitment-validation-section />
      } @else {
        <!-- Always-on search by employee name — a non-technical user should never need to
             scan a long list by eye to find one person. No status filter here: this list is
             the "en cours" view only (not yet answered) — a request that already has a
             response (approuvée/rejetée/annulée) moves to the /rh/requests-history
             historique instead. The "Filtres" panel narrows by urgency instead, same
             breakdown as the KPI row above. -->
        <daf-search-toolbar
          [placeholder]="'REQUESTS.LIST.SEARCH_PLACEHOLDER' | translate"
          [(value)]="searchQuery"
          [debounce]="200"
          [filterFields]="filterFields()"
          [filterConfig]="filterConfig()"
          (filterApply)="onFilterApply($event)"
          [views]="viewOptions()"
          [view]="viewMode()"
          (viewChange)="setView($event)"
          [table]="tableSection()?.table() ?? null" />

        <!-- Both views render at every width: the card grid goes 1 → 2 → 3 columns, the
             table scrolls horizontally inside daf-data-table (same as /rh/it-provisioning). -->
        @if (viewMode() === 'grid') {
          <app-request-cards-section
            [items]="cards()"
            [loading]="loading()"
            [canApprove]="canViewInbox()"
            [emptyIcon]="isNarrowedEmpty() ? 'search_off' : 'task_alt'"
            [emptyMessage]="emptyMessage()"
            [emptyHint]="emptyHint()"
            (action)="onItemAction($event.action, $event.item)" />
        } @else {
          <app-request-table-section
            [items]="cards()"
            [loading]="loading()"
            [skeletonRows]="pageSize()"
            [canApprove]="canViewInbox()"
            [tools]="true"
            [serverSort]="true"
            (serverSortChange)="onSortChange($event)"
            [emptyMessage]="emptyMessage()"
            (action)="onItemAction($event.action, $event.item)" />
        }

        <!-- Same daf-pagination configuration as /rh/profiles — page-size selector +
             "1–20 sur 137" summary, always shown, not just past a first page. -->
        <daf-pagination
          [currentPage]="page()"
          [totalPages]="totalPages()"
          [totalElements]="total()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
          [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
          (pageChange)="goPage($event)"
          (pageSizeChange)="onPageSizeChange($event)" />
      }

    </daf-page>
  `,
})
export class RequestListComponent implements OnInit {
  /** Table view only (undefined in cards view) — its `daf-data-table` goes to the toolbar's `[table]`. */
  readonly tableSection = viewChild(RequestTableSectionComponent);

  private svc = inject(RequestsService);
  private confirm = inject(ConfirmService);
  private notification = inject(NotificationService);
  private userStore = inject(UserStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private slaPipe = new SlaCountdownPipe();

  /**
   * Whole-page skeleton, first load only — `daf-page [loading]`.
   *
   * Separate from `loading` on purpose (UI-PLAYBOOK §5): `loading` drives the card list's own
   * skeleton on every refetch, so a tab switch or a page change never blanks the
   * header and the toolbar the way a single flag would.
   */
  firstLoad = signal(true);
  loading = signal(false);
  allRows = signal<EmployeeRequest[]>([]);
  total = signal(0);
  totalPages = signal(1);
  page = signal(0);
  pageSize = signal(100);
  readonly pageSizeOptions = [20, 50, 100];
  /** Spring `sort` from the table header (e.g. `submissionDate,asc`); null = server default. */
  sort = signal<string | null>(null);
  searchQuery = signal('');
  /** The one filter dimension left once status no longer applies here — same three levels
   *  as the KPI row above ('all' shows everything, matching the unfiltered KPI total). */
  urgencyFilter = signal<'all' | 'critical' | 'warning' | 'ok'>('all');
  /** Request type id as a string ('' = all types). */
  typeFilter = signal('');
  /** One of the "en cours" statuses ('' = all three). */
  statusFilter = signal('');
  /** Submission-date range from the panel: one day or [from, to]; null = no bound. */
  submittedRange = signal<Date[] | null>(null);

  /** Cards or table — both views take the same `cards()`; always opens on cards, like the other lists. */
  viewMode = signal<ListViewMode>('grid');
  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'grid',  icon: 'grid_view', tooltip: this.translate.instant('REQUESTS.LIST.VIEW_GRID') },
      { id: 'table', icon: 'view_list', tooltip: this.translate.instant('REQUESTS.LIST.VIEW_TABLE') },
    ];
  });

  /** Request type catalog by id — gives each card its category. */
  private readonly typesById = signal(new Map<number, RequestType>());

  /** Which of the two top-level tabs is showing — defaults to the employee's own
   *  requests, the reason most visitors land on this page. */
  mainTab = signal<MainTab>('other');

  /** Reactive reference to the child section, present only while its tab is active —
   *  read by the shared KPI row above so the cards don't need their own copy of its data. */
  readonly recruitmentSection = viewChild(RecruitmentValidationSectionComponent);

  protected readonly statusBadge = statusBadge;

  canViewInbox = computed(() => this.userStore.isHrManager() || this.userStore.isAdmin());

  /**
   * Gates the recruitment-validation section. Permission-based, not role-based: V31 grants
   * RH_APPROVE_RECRUITMENT_DEMAND to Directeur / DRH / Administrateur today, but the whole
   * point of a permission is that the grant can move without touching this page.
   */
  canValidateRecruitment = computed(() =>
    this.userStore.hasPermission(RECRUITMENT_APPROVE_PERMISSION));

  /** Only the tabs the caller may open; the strip is hidden when that leaves just one. */
  readonly mainTabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    const tabs: TabItem[] = [
      { id: 'other', label: this.translate.instant('REQUESTS.LIST.MAIN_TAB_OTHER') },
    ];
    if (this.canValidateRecruitment()) {
      tabs.push({ id: 'recruitment', label: this.translate.instant('REQUESTS.LIST.MAIN_TAB_RECRUITMENT') });
    }
    return tabs;
  });

  onMainTabChange(id: string): void {
    if (id === 'other' || id === 'recruitment') this.mainTab.set(id);
  }

  currentPaysId = computed(() => this.userStore.currentUser()?.paysId ?? 1);
  /** Officer id for `processRequest` — same field the officer inbox uses, distinct from
   *  `currentProfileId` (the employee-side id used for ownership checks and cancelling). */
  currentUserId = computed(() => this.userStore.currentUser()?.userId ?? 0);
  currentProfileId = computed(() => {
    const u = this.userStore.currentUser();
    if (!u) return 0;
    const fromEmployee = parseInt(u.employeeId ?? '', 10);
    return isNaN(fromEmployee) ? u.userId : fromEmployee;
  });

  /** Only "en cours" requests ever show on this page — one that already has a response
   *  (approuvée/rejetée/annulée) belongs to the /rh/requests-history historique instead,
   *  so there is no status filter here, just this one fixed rule. */
  private readonly activeRows = computed(() =>
    this.allRows().filter((r) => ACTIVE_STATUSES.includes(r.status)));

  /** The i18n keys already used for the KPI labels double as the filter's option labels,
   *  so the two never drift out of sync ("Urgentes" means the same thing in both). */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      {
        name: 'urgency',
        label: t('REQUESTS.LIST.FILTERS.URGENCY_LABEL'),
        type: 'select',
        options: [
          { value: 'all',      label: t('REQUESTS.LIST.FILTERS.URGENCY_ALL') },
          { value: 'critical', label: t('REQUESTS.LIST.KPI_URGENT') },
          { value: 'warning',  label: t('REQUESTS.LIST.KPI_SOON') },
          { value: 'ok',       label: t('REQUESTS.LIST.KPI_OK') },
        ],
      },
      {
        name: 'type',
        label: t('REQUESTS.LIST.COL_TYPE'),
        type: 'select',
        searchable: true,
        placeholder: t('REQUESTS.LIST.FILTERS.ALL_TYPES'),
        options: this.typeOptions(),
      },
      {
        name: 'status',
        label: t('REQUESTS.LIST.FILTERS.STATUS_LABEL'),
        type: 'select',
        placeholder: t('REQUESTS.LIST.FILTERS.ALL_STATUSES'),
        options: ACTIVE_STATUSES.map(code => ({ value: code, label: t('REQUESTS.STATUS.' + code) })),
      },
      {
        name: 'submitted',
        label: t('REQUESTS.LIST.COL_SUBMITTED'),
        type: 'daterange',
      },
    ];
  });

  /**
   * Distinct request types of the loaded "en cours" queue, sorted by label. The label
   * follows the UI language (EN name from the admin catalog, FR when it is blank).
   */
  private readonly typeOptions = computed(() => {
    const isEn = (this.translate.currentLang() ?? '').startsWith('en');
    const byId = new Map<number, string>();
    for (const r of this.activeRows()) {
      if (!byId.has(r.requestTypeId)) {
        byId.set(r.requestTypeId, (isEn && r.typeDisplayNameEn) || r.typeDisplayNameFr
          || this.translate.instant('REQUESTS.COMMON.REQUEST_NUMBER', { id: r.requestTypeId }));
      }
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ value: String(id), label }))
      .sort((a, b) => a.label.localeCompare(b.label, isEn ? 'en' : 'fr'));
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
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
        urgency:   [this.urgencyFilter()],
        type:      this.typeFilter()   ? [this.typeFilter()]   : [],
        status:    this.statusFilter() ? [this.statusFilter()] : [],
        submitted: this.submittedRange(),
      },
    };
  });

  onFilterApply(result: FilterResult): void {
    const str = (key: string) => typeof result[key] === 'string' ? result[key] as string : '';
    const value = result['urgency'];
    // A reset clears the select — back to "all", the unfiltered default.
    this.urgencyFilter.set(
      value === 'critical' || value === 'warning' || value === 'ok' ? value : 'all');
    this.typeFilter.set(str('type'));
    this.statusFilter.set(str('status'));
    const range = result['submitted'];
    this.submittedRange.set(Array.isArray(range) && range.length ? range as Date[] : null);
  }

  /** True when any filter-panel field (not the search box) narrows the queue. */
  private readonly hasPanelFilter = computed(() =>
    this.urgencyFilter() !== 'all' || !!this.typeFilter() || !!this.statusFilter() || !!this.submittedRange());

  /** Active rows further filtered by the panel (urgency, type, status, submission date),
   *  then by the employee-name search — all client-side, over the fetched batch. */
  visibleRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const urgency = this.urgencyFilter();
    const type = this.typeFilter();
    const status = this.statusFilter();
    const range = this.submittedRange();
    let rows = this.activeRows();
    if (urgency !== 'all') {
      rows = rows.filter((r) => this.slaPipe.transform(this.slaDeadline(r))?.level === urgency);
    }
    if (type) {
      rows = rows.filter((r) => String(r.requestTypeId) === type);
    }
    if (status) {
      rows = rows.filter((r) => r.status === status);
    }
    if (range?.[0]) {
      // A single picked day is a one-day range; compared as local calendar days.
      const from = toIsoDay(range[0]);
      const to = toIsoDay(range[1] ?? range[0]);
      rows = rows.filter((r) => {
        if (!r.submissionDate) return false;
        const day = toIsoDay(new Date(r.submissionDate));
        return day >= from && day <= to;
      });
    }
    if (q) {
      rows = rows.filter((r) => (r.employeeName ?? '').toLowerCase().includes(q));
    }
    return rows;
  });

  /** Counted from the fetched batch (like the Historique page's own KPI tiles), not the
   *  search-narrowed `visibleRows` — the KPI row describes the whole "en cours" queue. */
  readonly totalActive = computed(() => this.activeRows().length);

  /** SLA breakdown of the "en cours" queue — this page's one meaningful KPI split now
   *  that status (approuvée/rejetée/annulée) no longer applies to anything shown here. */
  readonly slaCounts = computed(() => {
    const counts = { critical: 0, warning: 0, ok: 0 };
    for (const r of this.activeRows()) {
      const level = this.slaPipe.transform(this.slaDeadline(r))?.level;
      if (level === 'critical' || level === 'warning' || level === 'ok') counts[level]++;
    }
    return counts;
  });

  readonly skeletonPlaceholders = computed(() =>
    Array.from({ length: Math.min(Math.max(this.visibleRows().length, 5), 20) }, (_, i) => i));

  /** True once search or a filter-panel field has narrowed a non-empty queue down to
   *  nothing — as opposed to the queue itself being empty, which needs different wording. */
  readonly isNarrowedEmpty = computed(() =>
    this.activeRows().length > 0 && (!!this.searchQuery().trim() || this.hasPanelFilter()));

  readonly emptyMessage = computed(() => this.translate.instant(
    this.isNarrowedEmpty() ? 'REQUESTS.LIST.SEARCH_EMPTY' : 'REQUESTS.LIST.EMPTY_ACTIVE'));

  readonly emptyHint = computed(() => this.translate.instant(
    this.isNarrowedEmpty() ? 'REQUESTS.LIST.SEARCH_EMPTY_HINT' : 'REQUESTS.LIST.EMPTY_HINT'));

  readonly cards = computed<RequestCard[]>(() => {
    this.translate.currentLang();
    return this.visibleRows().map((r) => {
      const isActive = this.isActive(r.status);
      const sla = isActive ? this.slaPipe.transform(this.slaDeadline(r)) : null;
      const category = this.typesById().get(r.requestTypeId)?.category;
      return {
        id: r.id,
        ref: requestRef(r),
        employeeLabel: r.employeeName
          ?? this.translate.instant('REQUESTS.COMMON.PROFILE_NUMBER', { id: r.employeeProfileId }),
        type: r.typeDisplayNameFr ?? this.translate.instant('REQUESTS.COMMON.REQUEST_NUMBER', { id: r.requestTypeId }),
        categoryLabel: category ? this.translate.instant('REQUESTS.CATEGORY.' + category) : '',
        status: this.statusBadge(r.status),
        isActive,
        sla,
        slaLabel: sla ? this.slaHumanLabel(sla) : '',
        slaVariant: sla ? SLA_BADGE_VARIANT[sla.level] : 'neutral',
        submissionDate: r.submissionDate,
        cancelDisabledReason: this.cancelDisabledReason(r),
        source: r,
      };
    });
  });

  viewDetail(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }

  /** One handler for both views — the card grid and the table emit the same actions. */
  onItemAction(action: RequestCardAction, item: RequestCardItem): void {
    switch (action) {
      case 'view':    this.viewDetail(item.id); break;
      case 'approve': this.approve(item.source); break;
      case 'cancel':
        // The table greys the button out; this guard also covers a stale click.
        if (!item.cancelDisabledReason) this.cancel(item.source);
        break;
    }
  }

  setView(id: string): void {
    if (id !== 'grid' && id !== 'table') return;
    this.viewMode.set(id);
  }

  isActive(status: string): boolean {
    return ACTIVE_STATUSES.includes(status as RequestStatus);
  }

  /**
   * Human-readable replacement for the raw SLA countdown ("2h restantes"): a non-technical
   * reader needs to know whether to act now, today, or not yet — not a duration.
   */
  slaHumanLabel(sla: SlaResult): string {
    switch (sla.level) {
      case 'critical':
        return this.translate.instant('REQUESTS.LIST.SLA_URGENT');
      case 'warning':
        return this.translate.instant(
          (sla.hours ?? 999) <= 24 ? 'REQUESTS.LIST.SLA_TODAY' : 'REQUESTS.LIST.SLA_SOON');
      case 'ok':
        return this.translate.instant('REQUESTS.LIST.SLA_OK');
      default:
        return '';
    }
  }

  /**
   * Null when the request can be cancelled (only while SUBMITTED, unchanged business rule).
   * Otherwise the reason shown on the disabled cancel button's tooltip, so the action stays
   * visible rather than disappearing — a non-technical user shouldn't have to wonder why a
   * button they expect isn't there.
   *
   * Ownership matters now that HR managers/admins can see everyone's requests here
   * (`canViewInbox`): cancelling submits the CURRENT user's profileId as the actor, so a
   * manager must never be able to cancel someone else's request from this list.
   */
  cancelDisabledReason(r: EmployeeRequest): string | null {
    if (r.employeeProfileId !== this.currentProfileId()) {
      return this.translate.instant('REQUESTS.LIST.CANCEL_REASON_NOT_OWNER');
    }
    if (r.status === 'SUBMITTED') return null;
    if (r.status === 'IN_REVIEW' || r.status === 'PENDING_L2') {
      return this.translate.instant('REQUESTS.LIST.CANCEL_REASON_PROCESSING');
    }
    return this.translate.instant('REQUESTS.LIST.CANCEL_REASON_CLOSED');
  }

  ngOnInit() {
    this.reload();
    this.svc.listTypes(this.currentPaysId())
      .pipe(catchError(() => of([] as RequestType[])))
      .subscribe((types) => this.typesById.set(new Map(types.map((t) => [t.id, t]))));
  }

  reload(resetPage = true) {
    if (resetPage) this.page.set(0);
    this.loading.set(true);
    // Same permission-gated "own vs everyone" split as /rh/requests-history
    // (canViewAll there, canViewInbox here): HR managers and admins already see
    // every pending request through the inbox, so the same role sees every
    // request here too — everyone else still sees only their own.
    const sort = this.sort() ?? undefined;
    const filter = this.canViewInbox()
      ? { paysId: this.currentPaysId(), sort, page: this.page(), size: this.pageSize() }
      : { profileId: this.currentProfileId() || undefined, sort, page: this.page(), size: this.pageSize() };
    this.svc
      .listRequests(filter)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.loading.set(false);
        // Cleared whether or not the call succeeded: on failure the page must render its
        // real (empty) state, not sit on a skeleton forever.
        this.firstLoad.set(false);
        if (res) {
          this.allRows.set(res.content);
          this.total.set(res.totalElements);
          this.totalPages.set(res.totalPages);
        }
      });
  }

  /** Server-side sort from the table (`manualSort`): the backend orders every page, so re-fetch from page 0. */
  onSortChange(sort: string | null): void {
    this.sort.set(sort);
    this.reload();
  }

  goPage(p: number) {
    this.page.set(p);
    this.reload(false);
  }

  /** `pageSizeChange` fires alone — go back to page 0 with the new size (same as /rh/profiles). */
  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.reload();
  }

  async cancel(row: EmployeeRequest) {
    if (!(await this.confirm.ask({
      title: this.translate.instant('REQUESTS.CANCEL.TITLE'),
      message: this.translate.instant('REQUESTS.CANCEL.MESSAGE'),
      confirmLabel: this.translate.instant('REQUESTS.CANCEL.CONFIRM'),
      cancelLabel: this.translate.instant('REQUESTS.CANCEL.BACK'),
    }))) return;
    this.svc
      .cancelRequest(row.id, this.currentProfileId())
      .pipe(catchError(() => of(null)))
      .subscribe((updated) => {
        if (updated) {
          this.allRows.update((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
          this.notification.success(
            this.translate.instant('REQUESTS.CANCEL.SUCCESS'),
            this.translate.instant('REQUESTS.CANCEL.SUCCESS_TITLE'));
        } else {
          this.notification.error(this.translate.instant('REQUESTS.CANCEL.ERROR'));
        }
      });
  }

  /** Same processRequest flow as the officer inbox's quickApprove — available here too,
   *  gated by `canViewInbox` since it's the same manager/admin audience. */
  async approve(row: EmployeeRequest) {
    if (!(await this.confirm.ask({
      title: this.translate.instant('REQUESTS.APPROVE.TITLE'),
      message: this.translate.instant('REQUESTS.APPROVE.MESSAGE'),
      confirmLabel: this.translate.instant('REQUESTS.APPROVE.CONFIRM'),
      cancelLabel: this.translate.instant('REQUESTS.APPROVE.BACK'),
    }))) return;
    this.svc
      .processRequest(row.id, this.currentUserId(), 'APPROVED', 'Approuvé')
      .pipe(catchError(() => of(null)))
      .subscribe((updated) => {
        if (updated) {
          this.allRows.update((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
          this.notification.success(
            this.translate.instant('REQUESTS.APPROVE.SUCCESS'),
            this.translate.instant('REQUESTS.APPROVE.SUCCESS_TITLE'));
        } else {
          this.notification.error(this.translate.instant('REQUESTS.APPROVE.ERROR'));
        }
      });
  }

  /** Computes a pseudo SLA deadline from submission + defaultSlaDays (we use 3 days as default). */
  slaDeadline(row: EmployeeRequest): string | null {
    if (!row.submissionDate) return null;
    const d = new Date(row.submissionDate);
    d.setDate(d.getDate() + 3);
    return d.toISOString();
  }
}
