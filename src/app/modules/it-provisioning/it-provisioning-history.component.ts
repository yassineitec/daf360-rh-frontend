import { Component, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  FilterField,
  FilterOption,
  FilterResult,
  MetricCardComponent,
  PageComponent,
  PageHeaderComponent,
  PaginationComponent,
  SearchToolbarComponent,
  SearchToolbarFilterConfig,
  ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';

import { ItProvisioningService } from './it-provisioning.service';
import { ProvisioningListItem } from './it-provisioning.model';
import {
  licCount, matchesPosition, matchesProfile, positionOptions, profileOptions,
} from './it-provisioning-display';
import { ItProvisioningHistoryStateService } from './it-provisioning-history-state.service';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue } from '../../core/lists/configurable-list.model';
import { ItProvisioningCardsSectionComponent } from './sections/it-provisioning-cards-section.component';
import {
  ItProvisioningTableSectionComponent, ProvisioningSort,
} from './sections/it-provisioning-table-section.component';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type ViewMode = 'grid' | 'list';

/** What each table column sorts on — keyed by the table's column keys. */
const SORT_VALUE: Record<string, (r: ProvisioningListItem) => string | number | null> = {
  candidat:          r => r.candidateFullName,
  ms365Email:        r => r.ms365Email || null,
  expectedStartDate: r => r.expectedStartDate?.slice(0, 10) || null, // ISO: string order = date order
  hwLabel:           r => r.assetsProvided ?? 0,
  licLabel:          r => licCount(r),
};

/** Whole filtered set, missing values last in both directions — same rule as the list page. */
function sortHistory(items: ProvisioningListItem[], sort: ProvisioningSort | null): ProvisioningListItem[] {
  const value = sort && SORT_VALUE[sort.key];
  if (!sort || !value) return items;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = value(a), vb = value(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
    return cmp * sign;
  });
}

/** Local calendar day as `yyyy-MM-dd` — `toISOString()` would shift it to UTC. */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Predicate for a panel date range on an ISO date/timestamp — null range = always true. */
function inRange(range: Date[] | null): (iso: string | null) => boolean {
  if (!range?.[0]) return () => true;
  const from = toIsoDay(range[0]);
  const to   = toIsoDay(range[1] ?? range[0]); // one day = one-day range
  return iso => {
    const day = iso?.slice(0, 10);
    return !!day && day >= from && day <= to; // ISO: string order = date order
  };
}

