import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
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

import { ItProvisioningService } from './it-provisioning.service';
import { ItProvisioningStatus, ProvisioningListItem } from './it-provisioning.model';
import { hardwareComplete, isOverdue, licCount, licencesComplete } from './it-provisioning-display';
import { ItProvisioningCardsSectionComponent } from './sections/it-provisioning-cards-section.component';
import {
  ItProvisioningTableSectionComponent, ProvisioningSort,
} from './sections/it-provisioning-table-section.component';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Provisioning statuses in workflow order, for the status filter. */
const STATUS_CODES: ItProvisioningStatus[] = ['PENDING', 'IN_PROGRESS', 'EMAIL_CREATED', 'COMPLETED'];

type ViewMode = 'grid' | 'list';

/** What a file can still be missing — the "Éléments manquants" multiselect. */
type MissingItem = 'HARDWARE' | 'LICENCES' | 'EMAIL';
const MISSING_ITEMS: MissingItem[] = ['HARDWARE', 'LICENCES', 'EMAIL'];

function isMissing(item: ProvisioningListItem, what: MissingItem): boolean {
  switch (what) {
    case 'HARDWARE': return !hardwareComplete(item);
    case 'LICENCES': return !licencesComplete(item);
    case 'EMAIL':    return !item.ms365Email;
  }
}

/** What each table column sorts on — keyed by the table's column keys. */
const SORT_VALUE: Record<string, (r: ProvisioningListItem) => string | number | null> = {
  candidat:          r => r.candidateFullName,
  ms365Email:        r => r.ms365Email || null,
  status:            r => STATUS_CODES.indexOf(r.status), // workflow order, not the label
  expectedStartDate: r => r.expectedStartDate?.slice(0, 10) || null, // ISO: string order = date order
  hwLabel:           r => r.assetsProvided ?? 0,
  licLabel:          r => licCount(r),
};

/**
 * Sorts the whole filtered list (the table is `manualSort`, see its section).
 * Missing values sort last in both directions, like the library's own comparator.
 */
