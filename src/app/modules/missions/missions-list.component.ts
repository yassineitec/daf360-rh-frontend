import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent,
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
  ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';

import { MissionService } from './mission.service';
import {
  Mission, MissionEligibleEmployee, MissionPayload, MissionStatus,
} from './mission.model';
import { MissionFormModalComponent } from './mission-form-modal.component';
import { MissionDetailDrawerComponent } from './mission-detail-drawer.component';
import {
  errorMessage, isActive, isLate, isUpcoming,
} from './mission-display';
import {
  MissionCardAction, MissionsCardsSectionComponent,
} from './sections/missions-cards-section.component';
import { MissionsTableSectionComponent } from './sections/missions-table-section.component';
import { ConfirmService } from '../../core/confirm.service';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Mission statuses in workflow order, for the status filter. */
const STATUS_CODES: MissionStatus[] = [
  'PENDING_HR', 'PENDING_FINANCE', 'APPROVED', 'REJECTED_HR', 'REJECTED_FINANCE', 'CANCELLED',
];

type ViewMode = 'grid' | 'list';

/**
 * `/rh/missions` — the manager's own missions, in the canonical list shape (§1):
 * `daf-page` + `daf-page-header` + the KPI row + `daf-search-toolbar` + one section per
 * view + `daf-pagination`. Same parts and same order as `/rh/it-provisioning` and
 * `/rh/onboarding`.
 *
 * The endpoint returns the whole list in one call, so the search, the status filter and
 * the paging are all client-side projections of `missions`. No tabs: the status filter in
 * the toolbar panel is what narrows the list, exactly as on it-provisioning.
 *
 * All view state lives here and both sections are stateless input/output shells, which is
 * what makes flipping between cards and list lossless.
 *
 * Read-and-plan only: once submitted a mission belongs to RH's billeterie queue. The one
 * action left here is cancelling it while RH has not answered, which is exactly what
 * `MissionService#cancelByManager` allows.
 */
@Component({
  selector: 'rh-missions-list',
  standalone: true,
  imports: [
    ButtonComponent, MetricCardComponent, PageComponent, PageHeaderComponent,
    PaginationComponent, SearchToolbarComponent, MissionsCardsSectionComponent,
    MissionsTableSectionComponent, MissionFormModalComponent, MissionDetailDrawerComponent,
    TranslatePipe,
  ],
  templateUrl: './missions-list.component.html',
})
export class MissionsListComponent implements OnInit {
  private svc = inject(MissionService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);

  // ── Data ─────────────────────────────────────────────────────────────────
  readonly missions = signal<Mission[]>([]);
  readonly employees = signal<MissionEligibleEmployee[]>([]);
  /** Whole-page skeleton — first load only (§5). */
  readonly firstLoad = signal(true);
  /** Every refresh after that — skeletons inside the affected section only. */
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ── View state ───────────────────────────────────────────────────────────
  readonly viewMode = signal<ViewMode>('grid');
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly currentPage = signal(0);
  readonly pageSize = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // ── Dialogs ──────────────────────────────────────────────────────────────
  readonly showForm = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly selected = signal<Mission | null>(null);

  ngOnInit(): void {
    this.load();
    // The team, fetched once: it is the manager's own org chart and it does not change
    // while they are on the page.
    this.svc.eligibleEmployees()
      .pipe(catchError(() => of([] as MissionEligibleEmployee[])))
      .subscribe(list => this.employees.set(list));
  }

  load(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.error.set(null);
    this.svc.listMine().subscribe({
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
  }

  // ── Projections ──────────────────────────────────────────────────────────
  readonly filteredItems = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.missions().filter(m => {
      const matchesTerm = !term
        || (m.employeeName ?? '').toLowerCase().includes(term)
        || m.title.toLowerCase().includes(term)
        || m.city.toLowerCase().includes(term)
        || (m.countryLabel ?? '').toLowerCase().includes(term);
      return matchesTerm && (!status || m.status === status);
    });
  });

