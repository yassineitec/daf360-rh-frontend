import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  FilterField,
  FilterResult,
  MetricCardComponent,
  PageComponent,
  PageHeaderComponent,
  PaginationComponent,
  SearchToolbarComponent,
  SearchToolbarFilterConfig,
  ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';

import { MissionService } from './mission.service';
import { Mission, MissionScope, MissionStatus } from './mission.model';
import { MissionDetailDrawerComponent } from './mission-detail-drawer.component';
import { countryOptions, employeeOptions, errorMessage, matchesPeriod } from './mission-display';
import { MissionsCardsSectionComponent } from './sections/missions-cards-section.component';
import {
  MissionSort, MissionsTableSectionComponent, sortMissions,
} from './sections/missions-table-section.component';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** No longer awaiting a decision — what "history" means on this page. */
const CLOSED_STATUS_CODES: MissionStatus[] = [
  'APPROVED', 'REJECTED_HR', 'REJECTED_FINANCE', 'CANCELLED',
];

type ViewMode = 'grid' | 'list';

const SCOPES: MissionScope[] = ['NATIONAL', 'INTERNATIONAL'];

/**
 * `/rh/missions/historique` — read-only record of the manager's own missions that are no
 * longer pending a decision. Same list shape as `/rh/missions` minus what only applies to
 * an open mission: no KPI row, no "new mission" button, no cancel action.
 *
 * Pulls from the same `listMine()` call and filters client-side to `CLOSED_STATUS_CODES` —
 * the endpoint has never distinguished open from closed, only the two screens' default
 * views do.
 */
@Component({
  selector: 'rh-missions-history',
  standalone: true,
  imports: [
    MetricCardComponent, PageComponent, PageHeaderComponent, PaginationComponent,
    SearchToolbarComponent, MissionsCardsSectionComponent, MissionsTableSectionComponent,
    MissionDetailDrawerComponent, TranslatePipe,
  ],
  templateUrl: './missions-history.component.html',
})
export class MissionsHistoryComponent implements OnInit {
  private svc = inject(MissionService);
  private translate = inject(TranslateService);

  // ── Data ─────────────────────────────────────────────────────────────────
  readonly missions = signal<Mission[]>([]);
  readonly firstLoad = signal(true);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ── View state ───────────────────────────────────────────────────────────
  readonly viewMode = signal<ViewMode>('grid');
  readonly search = signal('');
  readonly statusFilter = signal('');
  /** Picked period (one day or [from, to]) — keeps missions overlapping it. */
  readonly periodFilter = signal<Date[] | null>(null);
  /** Employee user id as a string ('' = everyone) — the panel's select value. */
  readonly employeeFilter = signal('');
  /** `NATIONAL` / `INTERNATIONAL`, or '' = both. */
  readonly scopeFilter = signal('');
  /** Destination country label, or '' = any. */
  readonly countryFilter = signal('');
  readonly currentPage = signal(0);
  readonly pageSize = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly selected = signal<Mission | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.error.set(null);
    this.svc.listMine().subscribe({
      next: list => {
        this.missions.set(list.filter(m => CLOSED_STATUS_CODES.includes(m.status)));
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      error: err => {
        this.error.set(errorMessage(err, this.translate));
        this.loading.set(false);
        this.firstLoad.set(false);
      },
    });
  }