/** "Clôturé par" options: whoever completed the loaded files, alphabetical. */
function completedByOptions(items: ProvisioningListItem[]): FilterOption[] {
  const byId = new Map<number, string>();
  for (const r of items) {
    if (r.completedBy != null) byId.set(r.completedBy, r.completedByName || `#${r.completedBy}`);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ value: String(id), label: name }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

/**
 * `/rh/it-provisioning/historique` — read-only record of the completed provisioning files.
 * Same shape as `/rh/missions/historique`: KPI row, toolbar, cards/table, pagination — and
 * the same cards and table as `/rh/it-provisioning`.
 *
 * Pulls from the same `getAllList()` call as `/rh/it-provisioning` and keeps only the
 * `COMPLETED` files client-side — the endpoint has never told open from closed.
 */
@Component({
  selector: 'rh-it-provisioning-history',
  standalone: true,
  imports: [
    MetricCardComponent, PageComponent, PageHeaderComponent, PaginationComponent,
    SearchToolbarComponent, ItProvisioningCardsSectionComponent, ItProvisioningTableSectionComponent,
    TranslatePipe,
  ],
  templateUrl: './it-provisioning-history.component.html',
})
export class ItProvisioningHistoryComponent implements OnInit {
  /** Table view only (undefined in cards view) — its `daf-data-table` goes to the toolbar's `[table]`. */
  readonly tableSection = viewChild(ItProvisioningTableSectionComponent);

  private service   = inject(ItProvisioningService);
  private router    = inject(Router);
  private translate = inject(TranslateService);

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly items     = signal<ProvisioningListItem[]>([]);
  readonly firstLoad = signal(true);
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);

  // ── View state ─────────────────────────────────────────────────────────────
  readonly viewMode       = signal<ViewMode>('grid');
  readonly search         = signal('');
  /** Completion-date range from the panel: one day or [from, to]; null = no bound. */
  readonly completedRange = signal<Date[] | null>(null);
  /** Expected-start-date range: one day or [from, to]; null = no bound. */
  readonly startRange     = signal<Date[] | null>(null);
  /** AD profile codes (`NO_PROFILE` = none picked); empty = no constraint. */
  readonly profileFilter  = signal<string[]>([]);
  /** Applied positions (`NO_POSITION` = none); empty = no constraint. */
  readonly positionFilter = signal<string[]>([]);
  /** `Users.id` of whoever completed the file, as a string ('' = anyone). */
  readonly completedByFilter = signal('');
  readonly currentPage    = signal(0);
  readonly pageSize       = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  /** The configured `AD_PROFILE_TYPE` list — labels for the "Profil AD" filter. */
  private listService = inject(ConfigurableListService);
  readonly adProfiles = signal<ListValue[]>([]);

  // ── Mémoire de l'historique ────────────────────────────────────────────────
  private historyState = inject(ItProvisioningHistoryStateService);

  /**
   * Chaque changement de vue, de recherche, de filtre, de tri ou de page est mémorisé,
   * pour que le retour depuis un dossier retrouve l'historique tel qu'on l'a quitté. Le
   * premier passage a lieu après `ngOnInit`, donc après la restauration.
   */
  private readonly persistState = effect(() => {
    this.historyState.save({
      viewMode:          this.viewMode(),
      search:            this.search(),
      completedRange:    this.completedRange(),
      startRange:        this.startRange(),
      profileFilter:     this.profileFilter(),
      positionFilter:    this.positionFilter(),
      completedByFilter: this.completedByFilter(),
      sort:              this.sort(),
      page:              this.currentPage(),
      pageSize:          this.pageSize(),
    });
  });

  /** Avant le premier rendu : `daf-filter` ne lit `initialValues` qu'une fois. */
  private restoreState(): void {
    const s = this.historyState.restore();
    if (!s) return;
    this.viewMode.set(s.viewMode);
    this.search.set(s.search);
    this.completedRange.set(s.completedRange);
    this.startRange.set(s.startRange);
    this.profileFilter.set(s.profileFilter);
    this.positionFilter.set(s.positionFilter);
    this.completedByFilter.set(s.completedByFilter);
    this.sort.set(s.sort);
    this.currentPage.set(s.page);
    this.pageSize.set(s.pageSize);
  }

  ngOnInit(): void {
    this.restoreState();
    this.load();
    this.listService.getListValues('AD_PROFILE_TYPE').subscribe(v => this.adProfiles.set(v));
  }

  load(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.error.set(null);
    this.service.getAllList().subscribe({
      next: data => {
        // Most recently closed first — the natural order of a history.
        this.items.set(data
          .filter(r => r.status === 'COMPLETED')
          .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')));
        // Page restaurée devenue hors limites : on retombe sur la dernière page qui existe.
        if (this.currentPage() > 0 && this.currentPage() >= this.totalPages()) {
          this.currentPage.set(Math.max(0, this.totalPages() - 1));
        }
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('IT_PROVISIONING.LIST.LOAD_ERROR'));
        this.loading.set(false);
        this.firstLoad.set(false);
      },
    });
  }

  // ── Projections ────────────────────────────────────────────────────────────
  readonly filteredItems = computed(() => {
    const term        = this.search().trim().toLowerCase();
    const closedIn    = inRange(this.completedRange());
    const startIn     = inRange(this.startRange());
    const profiles    = this.profileFilter();
    const positions   = this.positionFilter();
    const completedBy = this.completedByFilter();
    return this.items().filter(r => {
      const matchesTerm = !term
        || r.candidateFullName.toLowerCase().includes(term)
        || (r.ms365Email ?? '').toLowerCase().includes(term)
        || (r.appliedPosition ?? '').toLowerCase().includes(term);
      return matchesTerm
        && closedIn(r.completedAt)
        && startIn(r.expectedStartDate)
        && matchesProfile(r, profiles)
        && matchesPosition(r, positions)
        && (!completedBy || String(r.completedBy) === completedBy);
    });
  });

  /** Table header sort — applied to the whole filtered set, before paging. Kept across views. */
  readonly sort = signal<ProvisioningSort | null>(null);
  readonly sortedItems = computed(() => sortHistory(this.filteredItems(), this.sort()));

  readonly totalElements = computed(() => this.filteredItems().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.sortedItems().slice(start, start + this.pageSize());
  });

  readonly emptyMessage = computed(() => {
    this.translate.currentLang();
    const filtered = !!this.search().trim() || !!this.completedRange() || !!this.startRange()
      || !!this.profileFilter().length || !!this.positionFilter().length || !!this.completedByFilter();
    return this.translate.instant(filtered
      ? 'IT_PROVISIONING.HISTORY.EMPTY_FILTERED'
      : 'IT_PROVISIONING.HISTORY.EMPTY');
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  /** Counted on the whole completed set, never on the search, the date filter or the page. */
  readonly stats = computed(() => {
    const all = this.items();
    const month = toIsoDay(new Date()).slice(0, 7);
    // Days from file creation to completion — files missing either date are left out.
    const durations = all
      .filter(r => r.completedAt && r.createdAt)
      .map(r => (new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) / 86_400_000);
    return {
      total:     all.length,
      thisMonth: all.filter(r => r.completedAt?.slice(0, 7) === month).length,
      avgDays:   durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0,
    };
  });

  // ── Toolbar ────────────────────────────────────────────────────────────────
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      {
        name: 'profile',
        label: t('IT_PROVISIONING.LIST.FILTERS.PROFILE'),
        type: 'multiselect',
        searchable: true,
        placeholder: t('IT_PROVISIONING.LIST.FILTERS.PROFILE_ANY'),
        options: profileOptions(this.adProfiles(), this.items(), this.translate),
      },
      {
        name: 'position',
        label: t('IT_PROVISIONING.LIST.FILTERS.POSITION'),
        type: 'multiselect',
        searchable: true,
        placeholder: t('IT_PROVISIONING.LIST.FILTERS.POSITION_ANY'),
        options: positionOptions(this.items(), this.translate),
      },
      {
        name: 'completedBy',
        label: t('IT_PROVISIONING.HISTORY.FILTER_COMPLETED_BY'),
        type: 'select',
        searchable: true,
        placeholder: t('IT_PROVISIONING.HISTORY.FILTER_COMPLETED_BY_ANY'),
        options: completedByOptions(this.items()),
      },
      {
        name: 'completed',
        label: t('IT_PROVISIONING.HISTORY.FILTER_COMPLETED'),
        type: 'daterange',
      },
      {
        name: 'startDate',
        label: t('IT_PROVISIONING.LIST.FILTERS.START_DATE'),
        type: 'daterange',
      },
    ];
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      title:        t('IT_PROVISIONING.LIST.FILTERS.TITLE'),
      applyLabel:   t('IT_PROVISIONING.LIST.FILTERS.APPLY'),
      cancelLabel:  t('IT_PROVISIONING.LIST.FILTERS.CANCEL'),
      resetLabel:   t('IT_PROVISIONING.LIST.FILTERS.RESET'),
      triggerLabel: t('IT_PROVISIONING.LIST.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: {
        profile:     this.profileFilter(),
        position:    this.positionFilter(),
        completedBy: this.completedByFilter() ? [this.completedByFilter()] : [],
        completed:   this.completedRange(),
        startDate:   this.startRange(),
      },
    };
  });

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'grid', icon: 'grid_view', tooltip: this.translate.instant('IT_PROVISIONING.LIST.VIEW_GRID') },
      { id: 'list', icon: 'view_list', tooltip: this.translate.instant('IT_PROVISIONING.LIST.VIEW_LIST') },
    ];
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  onSearch(value: string): void {
    if (value === this.search()) return; // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
  }

  applyFilters(result: FilterResult): void {
    const dates = (key: string) => {
      const v = result[key];
      return Array.isArray(v) && v.length ? v as Date[] : null;
    };
    const list = (key: string) => Array.isArray(result[key]) ? result[key] as string[] : [];
    this.profileFilter.set(list('profile'));
    this.positionFilter.set(list('position'));
    this.completedByFilter.set(typeof result['completedBy'] === 'string' ? result['completedBy'] : '');
    this.completedRange.set(dates('completed'));
    this.startRange.set(dates('startDate'));
    this.currentPage.set(0);
  }

  /** A new order makes the current page meaningless — back to the first one. */
  onSortChange(sort: ProvisioningSort | null): void {
    this.sort.set(sort);
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

  /** `from=historique` sends the file's back button and breadcrumb here, not to the open list. */
  open(id: number): void {
    this.router.navigate(['/rh/it-provisioning', id], { queryParams: { from: 'historique' } });
  }
}
