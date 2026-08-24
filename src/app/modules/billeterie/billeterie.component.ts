import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  FilterField,
  FilterResult,
  MetricCardComponent,
  MetricDelta,
  PageComponent,
  PageHeaderComponent,
  PageHeaderBadge,
  PaginationComponent,
  SearchToolbarComponent,
  SearchToolbarFilterConfig,
  TabItem,
  TabsComponent,
  ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';

import { MissionService } from '../missions/mission.service';
import {
  Mission, MissionChangeRequest, MissionExpensePayload,
} from '../missions/mission.model';
import { MissionDetailDrawerComponent } from '../missions/mission-detail-drawer.component';
import { errorMessage, isLate } from '../missions/mission-display';
import { MissionExpenseModalComponent } from './mission-expense-modal.component';
import { MissionDecision, MissionDecisionModalComponent } from './mission-decision-modal.component';
import {
  BilleterieAction, BilleterieCardsSectionComponent,
} from './sections/billeterie-cards-section.component';
import { BilleterieTableSectionComponent } from './sections/billeterie-table-section.component';
import {
  ChangeRequestAction, ChangeRequestsTableSectionComponent,
} from './sections/change-requests-table-section.component';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type TabKey = 'queue' | 'requests';
type ViewMode = 'grid' | 'list';
/** The pricing filter — the only axis that means anything on a single-status queue. */
type PricedFilter = '' | 'priced' | 'unpriced';

/**
 * `/rh/billeterie` — RH's desk, in the canonical list shape (§1) so it reads like
 * `/rh/it-provisioning`: KPI row, `daf-search-toolbar` with a filter panel and a
 * cards/list toggle, one stateless section per view, `daf-pagination`.
 *
 * Two queues share the page as two `daf-tabs` panels, because they are one job: the
 * missions managers submitted, and the employees' asks on missions already validated.
 * The strip is lib-owned; the panel is ours, which is what lets the queue tab keep its own
 * view mode and paging.
 *
 * Validating is deliberately a separate act from saving the sheet: RH fills the sheet over
 * several sittings, and validating hands the file to finance for good.
 */
@Component({
  selector: 'rh-billeterie',
  standalone: true,
  imports: [
    MetricCardComponent, PageComponent, PageHeaderComponent, PaginationComponent,
    SearchToolbarComponent, TabsComponent, BilleterieCardsSectionComponent,
    BilleterieTableSectionComponent, ChangeRequestsTableSectionComponent,
    MissionExpenseModalComponent, MissionDecisionModalComponent,
    MissionDetailDrawerComponent, TranslatePipe,
  ],
  templateUrl: './billeterie.component.html',
})
export class BilleterieComponent implements OnInit {
  private svc = inject(MissionService);
  private translate = inject(TranslateService);

  // ── Data ─────────────────────────────────────────────────────────────────
  readonly missions = signal<Mission[]>([]);
  readonly requests = signal<MissionChangeRequest[]>([]);
  readonly firstLoad = signal(true);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ── View state ───────────────────────────────────────────────────────────
  readonly activeTab = signal<TabKey>('queue');
  readonly viewMode = signal<ViewMode>('grid');
  readonly search = signal('');
  readonly pricedFilter = signal<PricedFilter>('');
  readonly currentPage = signal(0);
  readonly pageSize = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // ── Dialogs ──────────────────────────────────────────────────────────────
  readonly selected = signal<Mission | null>(null);
  readonly pricing = signal<Mission | null>(null);
  readonly submitting = signal(false);
  readonly modalError = signal<string | null>(null);

  /**
   * What the decision modal is deciding. `target` is what lets one modal serve two
   * refusals — the mission itself, or an employee's ask on it. Both need a reason and both
   * show the same mission for context.
   */
  readonly deciding = signal<{
    target: 'mission' | 'request';
    mission: Mission;
    approve: boolean;
    request?: MissionChangeRequest;
  } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.error.set(null);
    this.svc.pendingHr().subscribe({
      next: list => {
        this.missions.set(list);
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      error: err => {
        this.error.set(errorMessage(err, this.translate));
        this.loading.set(false);
        this.firstLoad.set(false);
      },
    });
    // Independent and failure-tolerant: the asks tab must not keep the queue from
    // rendering when its endpoint is unhappy.
    this.svc.pendingChangeRequests()
      .pipe(catchError(() => of([] as MissionChangeRequest[])))
      .subscribe(list => this.requests.set(list));
  }