function sortProvisioning(items: ProvisioningListItem[], sort: ProvisioningSort | null): ProvisioningListItem[] {
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

/**
 * /rh/it-provisioning — canonical page shape (UI-PLAYBOOK §1): `daf-page` +
 * `daf-page-header` + the KPI row + `daf-search-toolbar` + one section per view +
 * `daf-pagination`.
 *
 * The endpoint returns the whole list in one call, so search, the status filter
 * and paging are all client-side projections of `items`.
 *
 * All view state lives here and the two sections are stateless input/output
 * shells, which is what makes flipping between cards and list lossless.
 */
@Component({
  standalone: true,
  imports: [
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    ItProvisioningCardsSectionComponent,
    ItProvisioningTableSectionComponent,
    TranslatePipe,
  ],
  templateUrl: './it-provisioning-list.component.html',
})
export class ItProvisioningListComponent implements OnInit {
  private service   = inject(ItProvisioningService);
  private router    = inject(Router);
  private translate = inject(TranslateService);

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly items = signal<ProvisioningListItem[]>([]);
  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad = signal(true);
  /** Every refresh after that — skeletons inside the affected section only. */
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  // ── View state ─────────────────────────────────────────────────────────────
  readonly viewMode     = signal<ViewMode>('grid');
  readonly search       = signal('');
  readonly statusFilter = signal('');
  /** Only files past their expected start date and not completed (`isOverdue`). */
  readonly overdueOnly  = signal(false);
  /** Files missing ANY of these (empty = no constraint). */
  readonly missingFilter = signal<MissingItem[]>([]);
  /** Expected-start-date range from the panel: one day or [from, to]; null = no bound. */
  readonly startRange   = signal<Date[] | null>(null);
  readonly currentPage  = signal(0);
  readonly pageSize     = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly filteredItems = computed(() => {
    const term   = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const overdueOnly = this.overdueOnly();
    const missing = this.missingFilter();
    const range = this.startRange();
    const from = range?.[0] ? toIsoDay(range[0]) : null;
    const to   = range?.[0] ? toIsoDay(range[1] ?? range[0]) : null; // one day = one-day range
    return this.items().filter(r => {
      const matchesTerm = !term
        || r.candidateFullName.toLowerCase().includes(term)
        || (r.ms365Email ?? '').toLowerCase().includes(term)
        || (r.appliedPosition ?? '').toLowerCase().includes(term);
      // `expectedStartDate` is an ISO date, so string comparison is date order.
      const start = r.expectedStartDate?.slice(0, 10) ?? null;
      return matchesTerm
        && (!status || r.status === status)
        && (!overdueOnly || isOverdue(r))
        && (!missing.length || missing.some(m => isMissing(r, m)))
        && (!from || (!!start && start >= from && start <= to!));
    });
  });

  /** Table header sort — applied to the whole filtered set, before paging. Kept across views. */
  readonly sort = signal<ProvisioningSort | null>(null);
  readonly sortedItems = computed(() => sortProvisioning(this.filteredItems(), this.sort()));

  readonly totalElements = computed(() => this.filteredItems().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.sortedItems().slice(start, start + this.pageSize());
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  readonly stats = computed(() => {
    const open = this.items().filter(r => r.status !== 'COMPLETED');
    return {
      pending:       open.length,
      overdue:       open.filter(r => isOverdue(r)).length,
      hwIncomplete:  open.filter(r => !hardwareComplete(r)).length,
      licIncomplete: open.filter(r => !licencesComplete(r)).length,
    };
  });

  /** Share of all files that are done — the same rate every tile's delta reads. */
  private completionRate(incomplete: number): number {
    const total = this.items().length;
    return total > 0 ? Math.round(((total - incomplete) / total) * 100) : 0;
  }

  /** Deltas are translated — they used to be hardcoded English on a French page. */
  readonly pendingDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const rate = this.completionRate(this.stats().pending);
    return {
      value: this.translate.instant('IT_PROVISIONING.LIST.DELTA_COMPLETE', { pct: rate }),
      direction: rate >= 70 ? 'up' : rate >= 40 ? 'neutral' : 'down',
    };
  });

  readonly overdueDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const overdue = this.stats().overdue;
    if (overdue === 0) return null;
    return {
      value: this.translate.instant('IT_PROVISIONING.LIST.DELTA_OVERDUE', { count: overdue }),
      direction: 'down',
    };
  });

  readonly hwDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const rate = this.completionRate(this.stats().hwIncomplete);
    return {
      value: this.translate.instant('IT_PROVISIONING.LIST.DELTA_HW_READY', { pct: rate }),
      direction: rate >= 70 ? 'up' : 'neutral',
    };
  });

  readonly licDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const rate = this.completionRate(this.stats().licIncomplete);
    return {
      value: this.translate.instant('IT_PROVISIONING.LIST.DELTA_LIC_READY', { pct: rate }),
      direction: rate >= 70 ? 'up' : 'neutral',
    };
  });

  // ── Toolbar ────────────────────────────────────────────────────────────────
  /** The status dropdown belongs *inside* the filter panel, not loose beside the search. */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      {
        name: 'status',
        label: t('IT_PROVISIONING.LIST.COL_STATUS'),
        type: 'select',
        placeholder: t('IT_PROVISIONING.LIST.FILTER_ALL'),
        options: STATUS_CODES.map(code => ({
          value: code,
          label: t('IT_PROVISIONING.STATUS.' + code),
        })),
      },
      {
        name: 'missing',
        label: t('IT_PROVISIONING.LIST.FILTERS.MISSING'),
        type: 'multiselect',
        placeholder: t('IT_PROVISIONING.LIST.FILTERS.MISSING_ANY'),
        hint: t('IT_PROVISIONING.LIST.FILTERS.MISSING_HINT'),
        options: MISSING_ITEMS.map(code => ({
          value: code,
          label: t('IT_PROVISIONING.LIST.FILTERS.MISSING_' + code),
        })),
      },
      {
        name: 'startDate',
        label: t('IT_PROVISIONING.LIST.FILTERS.START_DATE'),
        type: 'daterange',
      },
      {
        name: 'overdue',
        label: t('IT_PROVISIONING.LIST.FILTERS.OVERDUE_ONLY'),
        type: 'checkbox',
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
      title:        t('IT_PROVISIONING.LIST.FILTERS.TITLE'),
      applyLabel:   t('IT_PROVISIONING.LIST.FILTERS.APPLY'),
      cancelLabel:  t('IT_PROVISIONING.LIST.FILTERS.CANCEL'),
      resetLabel:   t('IT_PROVISIONING.LIST.FILTERS.RESET'),
      triggerLabel: t('IT_PROVISIONING.LIST.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: {
        status:    this.statusFilter() ? [this.statusFilter()] : [],
        missing:   this.missingFilter(),
        startDate: this.startRange(),
        overdue:   this.overdueOnly(),
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

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.error.set(null);
    this.service.getAllList().subscribe({
      next: data => {
        this.items.set(data);
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

  // ── Handlers ───────────────────────────────────────────────────────────────
  onSearch(value: string): void {
    if (value === this.search()) return; // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
  }

  applyFilters(result: FilterResult): void {
    const missing = result['missing'];
    const range = result['startDate'];
    this.statusFilter.set(typeof result['status'] === 'string' ? result['status'] : '');
    this.overdueOnly.set(result['overdue'] === true);
    this.missingFilter.set(Array.isArray(missing) ? missing as MissingItem[] : []);
    this.startRange.set(Array.isArray(range) && range.length ? range as Date[] : null);
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

  /** `pageSizeChange` fires alone — the page decides to go back to page 0 (§7). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
  }

  open(id: number): void {
    this.router.navigate(['/rh/it-provisioning', id]);
  }
}
