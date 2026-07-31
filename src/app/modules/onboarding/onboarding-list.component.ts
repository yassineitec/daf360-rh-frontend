import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
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

import { OnboardingService } from './onboarding.service';
import { CandidateOnboardingStatus, OnboardingKpiStats, OnboardingListItem } from './onboarding.model';
import { OnboardingCardsSectionComponent } from './sections/onboarding-cards-section.component';
import { OnboardingTableSectionComponent } from './sections/onboarding-table-section.component';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** The two statuses a file can carry while it waits for onboarding. */
const STATUS_CODES: CandidateOnboardingStatus[] = ['EMAIL_RECEIVED', 'HR_IN_PROGRESS'];

type ViewMode = 'grid' | 'list';

/**
 * /rh/onboarding — canonical page shape (UI-PLAYBOOK §1): `daf-page` +
 * `daf-page-header` + the KPI row + `daf-search-toolbar` + one section per view +
 * `daf-pagination`.
 *
 * The endpoint returns the whole pending list in one call, so search, the status
 * filter and paging are all client-side projections of `items`.
 *
 * All view state lives here and both sections are stateless input/output shells,
 * which is what makes flipping between cards and list lossless.
 */
@Component({
  selector: 'app-onboarding-list',
  standalone: true,
  imports: [
    MetricCardComponent,
    PageComponent,
    PageHeaderComponent,
    PaginationComponent,
    SearchToolbarComponent,
    OnboardingCardsSectionComponent,
    OnboardingTableSectionComponent,
    TranslatePipe,
  ],
  templateUrl: './onboarding-list.component.html',
})
export class OnboardingListComponent implements OnInit {
  private service   = inject(OnboardingService);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private translate = inject(TranslateService);

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly items    = signal<OnboardingListItem[]>([]);
  readonly kpiStats = signal<OnboardingKpiStats | null>(null);
  /** Whole-page skeleton — first load only (UI-PLAYBOOK §5). */
  readonly firstLoad = signal(true);
  /** Every refresh after that — skeletons inside the affected section only. */
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  // ── View state ─────────────────────────────────────────────────────────────
  readonly viewMode     = signal<ViewMode>('grid');
  readonly search       = signal('');
  readonly statusFilter = signal('');
  readonly currentPage  = signal(0);
  readonly pageSize     = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly filteredItems = computed(() => {
    const term   = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.items().filter(r => {
      const matchesTerm = !term
        || r.candidateFullName.toLowerCase().includes(term)
        || (r.ms365Email ?? '').toLowerCase().includes(term)
        || (r.appliedPosition ?? '').toLowerCase().includes(term);
      return matchesTerm && (!status || r.candidateStatus === status);
    });
  });

  readonly totalElements = computed(() => this.filteredItems().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  /** `pendingCount` comes from the stats endpoint; the list length is the fallback. */
  readonly kpiPending = computed(() => this.kpiStats()?.pendingCount ?? this.items().length);

  readonly kpiAvgTime = computed(() => {
    this.translate.currentLang();
    const minutes = this.kpiStats()?.avgCreationMinutes;
    return minutes == null ? '—' : `${minutes} ${this.translate.instant('ONBOARDING.LIST.MIN_UNIT')}`;
  });

  /** Deltas are translated — they used to be hardcoded English on a French page. */
  readonly pendingDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const stats = this.kpiStats();
    if (!stats) return null;
    const incomplete = stats.incompleteProfiles ?? 0;
    return incomplete === 0
      ? { value: this.translate.instant('ONBOARDING.LIST.DELTA_ALL_ON_TRACK'), direction: 'up' }
      : { value: this.translate.instant('ONBOARDING.LIST.DELTA_INCOMPLETE_ATTENTION', { count: incomplete }), direction: 'down' };
  });

  readonly createdTodayDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const stats = this.kpiStats();
    if (!stats) return null;
    const created = stats.profilesCreatedToday ?? 0;
    return created > 0
      ? { value: this.translate.instant('ONBOARDING.LIST.DELTA_CREATED_TODAY'), direction: 'up' }
      : { value: this.translate.instant('ONBOARDING.LIST.DELTA_NONE_CREATED'),  direction: 'neutral' };
  });

  readonly incompleteDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const incomplete = this.kpiStats()?.incompleteProfiles ?? 0;
    if (incomplete === 0) return null;
    return {
      value: this.translate.instant('ONBOARDING.LIST.DELTA_AWAITING', { count: incomplete }),
      direction: 'down',
    };
  });

  readonly avgTimeDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const minutes = this.kpiStats()?.avgCreationMinutes;
    if (minutes == null) return null;
    if (minutes < 30) return { value: this.translate.instant('ONBOARDING.LIST.DELTA_PACE_FAST'),   direction: 'up'      };
    if (minutes < 60) return { value: this.translate.instant('ONBOARDING.LIST.DELTA_PACE_NORMAL'), direction: 'neutral' };
    return { value: this.translate.instant('ONBOARDING.LIST.DELTA_PACE_SLOW'), direction: 'down' };
  });

  // ── Toolbar ────────────────────────────────────────────────────────────────
  /** The status dropdown belongs *inside* the filter panel, not loose beside the search. */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    return [{
      name: 'status',
      label: this.translate.instant('ONBOARDING.LIST.COL_STATUS'),
      type: 'select',
      placeholder: this.translate.instant('ONBOARDING.LIST.FILTER_ALL'),
      options: STATUS_CODES.map(code => ({
        value: code,
        label: this.translate.instant('CANDIDATES.STATUS.' + code),
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
      title:        t('ONBOARDING.LIST.FILTERS.TITLE'),
      applyLabel:   t('ONBOARDING.LIST.FILTERS.APPLY'),
      cancelLabel:  t('ONBOARDING.LIST.FILTERS.CANCEL'),
      resetLabel:   t('ONBOARDING.LIST.FILTERS.RESET'),
      triggerLabel: t('ONBOARDING.LIST.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: { status: this.statusFilter() ? [this.statusFilter()] : [] },
    };
  });

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'grid', icon: 'grid_view', tooltip: this.translate.instant('ONBOARDING.LIST.VIEW_GRID') },
      { id: 'list', icon: 'view_list', tooltip: this.translate.instant('ONBOARDING.LIST.VIEW_LIST') },
    ];
  });

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.error.set(null);

    // The KPI feed is independent — it must never hold up the list.
    this.service.getKpiStats().pipe(catchError(() => of(null))).subscribe(stats => this.kpiStats.set(stats));

    this.service.getPendingList().subscribe({
      next: data => {
        this.items.set(data);
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('ONBOARDING.LIST.ERROR_LOAD'));
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

  /** The wizard lives at `/rh/onboarding/:candidateId`, keyed by candidate. */
  open(candidateId: number): void {
    this.router.navigate([candidateId], { relativeTo: this.route });
  }
}