  // ── Projections ──────────────────────────────────────────────────────────
  readonly filteredItems = computed(() => {
    const term = this.search().trim().toLowerCase();
    const priced = this.pricedFilter();
    return this.missions().filter(m => {
      const matchesTerm = !term
        || (m.employeeName ?? '').toLowerCase().includes(term)
        || m.title.toLowerCase().includes(term)
        || m.city.toLowerCase().includes(term)
        || (m.countryLabel ?? '').toLowerCase().includes(term);
      const matchesPriced = !priced
        || (priced === 'priced' ? !!m.expenses : !m.expenses);
      return matchesTerm && matchesPriced;
    });
  });

  readonly totalElements = computed(() => this.filteredItems().length);
  readonly totalPages = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  readonly queueEmptyMessage = computed(() => {
    this.translate.currentLang();
    const filtered = !!this.search().trim() || !!this.pricedFilter();
    return this.translate.instant(filtered
      ? 'MISSIONS.LIST.EMPTY_FILTERED'
      : 'BILLETERIE.EMPTY_QUEUE');
  });

  // ── KPIs ─────────────────────────────────────────────────────────────────
  readonly stats = computed(() => {
    const all = this.missions();
    return {
      queue:    all.length,
      unpriced: all.filter(m => !m.expenses).length,
      late:     all.filter(m => isLate(m)).length,
      asks:     this.requests().length,
    };
  });

  readonly headerBadges = computed<PageHeaderBadge[]>(() => {
    const badges: PageHeaderBadge[] = [];
    if (this.missions().length) {
      badges.push({ label: String(this.missions().length), variant: 'warning', pill: true });
    }
    if (this.requests().length) {
      badges.push({ label: String(this.requests().length), variant: 'teal', pill: true });
    }
    return badges;
  });

