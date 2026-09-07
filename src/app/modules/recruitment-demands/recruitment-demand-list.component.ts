import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import {
  AvatarComponent,
  ButtonComponent,
  CardComponent,
  FilterField,
  FilterResult,
  MetricCardComponent,
  PageComponent,
  PageHeaderComponent,
  PaginationComponent,
  SearchToolbarComponent,
  SearchToolbarFilterConfig,
  StatusBadgeComponent,
  TabItem,
  TabsComponent,
} from '@khalilrebhiitec/daf360';

import { UserStore } from '../../core/user.store';
import { RecruitmentDemandService } from './recruitment-demand.service';
import { RecruitmentDemandSummary, RecruitmentDemandStatus } from './recruitment-demand.model';
import { RecruitmentDemandFormComponent } from './recruitment-demand-form.component';
import { RequestsService } from '../requests/requests.service';
import { NewRequestComponent } from '../requests/new-request.component';
import { EmployeeRequest, RequestStatus } from '../requests/models/request.model';
import { statusBadge } from '../../shared/status-badge.utils';
import { RelativeDatePipe } from '../../shared/relative-date.pipe';

/** "En cours" (no response yet) belongs to /rh/requests — this page's "Demande" tab is
 *  the historique, so every other (decided) status shows here instead. */
const OTHER_ACTIVE_STATUSES: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'PENDING_L2'];

/** Card-ready view model for the "Recrutement" tab. */
interface RecruitmentCard {
  id: number;
  poste: string;
  subtitle: string;
  status: { label: string; options: { variant: 'success' | 'warning' | 'danger' | 'neutral' | 'info' } };
  urgencyLabel: string | null;
  submittedAt: string;
}

/** Card-ready view model for the "Demande" tab — a decided request has no SLA to show and
 *  can no longer be cancelled, so this carries neither (unlike the /rh/requests card). */
interface OtherRequestCard {
  id: number;
  employeeLabel: string;
  /** Real photo endpoint — daf-avatar falls back to initials on its own if it 404s. */
  avatarUrl: string;
  type: string;
  status: ReturnType<typeof statusBadge>;
  submissionDate: string;
  source: EmployeeRequest;
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
    AvatarComponent,
    ButtonComponent,
    CardComponent,
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    StatusBadgeComponent,
    TabsComponent,
    DatePipe,
    RelativeDatePipe,
    TranslatePipe,
    RecruitmentDemandFormComponent,
    NewRequestComponent,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="0">

      <daf-page-header
        [title]="'RECRUITMENT_DEMANDS.LIST.TITLE' | translate">
        <!-- Same principle as /rh/requests: one button, opening whichever form matches
             the active tab — an HR request on "Demande" (open to everyone, same as the
             self-service page), a recruitment demand on "Recrutement" (permission-gated). -->
        @if (mainTab() === 'other' || canCreate()) {
          <daf-button pageActions
            [options]="{ variant: 'teal', iconStart: 'add', label: ('RECRUITMENT_DEMANDS.LIST.NEW_DEMAND' | translate) }"
            (onClick)="showForm.set(true)" />
        }
      </daf-page-header>

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
        <!-- Status KPI row — same daf-metric-card tiles as the Pipeline RH page (§ KPIs),
             one per decided status (EN_ATTENTE lives on the /rh/requests validation queue
             instead), so the whole historique's shape is visible before scrolling to any
             single card below. Purely informational: filtering still happens through the
             "Filtres" toolbar underneath. -->
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

        <!-- Same daf-search-toolbar as the "Demande de recrutement" tab on the Demandes
             page — search on the left, the "Filtres" button (daf-filter) folded into it. -->
        <daf-search-toolbar
          [placeholder]="'RECRUITMENT_DEMANDS.LIST.SEARCH_PLACEHOLDER' | translate"
          [(value)]="searchQuery"
          [debounce]="200"
          [filterFields]="filterFields()"
          [filterConfig]="filterConfig()"
          (filterApply)="onFilterApply($event)" />

