import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, map, of } from 'rxjs';
import {
  ButtonComponent,
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

import { UserStore } from '../../core/user.store';
import { OffboardingService } from './offboarding.service';
import {
  DEPARTURE_REASONS, DepartureReason, OFFBOARDING_STATUSES, OffboardingStatus,
  OffboardingWorkflowInstance,
} from './models/offboarding.model';
import { StageCode, boardStageOf, isActive, isOverdue } from './offboarding-display';
import { StartOffboardingModalComponent } from './start-offboarding-modal.component';
import { OffboardingCardsSectionComponent } from './sections/offboarding-cards-section.component';
import { OffboardingTableSectionComponent } from './sections/offboarding-table-section.component';
import { OffboardingBoardSectionComponent } from './sections/offboarding-board-section.component';
import {
  OFFBOARDING_KANBAN_COLUMN_DEFS, OffboardingKanbanColumn, byLastWorkingDayAsc,
} from './offboarding-kanban.model';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * `kanban` is the default, matching the recruitment board: its columns are the seven
 * stages, so the board is the view that shows which department each file is waiting on.
 */
type ViewMode = 'kanban' | 'list';

/**
 * /rh/offboarding — canonical page shape (UI-PLAYBOOK §1): `daf-page` +
 * `daf-page-header` + the KPI row + `daf-search-toolbar` + one section per view +
 * `daf-pagination`.
 *
 * Was `/rh/lifecycle` (`LifecycleDashboardComponent`). The module, the route, the
 * nav entry, the files and the `OFFBOARDING.*` i18n block were all renamed: every
 * endpoint it calls is already `/api/hr/offboarding`, and "lifecycle" collided with
 * the *employee* lifecycle (contract status) on `/rh/profiles/:id`, which is a
 * different thing and keeps its name.
 *
 * The endpoint returns the whole list in one call, so search, the status filter and
 * paging are all client-side projections of `items`.
 */
@Component({
  selector: 'rh-offboarding-list',
  standalone: true,
  imports: [
    ButtonComponent,
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    StartOffboardingModalComponent,
    OffboardingCardsSectionComponent,
    OffboardingTableSectionComponent,
    OffboardingBoardSectionComponent,
    TranslatePipe,
  ],
  templateUrl: './offboarding-list.component.html',
})
export class OffboardingListComponent implements OnInit {
  private svc       = inject(OffboardingService);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private userStore = inject(UserStore);

  /**
   * `RH_MANAGE_OFFBOARDING` — the permission `OffboardingController` actually
   * enforces. This used to read `RH_MANAGE_LIFECYCLE`, so a user could see the
   * "Démarrer" button and then get a 403 from every call behind it.
   */
  readonly canManage = computed(() => this.userStore.hasPermission('RH_MANAGE_OFFBOARDING'));

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly items = signal<OffboardingWorkflowInstance[]>([]);
  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad = signal(true);
  /** Every reload after that — skeletons inside the affected section only. */
  readonly loading = signal(false);

  readonly showModal = signal(false);

  // ── View state ─────────────────────────────────────────────────────────────
  readonly viewMode     = signal<ViewMode>('kanban');
  readonly search       = signal('');
  readonly statusFilter = signal('');
  readonly currentPage  = signal(0);
  readonly pageSize     = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // ── Departure-reason scope (the sidebar's sub-entries) ─────────────────────
  /**
   * `type/:reason` → the reason CODE, or null on the unscoped `/rh/offboarding`.
   *
   * Read as a signal off `paramMap` rather than from `snapshot`: Angular reuses this
   * component instance when moving between two sibling `type/:reason` URLs, so a
   * snapshot read would keep showing the first reason opened.
   *
   * An unknown code resolves to null — a hand-typed URL then shows the full list
   * rather than an empty page that looks like "no departures of this kind".
   */
  private readonly routeReason = toSignal(
    this.route.paramMap.pipe(
      map(p => {
        const code = p.get('reason');
        return code && (DEPARTURE_REASONS as readonly string[]).includes(code)
          ? (code as DepartureReason)
          : null;
      }),
    ),
    { initialValue: null },
  );

  /**
   * The population this page is about: every file when unscoped, one reason otherwise.
   * Search, the status filter, the KPIs, the board and paging are all projections of
   * THIS, not of `items` — otherwise a category page would show "12 actifs" over a
   * board holding three cards.
   */
  readonly scopedItems = computed(() => {
    const reason = this.routeReason();
    return reason ? this.items().filter(w => w.departureReason === reason) : this.items();
  });

  /**
   * Switching category while deep in the pager would land on a page that does not exist
   * in the new, smaller population. Same shape as `holidays-admin` / `role-list`.
   */
  private resetPageOnReasonChange = effect(() => {
    this.routeReason();
    this.currentPage.set(0);
  });

  readonly filteredItems = computed(() => {
    this.translate.currentLang();
    const term   = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.scopedItems().filter(w => {
      const reason = this.translate.instant('OFFBOARDING.REASON.' + w.departureReason).toLowerCase();
      const matchesTerm = !term
        || (w.employeeFullName ?? '').toLowerCase().includes(term)
        || (w.handoverManagerName ?? '').toLowerCase().includes(term)
        || reason.includes(term);
      return matchesTerm && (!status || w.status === status);
    });
  });

  readonly totalElements = computed(() => this.filteredItems().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  // ── Kanban board ───────────────────────────────────────────────────────────
  /** Per-column sort direction, keyed by column key. Toggled from the column header. */
  private readonly columnSort = signal<Record<string, 'asc' | 'desc'>>({});

  /**
   * Board columns built from the FULL filtered list, not `pagedItems` — a board that only
   * held one page would silently hide files and misreport its column counts. Paging stays
   * bound to the grid/table views.
   *
   * Grouped by stage, resolved once per file through `boardStageOf` and bucketed, rather
   * than re-scanning the list per column: `stageProgressOf` runs the whole stage resolver
   * over every task of the file, so a filter-per-column would run it 7×.
   */
  readonly boardColumns = computed<OffboardingKanbanColumn[]>(() => {
    this.translate.currentLang();
    const sort = this.columnSort();

    // Seeded with every column so an empty stage still renders its column, and the
    // tuple is annotated: a bare `[def.key, []]` infers an array, not a Map entry.
    const buckets = new Map<StageCode, OffboardingWorkflowInstance[]>(
      OFFBOARDING_KANBAN_COLUMN_DEFS.map(
        def => [def.key, []] as [StageCode, OffboardingWorkflowInstance[]],
      ),
    );
    for (const wf of this.filteredItems()) {
      buckets.get(boardStageOf(wf))?.push(wf);
    }

    return OFFBOARDING_KANBAN_COLUMN_DEFS.map(def => {
      const dir = sort[def.key] ?? 'asc';
      return {
        key: def.key,
        label: this.translate.instant(def.labelKey),
        icon: def.icon,
        accent: def.accent,
        badgeBg: def.badgeBg,
        sortDir: dir,
        items: (buckets.get(def.key) ?? [])
          .sort((a, b) => dir === 'asc' ? byLastWorkingDayAsc(a, b) : byLastWorkingDayAsc(b, a)),
      };
    });
  });

  toggleColumnSort(key: string): void {
    this.columnSort.update(s => ({ ...s, [key]: (s[key] ?? 'asc') === 'asc' ? 'desc' : 'asc' }));
  }

  /** The table and the cards share one empty message, and it knows about the filter. */
  readonly emptyMessage = computed(() => {
    this.translate.currentLang();
    if (this.statusFilter() || this.search()) {
      return this.translate.instant('OFFBOARDING.LIST.EMPTY_FILTERED');
    }
    // A category page with nothing in it is not the same as an empty module.
    return this.translate.instant(
      this.routeReason() ? 'OFFBOARDING.LIST.EMPTY_REASON' : 'OFFBOARDING.LIST.EMPTY',
    );
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  /** Translated label of the scoped reason, e.g. "Démission". */
  private readonly reasonLabel = computed(() => {
    this.translate.currentLang();
    const reason = this.routeReason();
    return reason ? this.translate.instant('OFFBOARDING.REASON.' + reason) : '';
  });

  readonly pageTitle = computed(() => {
    this.translate.currentLang();
    return this.routeReason()
      ? this.translate.instant('OFFBOARDING.LIST.TITLE_REASON', { reason: this.reasonLabel() })
      : this.translate.instant('OFFBOARDING.LIST.TITLE');
  });

  readonly pageSubtitle = computed(() => {
    this.translate.currentLang();
    return this.routeReason()
      ? this.translate.instant('OFFBOARDING.LIST.SUBTITLE_REASON', { reason: this.reasonLabel() })
      : this.translate.instant('OFFBOARDING.LIST.SUBTITLE');
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  // Off `scopedItems`, so on a category page the tiles count that category. They stay
  // blind to the search box and the status filter — a KPI row that moved with the
  // filters could never be read as "the state of this population".
  readonly stats = computed(() => {
    const all = this.scopedItems();
    const active = all.filter(isActive);
    return {
      active:    active.length,
      blocked:   active.filter(w => w.status === 'BLOCKED').length,
      slaBreach: active.filter(w => w.slaBreachFlag).length,
      validated: all.filter(w => w.status === 'VALIDATED').length,
    };
  });

  readonly activeDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const overdue = this.scopedItems().filter(w => isActive(w) && isOverdue(w)).length;
    return overdue === 0
      ? { value: this.translate.instant('OFFBOARDING.LIST.DELTA_ON_TRACK'), direction: 'up' }
      : { value: this.translate.instant('OFFBOARDING.LIST.DELTA_OVERDUE_TASKS', { count: overdue }), direction: 'down' };
  });

  readonly blockedDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const blocked = this.stats().blocked;
    if (blocked === 0) return null;
    return {
      value: this.translate.instant('OFFBOARDING.LIST.DELTA_BLOCKING', { count: blocked }),
      direction: 'down',
    };
  });

  readonly slaDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const breach = this.stats().slaBreach;
    if (breach === 0) return null;
    return {
      value: this.translate.instant('OFFBOARDING.LIST.DELTA_SLA', { count: breach }),
      direction: 'down',
    };
  });

  readonly validatedDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const total = this.scopedItems().length;
    if (total === 0) return null;
    const pct = Math.round((this.stats().validated / total) * 100);
    return {
      value: this.translate.instant('OFFBOARDING.LIST.DELTA_VALIDATED', { pct }),
      direction: pct >= 50 ? 'up' : 'neutral',
    };
  });

  // ── Toolbar ────────────────────────────────────────────────────────────────
  /** The status dropdown belongs *inside* the filter panel, not loose above the table. */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    return [{
      name: 'status',
      label: this.translate.instant('OFFBOARDING.LIST.COL_STATUS'),
      type: 'select',
      placeholder: this.translate.instant('OFFBOARDING.LIST.ALL_STATUSES'),
      options: OFFBOARDING_STATUSES.map((code: OffboardingStatus) => ({
        value: code,
        label: this.translate.instant('OFFBOARDING.STATUS.' + code),
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
      title:        t('OFFBOARDING.LIST.FILTERS.TITLE'),
      applyLabel:   t('OFFBOARDING.LIST.FILTERS.APPLY'),
      cancelLabel:  t('OFFBOARDING.LIST.FILTERS.CANCEL'),
      resetLabel:   t('OFFBOARDING.LIST.FILTERS.RESET'),
      triggerLabel: t('OFFBOARDING.LIST.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: { status: this.statusFilter() ? [this.statusFilter()] : [] },
    };
  });

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'kanban', icon: 'view_kanban', tooltip: this.translate.instant('OFFBOARDING.LIST.VIEW_KANBAN') },
      { id: 'list', icon: 'view_list', tooltip: this.translate.instant('OFFBOARDING.LIST.VIEW_LIST') },
    ];
  });

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.svc.listOffboarding().pipe(catchError(() => of([]))).subscribe(list => {
      this.items.set(list);
      this.loading.set(false);
      this.firstLoad.set(false);
    });
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  onSearch(value: string): void {
    if (value === this.search()) return; // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
  }

  applyFilters(result: FilterResult): void {
    this.statusFilter.set(typeof result['status'] === 'string' ? result['status'] : '');
    this.currentPage.set(0);
  }

  setView(mode: string): void {
    this.viewMode.set(mode as ViewMode);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** `pageSizeChange` fires alone — the page decides to go back to page 0 (§7). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
  }

  onCreated(id: number): void {
    this.showModal.set(false);
    this.open(id);
  }

  /**
   * Absolute, not `relativeTo: this.route`.
   *
   * This page is mounted on two routes. Relative navigation resolved to
   * `/rh/offboarding/42` from the list but to `/rh/offboarding/type/RESIGNATION/42`
   * from a departure-type page — which matches nothing, so `{ path: '**' }` in
   * app.routes bounced the user to `accueil` instead of opening the file.
   */
  open(id: number): void {
    this.router.navigate(['/rh/offboarding', id]);
  }
}