  readonly totalElements = computed(() => this.filteredItems().length);
  readonly totalPages = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  /**
   * The empty state is one message, but it must not claim the list is empty when it is a
   * filter that emptied it — the two are different statements.
   */
  readonly emptyMessage = computed(() => {
    this.translate.currentLang();
    const filtered = !!this.search().trim() || !!this.statusFilter();
    return this.translate.instant(filtered
      ? 'MISSIONS.LIST.EMPTY_FILTERED'
      : 'MISSIONS.LIST.EMPTY');
  });

  // ── KPIs ─────────────────────────────────────────────────────────────────
  readonly stats = computed(() => {
    const all = this.missions();
    return {
      pendingHr:      all.filter(m => m.status === 'PENDING_HR').length,
      pendingFinance: all.filter(m => m.status === 'PENDING_FINANCE').length,
      upcoming:       all.filter(m => isUpcoming(m)).length,
      late:           all.filter(m => isLate(m)).length,
    };
  });

  readonly headerBadges = computed<PageHeaderBadge[]>(() => {
    const active = this.missions().filter(m => isActive(m.status)).length;
    return active > 0 ? [{ label: String(active), variant: 'teal', pill: true }] : [];
  });

  /** Deltas are translated — a hardcoded English string on a French page is the drift. */
  readonly pendingDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const asks = this.missions().filter(m => m.pendingChangeRequest).length;
    if (asks === 0) return null;
    return {
      value: this.translate.instant('MISSIONS.KPI.DELTA_ASKS', { count: asks }),
      direction: 'neutral',
    };
  });

  readonly upcomingDelta = computed<MetricDelta | null>(() => {
    this.translate.currentLang();
    const total = this.missions().length;
    if (total === 0) return null;
    const rate = Math.round((this.missions().filter(m => m.status === 'APPROVED').length / total) * 100);
    return {
      value: this.translate.instant('MISSIONS.KPI.DELTA_APPROVED', { pct: rate }),
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

  // ── Toolbar ──────────────────────────────────────────────────────────────
  /** The status dropdown belongs INSIDE the filter panel, not loose beside the search. */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    return [{
      name: 'status',
      label: this.translate.instant('MISSIONS.LIST.COL_STATUS'),
      type: 'select',
      placeholder: this.translate.instant('MISSIONS.LIST.FILTER_ALL'),
      options: STATUS_CODES.map(code => ({
        value: code,
        label: this.translate.instant('MISSIONS.STATUS.' + code),
      })),
    }];
  });

  /**
   * `initialValues` is a seed read once on first open, and a `select` needs the panel's
   * internal shape — a `string[]`, not a bare string (§10b).
   */
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
      initialValues: { status: this.statusFilter() ? [this.statusFilter()] : [] },
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

  openForm(): void {
    this.formError.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.formError.set(null);
  }

  openDetail(id: number): void {
    const row = this.missions().find(m => m.id === id) ?? null;
    // Refetched rather than shown from the list row: the detail needs the history, which
    // the list endpoint deliberately does not carry.
    this.svc.get(id)
      .pipe(catchError(() => of(row)))
      .subscribe(full => this.selected.set(full));
  }

  onCardAction(event: { mission: Mission; action: MissionCardAction }): void {
    if (event.action === 'cancel') void this.cancel(event.mission);
    else this.openDetail(event.mission.id);
  }

  create(payload: MissionPayload): void {
    this.submitting.set(true);
    this.formError.set(null);
    this.svc.create(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showForm.set(false);
        this.load();
      },
      // The modal keeps what was typed — the overlap and missing-country cases are both
      // 4xx the user can fix in place.
      error: err => {
        this.submitting.set(false);
        this.formError.set(errorMessage(err, this.translate));
      },
    });
  }

  private async cancel(mission: Mission): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('MISSIONS.LIST.CANCEL_CONFIRM_TITLE'),
      message: this.translate.instant('MISSIONS.LIST.CANCEL_CONFIRM', { title: mission.title }),
      confirmLabel: this.translate.instant('MISSIONS.LIST.CANCEL'),
      cancelLabel: this.translate.instant('MISSIONS.COMMON.BACK'),
      icon: 'cancel',
    });
    if (!ok) return;
    this.svc.cancel(mission.id, this.translate.instant('MISSIONS.LIST.CANCELLED_BY_MANAGER'))
      .subscribe({
        next: () => this.load(),
        error: err => this.error.set(errorMessage(err, this.translate)),
      });
  }
}