        <!-- Same daf-card recipe as the "Demande" tab — icon box instead of an avatar
             (a recruitment demand has no single person to show), same badges/date/action
             layout, so the two tabs read as one page instead of two designs. -->
        @if (visibleItems().length === 0 && !loading()) {
          <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
            <div class="flex flex-col items-center gap-3 py-8 text-center">
              <span class="material-symbols-outlined text-[36px] text-outline-variant">work_off</span>
              <p class="m-0 text-[14px] font-semibold text-on-surface">
                {{ 'RECRUITMENT_DEMANDS.LIST.EMPTY' | translate }}
              </p>
              @if (canCreate()) {
                <daf-button
                  [options]="{ variant: 'teal', label: ('RECRUITMENT_DEMANDS.LIST.CREATE_DEMAND' | translate) }"
                  (onClick)="showForm.set(true)" />
              }
            </div>
          </daf-card>
        } @else {
          <div class="flex flex-col gap-3">
            @for (card of recruitmentCards(); track card.id) {
              <daf-card class="block" [options]="{ variant: 'glass', padding: 'md', radius: 'xl', hoverable: true }">
                <div class="flex flex-wrap items-center gap-4">
                  <!-- Same daf-avatar rendering as the "Demande" card list — no photo for a
                       recruitment demand, so it falls back to initials derived from the poste. -->
                  <daf-avatar [data]="{ name: card.poste }" size="md" badgeBg="bg-teal" />

                  <div class="min-w-[180px] flex-1">
                    <p class="m-0 text-[15px] font-semibold text-on-surface">{{ card.poste }}</p>
                    <div class="mt-1 flex items-center gap-1.5 text-[13px] text-on-surface-variant">
                      <span class="material-symbols-outlined text-[16px] text-teal">description</span>
                      <span>{{ card.subtitle }}</span>
                    </div>
                  </div>

                  <div class="flex flex-col items-start gap-1.5 sm:items-end">
                    <daf-badge [label]="card.status.label" [options]="card.status.options" />
                    @if (card.urgencyLabel) {
                      <daf-badge [label]="card.urgencyLabel" [options]="{ variant: 'warning', pill: true, size: 'sm' }" />
                    }
                  </div>

                  <div class="text-[12px] text-outline sm:w-32 sm:text-right">
                    {{ card.submittedAt | date:'dd/MM/yyyy' }}
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- Real daf-button icon button, same convention as /rh/admin's own
                         edit/delete action icons. -->
                    <daf-button
                      variant="ghost"
                      [title]="'RECRUITMENT_DEMANDS.LIST.VIEW' | translate"
                      [options]="{ iconStart: 'visibility', size: 'sm' }"
                      (onClick)="viewDetail(card.id)" />
                  </div>
                </div>
              </daf-card>
            }
          </div>
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
        <!-- "Demande" — the employee_requests history, same daf-card recipe as the Demandes
             page's own "Demande" tab (avatar + name first, status/SLA badges, relative date,
             Voir/Annuler). Same permission split too: HR managers/admins see everyone's
             requests here, everyone else sees only their own. -->
        <!-- Same KPI row shape as the "Recrutement" tab, one tile per status group. -->
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

