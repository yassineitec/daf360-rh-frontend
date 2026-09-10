import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

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

import { RequestsService } from './requests.service';
import { EmployeeRequest, RequestStatus } from './models/request.model';
import { SlaCountdownPipe, SlaLevel, SlaResult } from '../../shared/sla-countdown.pipe';
import { RelativeDatePipe } from '../../shared/relative-date.pipe';
import { UserStore } from '../../core/user.store';
import { NewRequestComponent } from './new-request.component';
import { statusBadge } from '../../shared/status-badge.utils';
import { ConfirmService } from '../../core/confirm.service';
import { NotificationService } from '../../core/notification.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  RecruitmentValidationSectionComponent,
  RECRUITMENT_APPROVE_PERMISSION,
} from '../recruitment-demands/recruitment-validation-section.component';
import { RecruitmentDemandFormComponent } from '../recruitment-demands/recruitment-demand-form.component';

const ACTIVE_STATUSES: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'PENDING_L2'];

const SLA_BADGE_VARIANT: Record<SlaLevel, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  warning: 'warning',
  critical: 'danger',
  none: 'neutral',
};

/** Card-ready view model — one per visible request row. */
interface RequestCard {
  id: number;
  employeeLabel: string;
  /** Real photo endpoint — daf-avatar falls back to initials on its own if it 404s. */
  avatarUrl: string;
  type: string;
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
    AvatarComponent,
    ButtonComponent,
    CardComponent,
    MetricCardComponent,
    StatusBadgeComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    NewRequestComponent,
    RecruitmentDemandFormComponent,
    RecruitmentValidationSectionComponent,
    TabsComponent,
    RelativeDatePipe,
    TranslatePipe,
  ],
  template: `
    <!-- Canonical page per UI-PLAYBOOK §1: daf-page owns the 32px rhythm, so there are no
         space-y-* / mb-* between sections, and the title is the header's single h1. -->
    <daf-page [loading]="firstLoad()" [kpis]="4">

      <daf-page-header
        [title]="'REQUESTS.LIST.TITLE' | translate"
        [subtitle]="'REQUESTS.LIST.INTRO_TITLE' | translate">
        <daf-button pageActions
          [options]="{ variant: 'teal', label: ('REQUESTS.LIST.NEW_BTN' | translate), iconStart: 'add' }"
          (onClick)="showNew.set(true)" />
      </daf-page-header>

      <!-- ── Two top-level tabs, buttons above the content below — same daf-tabs
           pattern as the Affaires detail page and the recruitment popup, but as the
           page's own organizing structure this time: "Demande de recrutement" is a
           different table with a different approval chain than \`employee_requests\`,
           so it earns its own tab rather than living inside the other one.
           Only shown at all for RH_APPROVE_RECRUITMENT_DEMAND holders — everyone else
           has nothing to switch to, so they go straight to their own requests below. -->
      @if (canValidateRecruitment()) {
        <daf-tabs
          variant="underline"
          [tabs]="mainTabs()"
          [active]="mainTab()"
          (activeChange)="onMainTabChange($event)"
          [tabsLabel]="'REQUESTS.LIST.MAIN_TABS_ARIA' | translate" />
      }

      <!-- KPI row — mounted once, right under the tabs, and stays in place across a tab
           switch: only the four values (and what they mean) swap, read straight off the
           "Demande de recrutement" section via viewChild when that tab is active, so the
           cards never disappear/reappear the way a per-tab block would. -->
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

      @if (canValidateRecruitment() && mainTab() === 'recruitment') {
        <app-recruitment-validation-section />
      } @else {
        <!-- Always-on search by employee name — a non-technical user should never need to
             scan a long list by eye to find one person. No status filter here: this list is
             the "en cours" view only (not yet answered) — a request that already has a
             response (approuvée/rejetée/annulée) moves to the /rh/recruitment-demands
             historique instead. The "Filtres" panel narrows by urgency instead, same
             breakdown as the KPI row above. -->
        <daf-search-toolbar
          [placeholder]="'REQUESTS.LIST.SEARCH_PLACEHOLDER' | translate"
          [(value)]="searchQuery"
          [debounce]="200"
          [filterFields]="filterFields()"
          [filterConfig]="filterConfig()"
          (filterApply)="onFilterApply($event)" />

        <!-- Card list replaces the technical data table: each request is its own daf-card,
             avatar + name first, so a non-technical reader recognises "who" before "what". -->
        @if (loading()) {
          <div class="flex flex-col gap-3">
            @for (i of skeletonPlaceholders(); track i) {
              <div class="h-20 animate-pulse rounded-xl bg-surface-container"></div>
            }
          </div>
        } @else if (cards().length === 0) {
          <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">
            <div class="flex flex-col items-center gap-2 py-8 text-center">
              <span class="material-symbols-outlined text-[36px] text-outline-variant">
                {{ isNarrowedEmpty() ? 'search_off' : 'task_alt' }}
              </span>
              <p class="m-0 text-[14px] font-semibold text-on-surface">{{ emptyMessage() }}</p>
              <p class="m-0 text-[12px] text-outline">{{ emptyHint() }}</p>
            </div>
          </daf-card>
        } @else {
          <div class="flex flex-col gap-3">
            @for (card of cards(); track card.id) {
              <!-- Same glass/xl recipe as request-detail's own daf-card sections, so the list
                   and the detail page a click away read as one feature, not two designs. -->
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
                    @if (card.isActive) {
                      <daf-badge [label]="card.slaLabel" [options]="{ variant: card.slaVariant, size: 'sm', dot: true }" />
                    }
                  </div>

                  <div class="text-[12px] text-outline sm:w-32 sm:text-right">
                    {{ card.submissionDate | relativeDate }}
                  </div>

                  <div class="flex items-center justify-end gap-2">
                    <!-- Icon buttons styled exactly like daf-data-table's own trailing
                         actions column (same classes as its actionBtnClasses()), so this
                         card list's actions read as the same control as /rh/admin's tables. -->
                    <button type="button"
                      [title]="'REQUESTS.LIST.VIEW_DETAIL' | translate"
                      class="flex items-center justify-center p-1 rounded-md transition-all duration-150 text-on-surface-variant hover:opacity-70 cursor-pointer"
                      (click)="viewDetail(card.id)">
                      <span class="material-symbols-outlined" style="font-size:20px; font-variation-settings:'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24">visibility</span>
                    </button>
                    @if (canViewInbox() && card.isActive) {
                      <button type="button"
                        [title]="'REQUESTS.DETAIL.APPROVE_BTN' | translate"
                        class="flex items-center justify-center p-1 rounded-md transition-all duration-150 text-on-surface-variant hover:opacity-70 cursor-pointer"
                        (click)="approve(card.source)">
                        <span class="material-symbols-outlined" style="font-size:20px; font-variation-settings:'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24">check_circle</span>
                      </button>
                    }
                    @if (card.cancelDisabledReason) {
                      <button type="button" disabled
                        [title]="card.cancelDisabledReason"
                        class="flex items-center justify-center p-1 rounded-md transition-all duration-150 text-outline opacity-40 cursor-not-allowed">
                        <span class="material-symbols-outlined" style="font-size:20px; font-variation-settings:'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24">cancel</span>
                      </button>
                    } @else {
                      <button type="button"
                        [title]="'REQUESTS.DETAIL.CANCEL_BTN' | translate"
                        class="flex items-center justify-center p-1 rounded-md transition-all duration-150 text-danger hover:bg-error-container/40 hover:text-danger active:scale-95 cursor-pointer"
                        (click)="cancel(card.source)">
                        <span class="material-symbols-outlined" style="font-size:20px; font-variation-settings:'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24">cancel</span>
                      </button>
                    }
                  </div>
                </div>
              </daf-card>
            }
          </div>
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

    <!-- ── New request modal ─────────────────────────────── -->
    <!-- The header's "Nouvelle demande" button opens whichever form matches the active
         tab — an employee request normally, a recruitment demand while on "Demande de
         recrutement" — so the one button always creates what the visible list is a list of. -->
    <app-new-request
      [visible]="showNew() && mainTab() !== 'recruitment'"
      [profileId]="currentProfileId()"
      [paysId]="currentPaysId()"
      (closed)="showNew.set(false)"
      (submitted)="onSubmitted()"
    />

    <app-recruitment-demand-form
      [visible]="showNew() && mainTab() === 'recruitment'"
      (closed)="showNew.set(false)"
      (saved)="onRecruitmentDemandSaved()"
    />
  `,
})
export class RequestListComponent implements OnInit {
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
  showNew = signal(false);
  searchQuery = signal('');
  /** The one filter dimension left once status no longer applies here — same three levels
   *  as the KPI row above ('all' shows everything, matching the unfiltered KPI total). */
  urgencyFilter = signal<'all' | 'critical' | 'warning' | 'ok'>('all');

