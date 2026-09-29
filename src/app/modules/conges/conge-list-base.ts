import { computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  FilterField, FilterResult, SearchToolbarFilterConfig, ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';

import { CongesService } from './conges.service';
import { CongeCounts, CongeFilter, CongePage, CongeRow, DemandeEtat } from './models/conge.model';

export const PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export type ViewMode = 'grid' | 'list';

/** The four states, in the order the KPI row shows them. */
export const ETATS: DemandeEtat[] = ['EN_ATTENTE', 'VALIDE', 'REFUSE', 'ARCHIVE'];

/**
 * Everything the four congé list screens do identically: search, the filter panel, the
 * server-side sort, paging, the table/cards toggle and the KPI counts.
 *
 * A base class rather than four copies because these screens differ in exactly three ways —
 * which endpoint they read, which KPI labels they use, and which row actions they offer —
 * and every other line was the same. The missions module duplicates this shape across two
 * pages and the two have already drifted; four would be worse.
 *
 * WHY EVERY PROJECTION IS SERVER-SIDE HERE
 * -----------------------------------------------------------------------------
 * The missions pages filter, search, sort and page in the browser because their endpoint
 * returns the manager's whole list in one call. Congés cannot: `/global` spans the company
 * and there are already 716 rows on a half-migrated database. So the search box, the filter
 * panel, the sort arrows and the pager all re-query, and the KPI tiles come from their own
 * count endpoint rather than from `rows.filter(...)` — which would otherwise report the
 * current page's totals as the whole set's.
 */
export abstract class CongeListBase {
  protected readonly svc = inject(CongesService);
  protected readonly translate = inject(TranslateService);

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly rows = signal<CongeRow[]>([]);
  readonly counts = signal<CongeCounts | null>(null);
  readonly firstLoad = signal(true);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly error = signal<string | null>(null);

  // ── View state ────────────────────────────────────────────────────────────
  readonly viewMode = signal<ViewMode>('list');
  readonly search = signal('');
  readonly etat = signal<DemandeEtat | null>(null);
  readonly type = signal<string | null>(null);
  readonly from = signal<string | null>(null);
  readonly to = signal<string | null>(null);
  readonly currentPage = signal(0);
  readonly pageSize = signal(PAGE_SIZE);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  /** Server-side sort. The key must be one the server accepts — see CongeFilter.sort. */
  readonly sortKey = signal<string>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  /** The selectable leave types, for the filter dropdown. Fetched, never hardcoded. */
  readonly types = signal<{ label: string; value: string }[]>([]);

  /** Each screen names its own endpoint and its own count call. */
  protected abstract fetch(filter: CongeFilter): import('rxjs').Observable<CongePage>;
  protected abstract fetchCounts(): import('rxjs').Observable<CongeCounts>;
  /** Key of the i18n block this screen's empty/filter strings live under. */
  protected abstract scopeKey(): string;

  // ── Loading ───────────────────────────────────────────────────────────────

  protected currentFilter(): CongeFilter {
    return {
      etat: this.etat(),
      type: this.type(),
      from: this.from(),
      to: this.to(),
      search: this.search() || null,
      sort: this.sortKey(),
      dir: this.sortDir(),
      page: this.currentPage(),
      size: this.pageSize(),
    };
  }

  reload(): void {
    if (!this.firstLoad()) this.loading.set(true);
    this.error.set(null);
    this.fetch(this.currentFilter()).subscribe({
      next: (p) => {
        this.rows.set(p.content ?? []);
        this.totalElements.set(p.totalElements ?? 0);
        this.totalPages.set(p.totalPages ?? 0);
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      // Never swallowed into an empty table: "nothing matched" and "the call failed" must
      // not look the same to someone checking whether anyone is waiting on them.
      error: () => {
        this.rows.set([]);
        this.totalElements.set(0);
        this.totalPages.set(0);
        this.loading.set(false);
        this.firstLoad.set(false);
        this.error.set(this.translate.instant('CONGES.ERR_LOAD'));
      },
    });
  }

  reloadCounts(): void {
    this.fetchCounts().subscribe({
      // A failed count leaves the tiles blank rather than showing zeros, which would read
      // as "nothing pending" — the one thing this row must never say by accident.
      next: (c) => this.counts.set(c),
      error: () => this.counts.set(null),
    });
  }

  loadTypes(): void {
    this.svc.types(this.translate.currentLang() ?? 'fr').subscribe({
      next: (list) => this.types.set(list ?? []),
      error: () => this.types.set([]),
    });
  }

  /** Both, and in this order: the list is what the user is waiting to see. */
  refreshAll(): void {
    this.reload();
    this.reloadCounts();
  }

  // ── KPI row ───────────────────────────────────────────────────────────────

  /** A dash, not a zero, while the counts are unknown — see reloadCounts. */
  readonly kpi = computed(() => {
    const c = this.counts();
    const at = (e: DemandeEtat): string | number => (c == null ? '—' : c[e] ?? 0);
    const total = c == null
      ? '—'
      : ETATS.reduce((sum, e) => sum + (c[e] ?? 0), 0);
    return {
      total,
      pending: at('EN_ATTENTE'),
      approved: at('VALIDE'),
      refused: at('REFUSE'),
      archived: at('ARCHIVE'),
    };
  });

  // ── Toolbar ───────────────────────────────────────────────────────────────

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'list', icon: 'view_list', tooltip: this.translate.instant('CONGES.VIEW_LIST') },
      { id: 'grid', icon: 'grid_view', tooltip: this.translate.instant('CONGES.VIEW_GRID') },
    ];
  });

  /**
   * State, type and period — every filter this screen offers, inside the panel.
   *
   * `daterange` renders the library's own `daf-multi-date-picker` in range mode, so the
   * dates are picked on a calendar rather than typed into two native inputs.
   */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      {
        name: 'etat',
        label: t('CONGES.FILTER.ETAT'),
        type: 'select',
        placeholder: t('CONGES.FILTER.ALL'),
        options: ETATS.map((e) => ({ value: e, label: t('CONGES.ETAT.' + e) })),
      },
      {
        name: 'type',
        label: t('CONGES.FILTER.TYPE'),
        type: 'select',
        searchable: true,
        placeholder: t('CONGES.FILTER.ALL'),
        options: this.types().map((x) => ({ value: x.value, label: x.label })),
      },
      { name: 'period', label: t('CONGES.FILTER.PERIOD'), type: 'daterange' },
    ];
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      title: t('CONGES.FILTER.TITLE'),
      applyLabel: t('CONGES.FILTER.APPLY'),
      cancelLabel: t('CONGES.FILTER.CANCEL'),
      resetLabel: t('CONGES.FILTER.RESET'),
      triggerLabel: t('CONGES.FILTER.TRIGGER'),
      align: 'right',
      // The panel seeds ONCE (`ensureSeed`), and a `select` wants its internal shape —
      // a `string[]`, not a bare string, or the control reads back empty (§10b).
      initialValues: {
        etat: this.etat() ? [this.etat() as string] : [],
        type: this.type() ? [this.type() as string] : [],
        period: this.periodValue(),
      },
    };
  });

  /** `[start, end]` as Dates for the panel, rebuilt from the two ISO signals. */
  private periodValue(): Date[] | null {
    const f = this.from();
    const t = this.to();
    if (!f || !t) return null;
    return [this.parseIso(f), this.parseIso(t)];
  }

  /** Parsed from the parts: `new Date('2026-01-31')` is UTC and can render as the 30th. */
  protected parseIso(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** Back to ISO without going through UTC, for the same reason. */
  protected toIso(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  readonly emptyMessage = computed(() => {
    this.translate.currentLang();
    const filtered = !!this.search().trim() || !!this.etat() || !!this.type() || !!this.from();
    return this.translate.instant(filtered ? 'CONGES.EMPTY_FILTERED' : this.scopeKey() + '.EMPTY');
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  onSearch(value: string): void {
    if (value === this.search()) return;   // daf-search-toolbar re-emits on blur
    this.search.set(value ?? '');
    this.currentPage.set(0);
    this.reload();
  }

  applyFilters(result: FilterResult): void {
    this.etat.set(this.scalar(result['etat']) as DemandeEtat | null);
    this.type.set(this.scalar(result['type']));
    const period = result['period'];
    if (Array.isArray(period) && period.length === 2) {
      this.from.set(this.toIso(period[0] as Date));
      this.to.set(this.toIso(period[1] as Date));
    } else {
      this.from.set(null);
      this.to.set(null);
    }
    this.currentPage.set(0);
    this.reload();
  }

  /** A `select` emits a scalar, a `multiselect` an array — normalise and treat '' as unset. */
  private scalar(v: unknown): string | null {
    const raw = Array.isArray(v) ? v[0] : v;
    return raw == null || raw === '' ? null : String(raw);
  }

  /**
   * The header arrows. `dir: null` is the third click — "no sort" — which the server cannot
   * express, so it goes back to this screen's default rather than sending an empty sort and
   * getting whatever order the database felt like.
   */
  onSort(e: { key: string; dir: 'asc' | 'desc' | null }): void {
    if (e.dir == null) {
      this.sortKey.set(this.defaultSortKey());
      this.sortDir.set('desc');
    } else {
      this.sortKey.set(e.key);
      this.sortDir.set(e.dir);
    }
    this.currentPage.set(0);
    this.reload();
  }

  protected defaultSortKey(): string { return 'createdAt'; }

  setView(mode: string): void { this.viewMode.set(mode as ViewMode); }

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