  // ── Projections ──────────────────────────────────────────────────────────
  readonly filteredItems = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const period = this.periodFilter();
    const employee = this.employeeFilter();
    const scope = this.scopeFilter();
    const country = this.countryFilter();
    return this.missions().filter(m => {
      const matchesTerm = !term
        || (m.employeeName ?? '').toLowerCase().includes(term)
        || m.title.toLowerCase().includes(term)
        || m.city.toLowerCase().includes(term)
        || (m.countryLabel ?? '').toLowerCase().includes(term);
      return matchesTerm
        && (!status || m.status === status)
        && matchesPeriod(m, period)
        && (!employee || String(m.employeeUserId) === employee)
        && (!scope || m.scope === scope)
        && (!country || m.countryLabel === country);
    });
  });

  /** Table header sort — applied to the whole filtered set, before paging. Kept across views. */
  readonly sort = signal<MissionSort | null>(null);
  readonly sortedItems = computed(() => sortMissions(this.filteredItems(), this.sort()));

  readonly totalElements = computed(() => this.filteredItems().length);
  readonly totalPages = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.sortedItems().slice(start, start + this.pageSize());
  });

  readonly emptyMessage = computed(() => {
    this.translate.currentLang();
    const filtered = !!this.search().trim() || !!this.statusFilter() || !!this.periodFilter()
      || !!this.employeeFilter() || !!this.scopeFilter() || !!this.countryFilter();
    return this.translate.instant(filtered
      ? 'MISSIONS.LIST.EMPTY_FILTERED'
      : 'MISSIONS.LIST.EMPTY_CLOSED');
  });

  // ── KPIs ─────────────────────────────────────────────────────────────────
  /** Counted on the whole closed set, never on the current page or search filter. */
  readonly stats = computed(() => {
    const all = this.missions();
    return {
      total:     all.length,
      approved:  all.filter(m => m.status === 'APPROVED').length,
      rejected:  all.filter(m => m.status === 'REJECTED_HR' || m.status === 'REJECTED_FINANCE').length,
      cancelled: all.filter(m => m.status === 'CANCELLED').length,
    };
  });

  // ── Toolbar ──────────────────────────────────────────────────────────────
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    return [
      {
        name: 'status',
        label: this.translate.instant('MISSIONS.LIST.COL_STATUS'),
        type: 'select',
        placeholder: this.translate.instant('MISSIONS.LIST.FILTER_ALL'),
        options: CLOSED_STATUS_CODES.map(code => ({
          value: code,
          label: this.translate.instant('MISSIONS.STATUS.' + code),
        })),
      },
      {
        // Renders as `daf-multi-date-picker` in range mode inside the filter panel —
        // the library's own calendar, not a hand-built one.
        name: 'period',
        label: this.translate.instant('MISSIONS.LIST.COL_PERIOD'),
        type: 'daterange',
      },
      {
        name: 'employee',
        label: this.translate.instant('MISSIONS.LIST.COL_EMPLOYEE'),
        type: 'select',
        searchable: true,
        placeholder: this.translate.instant('MISSIONS.LIST.FILTERS.ALL_EMPLOYEES'),
        options: employeeOptions(this.missions()),
      },
      {
        name: 'scope',
        label: this.translate.instant('MISSIONS.LIST.FILTERS.SCOPE'),
        type: 'select',
        placeholder: this.translate.instant('MISSIONS.LIST.FILTERS.ALL_SCOPES'),
        options: SCOPES.map(s => ({ value: s, label: this.translate.instant('MISSIONS.SCOPE.' + s) })),
      },
      {
        name: 'country',
        label: this.translate.instant('MISSIONS.LIST.FILTERS.COUNTRY'),
        type: 'select',
        searchable: true,
        placeholder: this.translate.instant('MISSIONS.LIST.FILTERS.ALL_COUNTRIES'),
        options: countryOptions(this.missions()),
      },
    ];
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
      initialValues: {
        status: this.statusFilter() ? [this.statusFilter()] : [],
        period: this.periodFilter(),
        employee: this.employeeFilter() ? [this.employeeFilter()] : [],
        scope:    this.scopeFilter()    ? [this.scopeFilter()]    : [],
        country:  this.countryFilter()  ? [this.countryFilter()]  : [],
      },
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
  onSearch(value: string): void {
    if (value === this.search()) return;   // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
  }

  applyFilters(result: FilterResult): void {
    const str = (key: string) => typeof result[key] === 'string' ? result[key] as string : '';
    const period = result['period'];
    this.statusFilter.set(str('status'));
    this.periodFilter.set(Array.isArray(period) && period.length ? period as Date[] : null);
    this.employeeFilter.set(str('employee'));
    this.scopeFilter.set(str('scope'));
    this.countryFilter.set(str('country'));
    this.currentPage.set(0);
  }

  setView(mode: string): void {
    this.viewMode.set(mode as ViewMode);
  }

  /** A new order makes the current page meaningless — back to the first one. */
  onSortChange(sort: MissionSort | null): void {
    this.sort.set(sort);
    this.currentPage.set(0);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
  }

  openDetail(id: number): void {
    const row = this.missions().find(m => m.id === id) ?? null;
    this.svc.get(id)
      .pipe(catchError(() => of(row)))
      .subscribe(full => this.selected.set(full));
  }
}
