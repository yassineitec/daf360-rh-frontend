import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, DataTableComponent, EntityCardComponent, MetricCardComponent, PageComponent,
  PageHeaderComponent, PaginationComponent, SearchToolbarComponent, SkeletonComponent,
} from '@khalilrebhiitec/daf360';
import type {
  AvatarCell, EntityCardOptions, FilterField, FilterResult, SearchToolbarFilterConfig, SortDirection,
  TableColumn, TableConfig, TableRow, ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';

import { NotificationService } from '../../core/notification.service';
import { getAvatarUrl } from '../../shared/utils/avatar.utils';
import { saveBlob } from '../../shared/utils/file-download.utils';
import {
  LeaveStatRow, LeaveStatsFilter, LeaveStatsFilterOptions, LeaveStatsService, LeaveStatsSummary,
} from './leave-stats.service';

type ViewMode = 'grid' | 'list';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * /rh/absences/statistiques — « Statistiques des absences »: approved congé and maladie days
 * per employee and month, moved here from the timesheet (« Statistiques RH »), which only
 * relayed these numbers from RH. GET_HR_STATS, as there.
 *
 * Canonical list page (UI-PLAYBOOK §1): KPI row — totals over every row the filters match,
 * from the same call — then daf-search-toolbar (search, filters on collaborator / month /
 * year offering only values that occur, view toggle, table tools), cards or daf-data-table
 * (server sort), daf-pagination. The Excel export takes the same filters.
 */
@Component({
  selector: 'app-leave-stats',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, ButtonComponent, MetricCardComponent, SearchToolbarComponent,
    DataTableComponent, EntityCardComponent, SkeletonComponent, PaginationComponent, TranslatePipe,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="4">

      <!-- No icon on the page header: platform convention. -->
      <daf-page-header
        [title]="'LEAVE_STATS.TITLE' | translate"
        [subtitle]="'LEAVE_STATS.SUBTITLE' | translate">
        <ng-container pageActions>
          <daf-button
            [options]="{ variant: 'secondary', iconStart: 'download',
                         label: ('LEAVE_STATS.EXPORT' | translate), disabled: exporting() }"
            (onClick)="exportExcel()" />
        </ng-container>
      </daf-page-header>

      <!-- Over every row the search and filters match, never over the current page. -->
      <section class="grid grid-cols-2 gap-2 sm:gap-6 lg:grid-cols-4">
        <daf-metric-card
          [label]="'LEAVE_STATS.KPI.PEOPLE' | translate" [value]="summary()?.collaborateurs ?? '—'"
          [options]="{ icon: 'groups', iconColor: 'text-primary', iconBg: 'bg-primary/10' }" />
        <daf-metric-card
          [label]="'LEAVE_STATS.KPI.CONGE' | translate" [value]="days(summary()?.totalConge)"
          [options]="{ icon: 'beach_access', iconColor: 'text-teal', iconBg: 'bg-teal/10' }" />
        <daf-metric-card
          [label]="'LEAVE_STATS.KPI.MALADIE' | translate" [value]="days(summary()?.totalMaladie)"
          [options]="{ icon: 'medical_services', iconColor: 'text-warning', iconBg: 'bg-warning/10' }" />
        <daf-metric-card
          [label]="'LEAVE_STATS.KPI.TOTAL' | translate" [value]="days(summary()?.total)"
          [options]="{ icon: 'event_busy', iconColor: 'text-success', iconBg: 'bg-success/10' }" />
      </section>

      <daf-search-toolbar
        [placeholder]="'LEAVE_STATS.SEARCH' | translate"
        [value]="search()"
        [debounce]="300"
        (valueChange)="onSearch($event)"
        [filterFields]="filterFields()"
        [filterConfig]="filterConfig()"
        (filterApply)="applyFilters($event)"
        [views]="viewOptions()"
        [view]="viewMode()"
        (viewChange)="setView($event)"
        [table]="viewMode() === 'list' ? (table() ?? null) : null" />

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ error() }}
        </div>
      }

      @if (viewMode() === 'grid') {
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          @if (loading()) {
            @for (i of skeletonSlots(); track i) {
              <daf-skeleton variant="block" radius="xl" width="100%" height="180px" />
            }
          } @else {
            @for (card of cards(); track card.key) {
              <daf-entity-card [options]="card.options" />
            } @empty {
              <div class="col-span-full flex flex-col items-center gap-2 rounded-xl border border-dashed
                          border-outline-variant/50 px-6 py-14 text-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[40px] text-outline-variant">event_available</span>
                <p class="text-body-md">{{ emptyMessage() }}</p>
              </div>
            }
          }
        </div>
      } @else {
        <daf-data-table
          [columns]="columns()"
          [rows]="tableRows()"
          [config]="tableConfig()"
          (sortChange)="onSort($event)"
          (resetClick)="onSort({ key: '', dir: null })" />
      }

      @if (totalElements() > 0) {
        <daf-pagination
          [currentPage]="currentPage()" [totalPages]="totalPages()"
          [totalElements]="totalElements()" [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
          [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
          (pageChange)="onPageChange($event)" (pageSizeChange)="onPageSizeChange($event)" />
      }

    </daf-page>
  `,
})
export class LeaveStatsComponent implements OnInit {
  private readonly svc = inject(LeaveStatsService);
  private readonly translate = inject(TranslateService);
  private readonly notify = inject(NotificationService);

  readonly table = viewChild(DataTableComponent);

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly rows = signal<LeaveStatRow[]>([]);
  readonly summary = signal<LeaveStatsSummary | null>(null);
  readonly options = signal<LeaveStatsFilterOptions | null>(null);
  readonly firstLoad = signal(true);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);

  // ── View state ────────────────────────────────────────────────────────────
  /** A report reads as a table first; cards stay one click away. */
  readonly viewMode = signal<ViewMode>('list');
  readonly search = signal('');
  readonly collaborateurs = signal<string[]>([]);
  readonly months = signal<string[]>([]);
  readonly years = signal<string[]>([]);
  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly currentPage = signal(0);
  readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  readonly totalElements = signal(0);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalElements() / this.pageSize())));
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly skeletonSlots = computed(() => Array.from({ length: Math.min(this.pageSize(), 12) }, (_, i) => i));

  ngOnInit(): void {
    this.svc.filterOptions().subscribe({
      next: (o) => this.options.set(o),
      error: () => this.options.set(null),
    });
    this.reload();
  }

  private currentFilter(): LeaveStatsFilter {
    return {
      search: this.search() || null,
      collaborateurs: this.collaborateurs(),
      months: this.months(),
      years: this.years(),
      sort: this.sortKey(),
      dir: this.sortDir(),
      page: this.currentPage(),
      size: this.pageSize(),
    };
  }

  reload(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.error.set(null);
    this.svc.page(this.currentFilter()).subscribe({
      next: (p) => {
        this.rows.set(p.content ?? []);
        this.summary.set(p.summary ?? null);
        this.totalElements.set(p.totalElements ?? 0);
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      // Never an empty table on failure: "nothing matched" and "the call failed" must differ.
      error: () => {
        this.rows.set([]);
        this.summary.set(null);
        this.totalElements.set(0);
        this.loading.set(false);
        this.firstLoad.set(false);
        this.error.set(this.translate.instant('LEAVE_STATS.ERR_LOAD'));
      },
    });
  }

  exportExcel(): void {
    this.exporting.set(true);
    this.svc.export(this.currentFilter(), this.lang()).subscribe({
      next: (blob) => { saveBlob(blob, 'statistiques-absences.xlsx'); this.exporting.set(false); },
      error: () => {
        this.exporting.set(false);
        this.notify.error(this.translate.instant('LEAVE_STATS.ERR_EXPORT'));
      },
    });
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  private lang(): string {
    return this.translate.currentLang() ?? 'fr';
  }

  private locale(): string {
    const l = this.lang();
    return l === 'en' ? 'en-GB' : l === 'ar' ? 'ar' : 'fr-FR';
  }

  /** Days as the language writes them (« 2,5 » / « 2.5 »), at most one decimal; a dash while unknown. */
  days(value: number | null | undefined): string {
    if (value == null) return '—';
    return value.toLocaleString(this.locale(), { maximumFractionDigits: 1 });
  }

  /** « Octobre 2026 » in the current language. */
  private monthName(month: number): string {
    const name = new Date(2000, month - 1, 1).toLocaleDateString(this.locale(), { month: 'long' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private period(row: LeaveStatRow): string {
    return this.monthName(row.month) + ' ' + row.year;
  }

  private person(row: LeaveStatRow): AvatarCell {
    return {
      name: row.collaborateurName || '—',
      avatar: getAvatarUrl(row.collaborateurProfileId, row.collaborateurPhotoUrl, row.collaborateurGender) || undefined,
    };
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────
  // translate.instant is not reactive; reading currentLang() re-labels on a language switch.

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'grid', icon: 'grid_view', tooltip: this.translate.instant('LEAVE_STATS.VIEW_GRID') },
      { id: 'list', icon: 'view_list', tooltip: this.translate.instant('LEAVE_STATS.VIEW_LIST') },
    ];
  });

  /** Collaborator, month and year — multiselects offering only the values that occur. */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const o = this.options();
    const people = (o?.collaborateurs ?? []).map((p) => ({ value: String(p.id), label: p.name ?? '—' }));
    return [
      { name: 'collaborateurs', label: t('LEAVE_STATS.FILTER.PEOPLE'), type: 'multiselect',
        searchable: people.length > 6, options: people },
      { name: 'months', label: t('LEAVE_STATS.FILTER.MONTH'), type: 'multiselect',
        options: (o?.months ?? []).map((m) => ({ value: String(m), label: this.monthName(m) })) },
      { name: 'years', label: t('LEAVE_STATS.FILTER.YEAR'), type: 'multiselect',
        options: (o?.years ?? []).map((y) => ({ value: String(y), label: String(y) })) },
    ];
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      title: t('LEAVE_STATS.FILTER.TITLE'),
      triggerLabel: t('LEAVE_STATS.FILTER.TRIGGER'),
      applyLabel: t('LEAVE_STATS.FILTER.APPLY'),
      cancelLabel: t('LEAVE_STATS.FILTER.CANCEL'),
      resetLabel: t('LEAVE_STATS.FILTER.RESET'),
      align: 'right',
    };
  });

  readonly emptyMessage = computed(() => {
    this.translate.currentLang();
    const filtered = !!this.search() || this.collaborateurs().length > 0 || this.months().length > 0
      || this.years().length > 0;
    return this.translate.instant(filtered ? 'LEAVE_STATS.EMPTY_FILTERED' : 'LEAVE_STATS.EMPTY');
  });

  onSearch(value: string): void {
    const next = (value ?? '').trim();
    if (next === this.search()) return;   // daf-search-toolbar re-emits on blur
    this.search.set(next);
    this.currentPage.set(0);
    this.reload();
  }

  applyFilters(result: FilterResult): void {
    const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
    this.collaborateurs.set(list(result['collaborateurs']));
    this.months.set(list(result['months']));
    this.years.set(list(result['years']));
    this.currentPage.set(0);
    this.reload();
  }

  setView(mode: string): void {
    this.viewMode.set(mode === 'grid' ? 'grid' : 'list');
  }

  // ── Table / cards ─────────────────────────────────────────────────────────

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'collaborateur', label: t('LEAVE_STATS.COL.PEOPLE'), type: 'avatar', sortable: true },
      { key: 'periode', label: t('LEAVE_STATS.COL.PERIOD'), sortable: true },
      { key: 'totalConge', label: t('LEAVE_STATS.COL.CONGE'), sortable: true, align: 'right' },
      { key: 'totalMaladie', label: t('LEAVE_STATS.COL.MALADIE'), sortable: true, align: 'right' },
      { key: 'total', label: t('LEAVE_STATS.COL.TOTAL'), sortable: true, align: 'right' },
    ];
  });

  private rowKey(row: LeaveStatRow): string {
    return row.collaborateurId + '-' + row.year + '-' + row.month;
  }

  readonly tableRows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.rows().map((row) => ({
      id: this.rowKey(row),
      collaborateur: this.person(row),
      periode: this.period(row),
      totalConge: this.days(row.totalConge),
      totalMaladie: this.days(row.totalMaladie),
      total: this.days(row.total),
    }));
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const key = this.sortKey();
    return {
      showHeader: false,
      hoverable: true,
      loading: this.loading(),
      skeletonRows: Math.min(this.pageSize(), 20),
      emptyMessage: this.emptyMessage(),
      rowId: (row: TableRow) => row['id'] as string,
      resizableColumns: true,
      columnPicker: true,
      columnPickerLabel: t('LEAVE_STATS.TABLE.COLUMNS'),
      showReset: true,
      resetLabel: t('LEAVE_STATS.TABLE.RESET'),
      // The server sorts (paged list): the header only cycles and emits.
      manualSort: true,
      ...(key ? { defaultSort: { key, dir: this.sortDir() } } : {}),
    };
  });

  /** One card per employee and month: photo or initials, name, period, the three totals. */
  readonly cards = computed<{ key: string; options: EntityCardOptions }[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return this.rows().map((row) => {
      const who = this.person(row);
      return {
        key: this.rowKey(row),
        options: {
          variant: 'glass',
          image: who.avatar ? { avatar: who.avatar } : { initials: initialsOf(who.name) },
          metadata: { title: who.name, subtitle: this.period(row) },
          metricsColumns: 3,
          metrics: [
            { label: t('LEAVE_STATS.COL.CONGE'), value: this.days(row.totalConge) },
            { label: t('LEAVE_STATS.COL.MALADIE'), value: this.days(row.totalMaladie) },
            { label: t('LEAVE_STATS.COL.TOTAL'), value: this.days(row.total) },
          ],
        },
      };
    });
  });

  /** The third click on a header clears the sort: back to the server's default (newest first). */
  onSort(e: { key: string; dir: SortDirection }): void {
    if (!e.key || !e.dir) {
      this.sortKey.set(null);
      this.sortDir.set('asc');
    } else {
      this.sortKey.set(e.key);
      this.sortDir.set(e.dir);
    }
    this.currentPage.set(0);
    this.reload();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.reload();
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p && p !== '—');
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}