        <!-- Same "Filtres" button folded into the toolbar as everywhere else on this page
             (and on the Demandes page's own "Demande" tab). -->
        <daf-search-toolbar
          [placeholder]="'RECRUITMENT_DEMANDS.LIST.OTHER_SEARCH_PLACEHOLDER' | translate"
          [(value)]="otherSearchQuery"
          [debounce]="200"
          [filterFields]="otherFilterFields()"
          [filterConfig]="otherFilterConfig()"
          (filterApply)="onOtherFilterApply($event)" />

        @if (otherCards().length === 0 && !otherLoading()) {
          <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
            <div class="flex flex-col items-center gap-3 py-8 text-center">
              <span class="material-symbols-outlined text-[36px] text-outline-variant">inbox</span>
              <p class="m-0 text-[14px] font-semibold text-on-surface">
                {{ 'RECRUITMENT_DEMANDS.LIST.OTHER_EMPTY' | translate }}
              </p>
            </div>
          </daf-card>
        } @else {
          <div class="flex flex-col gap-3">
            @for (card of otherCards(); track card.id) {
              <daf-card class="block" [options]="{ variant: 'glass', padding: 'md', radius: 'xl', hoverable: true }">
                <div class="flex flex-wrap items-center gap-4">
                  <daf-avatar [data]="{ name: card.employeeLabel, avatarUrl: card.avatarUrl }" size="md" />

                  <div class="min-w-[180px] flex-1">
                    <p class="m-0 text-[15px] font-semibold text-on-surface">{{ card.employeeLabel }}</p>
                    <div class="mt-1 flex items-center gap-1.5 text-[13px] text-on-surface-variant">
                      <span class="material-symbols-outlined text-[16px] text-teal">description</span>
                      <span>{{ card.type }}</span>
                    </div>
                  </div>

                  <div class="flex flex-col items-start gap-1.5 sm:items-end">
                    <daf-badge [label]="card.status.label" [options]="card.status.options" />
                  </div>

                  <div class="text-[12px] text-outline sm:w-32 sm:text-right">
                    {{ card.submissionDate | relativeDate }}
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- View only — a decided request has no cancel action left, unlike the
                         "en cours" cards on /rh/requests. -->
                    <daf-button
                      variant="ghost"
                      [title]="'REQUESTS.LIST.VIEW_DETAIL' | translate"
                      [options]="{ iconStart: 'visibility', size: 'sm' }"
                      (onClick)="viewOtherDemand(card.id)" />
                  </div>
                </div>
              </daf-card>
            }
          </div>
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

    <!-- ── Create form modal — whichever form matches the active tab ─────────────── -->
    <app-recruitment-demand-form
      [visible]="showForm() && mainTab() === 'recruitment'"
      (closed)="showForm.set(false)"
      (saved)="onDemandSaved()"
    />

    <app-new-request
      [visible]="showForm() && mainTab() === 'other'"
      [profileId]="currentProfileId()"
      [paysId]="currentPaysId()"
      (closed)="showForm.set(false)"
      (submitted)="onEmployeeRequestSubmitted()"
    />
  `,
})
export class RecruitmentDemandListComponent implements OnInit {
  private svc          = inject(RecruitmentDemandService);
  private requestsSvc  = inject(RequestsService);
  private userStore    = inject(UserStore);
  private router       = inject(Router);
  private route        = inject(ActivatedRoute);
  private translate    = inject(TranslateService);

  readonly canCreate  = () => this.userStore.hasPermission('RH_CREATE_RECRUITMENT_DEMAND');
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
  readonly pageSizeOptions = [10, 20, 50, 100];
  firstLoad   = signal(true);
  loading     = signal(false);
  showForm    = signal(false);
  filterStatut = signal('');
  searchQuery  = signal('');

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

  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    return [{
      name: 'status',
      label: this.translate.instant('RECRUITMENT_DEMANDS.LIST.FILTERS.STATUS_LABEL'),
      type: 'select',
      options: STATUS_FILTER_OPTS.map((o) => ({ value: o.value, label: this.translate.instant(o.labelKey) })),
    }];
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
      initialValues: { status: [this.filterStatut()] },
    };
  });

  readonly statusVariant = (s: RecruitmentDemandStatus) => STATUS_VARIANT[s];

  /** Search is scoped to the current (server-paginated) page, like typing to narrow what's
   *  already on screen — it does not reach into pages not yet fetched. EN_ATTENTE is always
   *  excluded here too: the "Tous" filter option fetches every status from the backend (it
   *  has no "everything decided" filter of its own), so this is what actually keeps the
   *  "en cours" ones out of the historique when no more specific status is selected. */
  readonly visibleItems = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const decided = this.items().filter((d) => d.statut !== 'EN_ATTENTE');
    if (!q) return decided;
    return decided.filter((d) =>
      (d.jobExactTitle ?? d.jobTitle).toLowerCase().includes(q)
      || (d.department ?? '').toLowerCase().includes(q));
  });

  readonly recruitmentCards = computed<RecruitmentCard[]>(() => {
    this.translate.currentLang();
    return this.visibleItems().map((d) => ({
      id: d.id,
      poste: d.jobExactTitle ?? d.jobTitle,
      subtitle: [d.department, d.recruitmentReasonLabel].filter(Boolean).join(' • ') || '—',
      status: {
        label: this.translate.instant('RECRUITMENT_DEMANDS.STATUS.' + d.statut),
        options: { variant: this.statusVariant(d.statut) },
      },
      urgencyLabel: d.urgencyLevelLabel ?? null,
      submittedAt: d.submittedAt,
    }));
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

  /** "En cours" never appears in this filter — that status lives on /rh/requests only.
   *  "Tout" here means every decided request, not literally every status. */
  readonly otherFilterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
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
      initialValues: { status: [this.otherStatusFilter()] },
    };
  });

  onOtherFilterApply(result: FilterResult): void {
    const value = result['status'];
    if (value === 'all' || value === 'approved' || value === 'rejected' || value === 'cancelled') {
      this.otherStatusFilter.set(value);
    }
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
    const base = this.otherStatusFilteredItems();
    if (!q) return base;
    return base.filter((r) => (r.employeeName ?? '').toLowerCase().includes(q));
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

  /** No SLA and no cancel action here — a decided request has neither a countdown left to
   *  show nor a state left to cancel out of (unlike the /rh/requests card). */
  readonly otherCards = computed<OtherRequestCard[]>(() => {
    this.translate.currentLang();
    return this.otherVisibleItems().map((r) => ({
      id: r.id,
      employeeLabel: r.employeeName
        ?? this.translate.instant('REQUESTS.COMMON.PROFILE_NUMBER', { id: r.employeeProfileId }),
      avatarUrl: `/api/hr/profiles/${r.employeeProfileId}/photo`,
      type: r.typeDisplayNameFr ?? this.translate.instant('REQUESTS.COMMON.REQUEST_NUMBER', { id: r.requestTypeId }),
      status: statusBadge(r.status),
      submissionDate: r.submissionDate,
      source: r,
    }));
  });

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
    const filter = this.canViewAllRequests()
      ? { paysId: paysId ?? undefined, page: this.otherPage(), size: this.otherPageSize() }
      : { profileId: this.currentProfileId() || undefined, page: this.otherPage(), size: this.otherPageSize() };

    this.requestsSvc.listRequests(filter)
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
  }

  reload(): void {
    this.page.set(0);
    this.load();
  }

  /** Called after a demand is created — the list AND the KPI counts are both stale. */
  onDemandSaved(): void {
    this.reload();
    this.loadCounts();
  }

  /** Called after an HR request is submitted from the "Demande" tab's own button. */
  onEmployeeRequestSubmitted(): void {
    this.showForm.set(false);
    this.loadOther();
  }

  onFilterApply(result: FilterResult): void {
    const value = result['status'];
    this.filterStatut.set(typeof value === 'string' ? value : '');
    this.reload();
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
      ? this.svc.listByPays(paysId, statut, this.page(), this.pageSize())
      : this.svc.listMine(statut, this.page(), this.pageSize());

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