  /** Which of the two top-level tabs is showing — defaults to the employee's own
   *  requests, the reason most visitors land on this page. */
  mainTab = signal<'other' | 'recruitment'>('other');

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

  readonly mainTabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'other',       label: this.translate.instant('REQUESTS.LIST.MAIN_TAB_OTHER') },
      { id: 'recruitment', label: this.translate.instant('REQUESTS.LIST.MAIN_TAB_RECRUITMENT') },
    ];
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
   *  (approuvée/rejetée/annulée) belongs to the /rh/recruitment-demands historique instead,
   *  so there is no status filter here, just this one fixed rule. */
  private readonly activeRows = computed(() =>
    this.allRows().filter((r) => ACTIVE_STATUSES.includes(r.status)));

  /** The i18n keys already used for the KPI labels double as the filter's option labels,
   *  so the two never drift out of sync ("Urgentes" means the same thing in both). */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    return [{
      name: 'urgency',
      label: this.translate.instant('REQUESTS.LIST.FILTERS.URGENCY_LABEL'),
      type: 'select',
      options: [
        { value: 'all',      label: this.translate.instant('REQUESTS.LIST.FILTERS.URGENCY_ALL') },
        { value: 'critical', label: this.translate.instant('REQUESTS.LIST.KPI_URGENT') },
        { value: 'warning',  label: this.translate.instant('REQUESTS.LIST.KPI_SOON') },
        { value: 'ok',       label: this.translate.instant('REQUESTS.LIST.KPI_OK') },
      ],
    }];
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
      initialValues: { urgency: [this.urgencyFilter()] },
    };
  });

  onFilterApply(result: FilterResult): void {
    const value = result['urgency'];
    if (value === 'all' || value === 'critical' || value === 'warning' || value === 'ok') {
      this.urgencyFilter.set(value);
    }
  }

  /** Active rows further filtered by urgency, then by the employee-name search. */
  visibleRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const urgency = this.urgencyFilter();
    let rows = this.activeRows();
    if (urgency !== 'all') {
      rows = rows.filter((r) => this.slaPipe.transform(this.slaDeadline(r))?.level === urgency);
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

  /** True once search or the urgency filter has narrowed a non-empty queue down to
   *  nothing — as opposed to the queue itself being empty, which needs different wording. */
  readonly isNarrowedEmpty = computed(() =>
    this.activeRows().length > 0 && (!!this.searchQuery().trim() || this.urgencyFilter() !== 'all'));

  readonly emptyMessage = computed(() => this.translate.instant(
    this.isNarrowedEmpty() ? 'REQUESTS.LIST.SEARCH_EMPTY' : 'REQUESTS.LIST.EMPTY_ACTIVE'));

  readonly emptyHint = computed(() => this.translate.instant(
    this.isNarrowedEmpty() ? 'REQUESTS.LIST.SEARCH_EMPTY_HINT' : 'REQUESTS.LIST.EMPTY_HINT'));

  readonly cards = computed<RequestCard[]>(() => {
    this.translate.currentLang();
    return this.visibleRows().map((r) => {
      const isActive = this.isActive(r.status);
      const sla = isActive ? this.slaPipe.transform(this.slaDeadline(r)) : null;
      return {
        id: r.id,
        employeeLabel: r.employeeName
          ?? this.translate.instant('REQUESTS.COMMON.PROFILE_NUMBER', { id: r.employeeProfileId }),
        avatarUrl: `/api/hr/profiles/${r.employeeProfileId}/photo`,
        type: r.typeDisplayNameFr ?? this.translate.instant('REQUESTS.COMMON.REQUEST_NUMBER', { id: r.requestTypeId }),
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
  }

  reload(resetPage = true) {
    if (resetPage) this.page.set(0);
    this.loading.set(true);
    // Same permission-gated "own vs everyone" split as /rh/recruitment-demands
    // (canViewAll there, canViewInbox here): HR managers and admins already see
    // every pending request through the inbox, so the same role sees every
    // request here too — everyone else still sees only their own.
    const filter = this.canViewInbox()
      ? { paysId: this.currentPaysId(), page: this.page(), size: this.pageSize() }
      : { profileId: this.currentProfileId() || undefined, page: this.page(), size: this.pageSize() };
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

  onSubmitted() {
    this.showNew.set(false);
    this.reload();
    this.notification.success(
      this.translate.instant('REQUESTS.LIST.NEW_SUCCESS'),
      this.translate.instant('REQUESTS.LIST.NEW_SUCCESS_TITLE'));
  }

  /** Refreshes the "Demande de recrutement" queue in place — the section stays mounted
   *  while its tab is active, so its own `ngOnInit` never refires on its own. */
  onRecruitmentDemandSaved(): void {
    this.showNew.set(false);
    this.recruitmentSection()?.load();
  }

  /** New requests are created on the shell's self-service page (a different app),
   *  so navigate the top-level window rather than the remote's router. */
  goToSelfService() {
    window.location.href = '/home/self-service';
  }

  /** Computes a pseudo SLA deadline from submission + defaultSlaDays (we use 3 days as default). */
  slaDeadline(row: EmployeeRequest): string | null {
    if (!row.submissionDate) return null;
    const d = new Date(row.submissionDate);
    d.setDate(d.getDate() + 3);
    return d.toISOString();
  }
}