  readonly queueDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const total = this.missions().length;
    if (total === 0) return null;
    const rate = Math.round(((total - this.stats().unpriced) / total) * 100);
    return {
      value: this.translate.instant('BILLETERIE.DELTA_PRICED', { pct: rate }),
      direction: rate >= 70 ? 'up' : rate >= 40 ? 'neutral' : 'down',
    };
  });

  readonly lateDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const late = this.stats().late;
    if (late === 0) return null;
    return {
      value: this.translate.instant('MISSIONS.KPI.DELTA_LATE', { count: late }),
      direction: 'down',
    };
  });

  // ── Tabs + toolbar ───────────────────────────────────────────────────────
  readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    return [
      {
        id: 'queue',
        label: this.translate.instant('BILLETERIE.TAB_QUEUE_SHORT'),
        icon: 'flight_takeoff',
        // `null` while empty rather than omitted: it keeps the badge's space reserved so
        // the label does not jump sideways when the first mission arrives.
        count: this.missions().length || null,
      },
      {
        id: 'requests',
        label: this.translate.instant('BILLETERIE.TAB_REQUESTS_SHORT'),
        icon: 'edit_calendar',
        count: this.requests().length || null,
      },
    ];
  });

  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [{
      name: 'priced',
      label: t('BILLETERIE.COL_STATE'),
      type: 'select',
      placeholder: t('MISSIONS.LIST.FILTER_ALL'),
      options: [
        { value: 'unpriced', label: t('BILLETERIE.NOT_PRICED') },
        { value: 'priced', label: t('BILLETERIE.PRICED') },
      ],
    }];
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      title: t('MISSIONS.LIST.FILTERS.TITLE'),
      applyLabel: t('MISSIONS.LIST.FILTERS.APPLY'),
      cancelLabel: t('MISSIONS.LIST.FILTERS.CANCEL'),
      resetLabel: t('MISSIONS.LIST.FILTERS.RESET'),
      triggerLabel: t('MISSIONS.LIST.FILTERS.TRIGGER'),
      align: 'right',
      // A `select` needs the panel's internal shape — a string[], not a bare string (§10b).
      initialValues: { priced: this.pricedFilter() ? [this.pricedFilter()] : [] },
    };
  });

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'grid', icon: 'grid_view', tooltip: this.translate.instant('MISSIONS.LIST.VIEW_GRID') },
      { id: 'list', icon: 'view_list', tooltip: this.translate.instant('MISSIONS.LIST.VIEW_LIST') },
    ];
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  onTabChange(id: string): void {
    if (id === 'queue' || id === 'requests') this.activeTab.set(id);
  }

  onSearch(value: string): void {
    if (value === this.search()) return;   // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
  }

  applyFilters(result: FilterResult): void {
    const value = typeof result['priced'] === 'string' ? result['priced'] : '';
    this.pricedFilter.set(value === 'priced' || value === 'unpriced' ? value : '');
    this.currentPage.set(0);
  }

  setView(mode: string): void {
    this.viewMode.set(mode as ViewMode);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
  }

  onQueueAction(event: { mission: Mission; action: BilleterieAction }): void {
    switch (event.action) {
      case 'view':     this.openDetail(event.mission); break;
      case 'price':    this.openExpenses(event.mission); break;
      case 'validate': this.askDecision(event.mission, true); break;
      case 'reject':   this.askDecision(event.mission, false); break;
    }
  }

  onRequestAction(event: { request: MissionChangeRequest; action: ChangeRequestAction }): void {
    if (event.action === 'accept') this.resolveRequest(event.request);
    else this.askRequestRefusal(event.request);
  }

  private openDetail(mission: Mission): void {
    this.svc.get(mission.id)
      .pipe(catchError(() => of(mission)))
      .subscribe(full => this.selected.set(full));
  }

  private openExpenses(mission: Mission): void {
    this.modalError.set(null);
    this.pricing.set(mission);
  }

  saveExpenses(payload: MissionExpensePayload): void {
    const mission = this.pricing();
    if (!mission) return;
    this.submitting.set(true);
    this.modalError.set(null);
    this.svc.saveExpenses(mission.id, payload).subscribe({
      next: saved => {
        this.submitting.set(false);
        this.pricing.set(null);
        // Patched in place rather than refetching: the row keeps its position, which
        // matters when RH is working down a list.
        this.missions.update(list => list.map(m => (m.id === saved.id ? saved : m)));
      },
      error: err => {
        this.submitting.set(false);
        this.modalError.set(errorMessage(err, this.translate));
      },
    });
  }

  private askDecision(mission: Mission, approve: boolean): void {
    this.modalError.set(null);
    this.deciding.set({ target: 'mission', mission, approve });
  }

  applyDecision(decision: MissionDecision): void {
    const pending = this.deciding();
    if (!pending) return;
    this.submitting.set(true);
    this.modalError.set(null);

    if (pending.target === 'request' && pending.request) {
      const request = pending.request;
      this.svc.resolveChangeRequest(request.id, false, decision.notes).subscribe({
        next: () => {
          this.submitting.set(false);
          this.deciding.set(null);
          this.requests.update(list => list.filter(r => r.id !== request.id));
        },
        error: err => {
          this.submitting.set(false);
          this.modalError.set(errorMessage(err, this.translate));
        },
      });
      return;
    }

    const call = pending.approve
      ? this.svc.hrValidate(pending.mission.id, decision.notes)
      : this.svc.hrReject(pending.mission.id, decision.notes ?? '');
    call.subscribe({
      next: () => {
        this.submitting.set(false);
        this.deciding.set(null);
        // Off the queue either way — validated goes to finance, rejected is terminal.
        this.missions.update(list => list.filter(m => m.id !== pending.mission.id));
      },
      error: err => {
        this.submitting.set(false);
        this.modalError.set(errorMessage(err, this.translate));
      },
    });
  }

  /** Accepting needs no words: the employee already said why, and RH is agreeing to it. */
  private resolveRequest(request: MissionChangeRequest): void {
    this.svc.resolveChangeRequest(request.id, true, null).subscribe({
      next: () => this.requests.update(list => list.filter(r => r.id !== request.id)),
      error: err => this.error.set(errorMessage(err, this.translate)),
    });
  }

  /**
   * Refusing does need words — the backend requires them — so it goes through the same
   * decision modal, with the mission the ask belongs to for context. The mission is
   * fetched: the pricing queue only holds PENDING_HR rows, and an ask always concerns a
   * later one.
   */
  private askRequestRefusal(request: MissionChangeRequest): void {
    this.svc.get(request.missionId)
      .pipe(catchError(() => of(null)))
      .subscribe(mission => {
        if (!mission) {
          this.error.set(this.translate.instant('MISSIONS.COMMON.ERROR'));
          return;
        }
        this.modalError.set(null);
        this.deciding.set({ target: 'request', mission, approve: false, request });
      });
  }
}
