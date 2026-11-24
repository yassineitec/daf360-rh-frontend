import { Component, OnInit, computed, inject, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, BadgeOptions, DataTableComponent, FilterField, FilterResult, PageComponent,
  PageHeaderComponent, PaginationComponent, SearchToolbarComponent, SearchToolbarFilterConfig,
  SortDirection, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { CandidateService } from '../candidates/candidate.service';
import { CandidateHistoryCategory, CandidateHistoryItem } from '../candidates/candidate.model';
import { candidateAvatar } from '../candidates/candidate-display';
import { candidateInitials } from './pipeline-display';
import { CandidatesTabsComponent } from './components/candidates-tabs.component';
import { CandidatesKpisComponent } from './components/candidates-kpis.component';
import { PipelineService, PipelineStats } from './services/pipeline.service';
import { catchError, of } from 'rxjs';

const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Badge colour of each outcome; an unknown code is neutral. */
const STATUS_VARIANT: Record<string, BadgeOptions['variant']> = {
  PENDING: 'neutral', ACCEPTED: 'success', OFFER_SENT: 'warning', OFFER_DRAFT: 'warning',
  HR_IN_PROGRESS: 'info', IT_IN_PROGRESS: 'info', EMAIL_RECEIVED: 'teal', HIRED: 'success',
  REJECTED: 'danger', ARCHIVED: 'neutral',
  PLANNED: 'info', PV_FILED: 'teal', PASS: 'success', FAIL: 'danger', CANCELLED: 'neutral',
  FINANCE_PENDING: 'warning', FINANCE_APPROVED: 'success', FINANCE_REJECTED: 'danger',
  IT_EMAIL_CREATED: 'teal', IT_COMPLETED: 'success', PROFILE_CREATED: 'success',
};

const CATEGORY_VARIANT: Record<CandidateHistoryCategory, BadgeOptions['variant']> = {
  CANDIDATE: 'primary', INTERVIEW: 'info', OFFER: 'warning', FINANCE: 'secondary', ONBOARDING: 'teal',
};

/** Detail keys never shown: technical, or rendered through another key. */
const HIDDEN_DETAILS = new Set(['interviewTypeEn', 'sequence']);

/** The panel's selects, by field name ('' = all). */
interface ColumnFilters {
  candidate: string;
  position: string;
  action: string;
  category: string;
  actor: string;
  status: string;
}

const NO_FILTERS: ColumnFilters = { candidate: '', position: '', action: '', category: '', actor: '', status: '' };
const FILTER_KEYS = Object.keys(NO_FILTERS) as (keyof ColumnFilters)[];

/** Select value of « Système » in the « Par » filter — never a real user id. */
const SYSTEM_ACTOR = 'SYSTEM';

/** Local calendar day as yyyy-MM-dd — toISOString() would shift it to UTC. */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/**
 * /rh/candidates/historique — « Historique » tab of the Candidats page: every action taken on
 * every candidature of the user's entities, newest first, with who took it — creation and
 * edits, CV, interviews (planned, PV filed, validated, cancelled), RH validation or
 * rejection, every offer round, the finance decisions, the onboarding steps.
 *
 * The period is asked of the server (none = the last 12 months, at most 3 000 lines); the
 * status filter and the search are applied here, on what came back, and so is the paging.
 * A row opens the candidate.
 */
@Component({
  selector: 'rh-candidates-history',
  standalone: true,
  imports: [
    DataTableComponent, PageComponent, PageHeaderComponent, PaginationComponent,
    SearchToolbarComponent, CandidatesTabsComponent, CandidatesKpisComponent, TranslatePipe,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="3">

      <!-- Same title as the board: one page, two tabs. -->
      <daf-page-header
        [title]="'PIPELINE.TITLE' | translate"
        [subtitle]="'CANDIDATES.HISTORY.SUBTITLE' | translate" />

      <!-- The page's KPIs, above the strip — the same row as on the Kanban tab. -->
      <rh-candidates-kpis [stats]="stats()" />

      <rh-candidates-tabs active="history" />

      <daf-search-toolbar
        [placeholder]="'CANDIDATES.HISTORY.SEARCH' | translate"
        [value]="search()"
        [debounce]="300"
        (valueChange)="onSearch($event)"
        [filterFields]="filterFields()"
        [filterConfig]="filterConfig()"
        (filterApply)="applyFilters($event)"
        [table]="table() ?? null" />

      @if (!range()) {
        <p class="-mt-4 text-xs text-outline">{{ 'CANDIDATES.HISTORY.DEFAULT_WINDOW' | translate }}</p>
      }

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span class="flex-1">{{ error() }}</span>
          <button type="button" class="font-semibold underline" (click)="load()">
            {{ 'CANDIDATES.HISTORY.RETRY' | translate }}
          </button>
        </div>
      }

      <!-- manualSort: the rows handed in are one page, so the header only reports the sort
           and the page orders the whole filtered list. Reset clears it too. -->
      <daf-data-table
        [columns]="columns()"
        [rows]="pagedRows()"
        [config]="tableConfig()"
        (rowClick)="open($any($event)['_source'])"
        (sortChange)="onSort($event.key, $event.dir)"
        (resetClick)="onSort('', null)" />

      @if (totalPages() > 0) {
        <daf-pagination
          [currentPage]="page()"
          [totalPages]="totalPages()"
          [totalElements]="filtered().length"
          [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          (pageChange)="page.set($event)"
          (pageSizeChange)="onPageSize($event)" />
      }
    </daf-page>
  `,
})
export class CandidatesHistoryComponent implements OnInit {
  private readonly svc       = inject(CandidateService);
  private readonly translate = inject(TranslateService);
  private readonly router    = inject(Router);

  /** Handed to the toolbar: column picker and sort reset sit beside Filtres. */
  readonly table = viewChild(DataTableComponent);

  private readonly pipelineSvc = inject(PipelineService);

  /** Feeds the KPI row above the tabs; null until `/pipeline/stats` answers. */
  readonly stats     = signal<PipelineStats | null>(null);
  readonly items     = signal<CandidateHistoryItem[]>([]);
  readonly firstLoad = signal(true);
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);

  readonly search       = signal('');
  /** One value per select of the panel ('' = all) — every column but the date and the detail. */
  readonly filters      = signal<ColumnFilters>(NO_FILTERS);
  /** One day or [from, to] from the panel; null = the server's default window. */
  readonly range        = signal<Date[] | null>(null);
  /** Header sort over the whole filtered list; null = newest first (the server's order). */
  readonly sort         = signal<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  readonly page         = signal(0);
  readonly pageSize     = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  ngOnInit(): void {
    this.load();
    // The page's KPIs — allowed to fail alone (the tiles then show 0 / « — »).
    this.pipelineSvc.getStats().pipe(catchError(() => of(null)))
      .subscribe(s => this.stats.set(s));
  }

  /** The period goes to the server (it bounds the read); everything else is filtered here. */
  load(): void {
    const r = this.range();
    this.loading.set(true);
    this.error.set(null);
    this.svc.getGlobalHistory(
      r?.[0] ? toIsoDay(r[0]) : null,
      r?.[0] ? toIsoDay(r[1] ?? r[0]) : null,
    ).subscribe({
      next: list => {
        this.items.set(list ?? []);
        this.loading.set(false);
        this.firstLoad.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.firstLoad.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.message
          ?? this.translate.instant('CANDIDATES.HISTORY.ERR_LOAD'));
      },
    });
  }

  open(h: CandidateHistoryItem | undefined): void {
    if (h?.candidateId != null) this.router.navigate(['/rh/candidates', h.candidateId]);
  }

  // ── Labels ─────────────────────────────────────────────────────────────────

  /** Translation if there is one, else the fallback (a missing key comes back as itself). */
  private tr(key: string, fallback: string, params?: Record<string, unknown>): string {
    const v = this.translate.instant(key, params);
    return v && v !== key ? v : fallback;
  }

  private actionLabel(h: CandidateHistoryItem): string {
    return this.tr('CANDIDATES.HISTORY.ACTION.' + h.action, h.actionLabel || h.action);
  }

  private statusLabel(code: string): string {
    return this.tr('CANDIDATES.HISTORY.STATUS.' + code, this.tr('CANDIDATES.STATUS.' + code, code));
  }

  private categoryLabel(c: CandidateHistoryCategory): string {
    return this.tr('CANDIDATES.HISTORY.CATEGORY.' + c, c);
  }

  private locale(): string {
    return this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';
  }

  private dateTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(this.locale(), {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  /** The facts of the action, then what the actor typed — one readable line. */
  private detailText(h: CandidateHistoryItem): string {
    const parts: string[] = [];
    const d = h.details ?? {};
    const en = this.translate.currentLang() === 'en';
    for (const [k, v] of Object.entries(d)) {
      if (HIDDEN_DETAILS.has(k) || !v) continue;
      switch (k) {
        case 'interviewType':
          parts.push((en && d['interviewTypeEn']) || v);
          break;
        case 'scheduledAt':
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.scheduledAt', v, { value: this.dateTime(v) }));
          break;
        case 'opinion':
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.opinion', v,
            { value: this.tr('CANDIDATES.HISTORY.OPINION.' + v, v) }));
          break;
        case 'proposedBy':
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.proposedBy', v,
            { value: this.tr('CANDIDATES.HISTORY.PROPOSED_BY.' + v, v) }));
          break;
        case 'proposedSalary':
        case 'counterSalary': {
          const n = Number(v);
          const value = isNaN(n) ? v : n.toLocaleString(this.locale());
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.' + k, k + ' : ' + value, { value }));
          break;
        }
        default:
          parts.push(this.tr('CANDIDATES.HISTORY.DETAIL.' + k, k + ' : ' + v, { value: v }));
      }
    }
    if (h.comment) parts.push('« ' + h.comment + ' »');
    return parts.join(' · ');
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  /**
   * The server window is a day wider on each side (it does not know the user's time zone):
   * the chosen local days are applied exactly here.
   */
  /** The value a line has for a panel select — what its options are built from too. */
  private filterValue(h: CandidateHistoryItem, key: keyof ColumnFilters): string {
    switch (key) {
      case 'candidate': return h.candidateId != null ? String(h.candidateId) : '';
      case 'position':  return h.candidatePosition ?? '';
      // By label, not code: CREATE and CREATE_CANDIDATE are the same action to the reader.
      case 'action':    return this.actionLabel(h);
      case 'category':  return h.category ?? '';
      case 'actor':     return h.performedByName && h.performedByUserId != null
                          ? String(h.performedByUserId) : SYSTEM_ACTOR;
      case 'status':    return h.status ?? '';
    }
  }

  readonly filtered = computed<CandidateHistoryItem[]>(() => {
    this.translate.currentLang();
    const q = this.search().trim().toLowerCase();
    const f = this.filters();
    const active = FILTER_KEYS.filter(k => f[k]);
    const range = this.range();
    const from = range?.[0] ? toIsoDay(range[0]) : null;
    const to   = range?.[0] ? toIsoDay(range[1] ?? range[0]) : null;
    return this.items().filter(h => {
      if (active.some(k => this.filterValue(h, k) !== f[k])) return false;
      if (from && to) {
        const day = toIsoDay(new Date(h.timestamp));
        if (day < from || day > to) return false;
      }
      if (q) {
        const hay = [h.candidateName, h.candidatePosition, this.actionLabel(h), h.performedByName,
                     this.detailText(h), h.status ? this.statusLabel(h.status) : null,
                     this.categoryLabel(h.category)]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  readonly totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()));

  onSearch(value: string): void {
    if (value === this.search()) return; // the toolbar re-emits on blur
    this.search.set(value ?? '');
    this.page.set(0);
  }

  applyFilters(result: FilterResult): void {
    const raw = result['date'];
    const range = Array.isArray(raw) && raw.length ? raw as Date[] : null;
    const periodChanged = (this.range()?.map(toIsoDay).join('|') ?? '') !== (range?.map(toIsoDay).join('|') ?? '');
    const next = { ...NO_FILTERS };
    for (const k of FILTER_KEYS) {
      const v = result[k];
      next[k] = typeof v === 'string' ? v : '';
    }
    this.filters.set(next);
    this.range.set(range);
    this.page.set(0);
    if (periodChanged) this.load();
  }

  onSort(key: string, dir: SortDirection | null): void {
    this.sort.set(key && (dir === 'asc' || dir === 'desc') ? { key, dir } : null);
    this.page.set(0);
  }

  /**
   * What each column sorts on. Badges sort on what they read (the translated label), the
   * date on the instant itself; missing values go last in both directions.
   */
  private sortValue(key: string, h: CandidateHistoryItem): string | null {
    switch (key) {
      case 'date':      return h.timestamp;                    // ISO: string order = time order
      case 'candidate': return h.candidateName || null;
      case 'action':    return this.actionLabel(h);
      case 'category':  return this.categoryLabel(h.category);
      case 'actor':     return h.performedByName || null;
      case 'status':    return h.status ? this.statusLabel(h.status) : null;
      case 'detail':    return this.detailText(h) || null;
      default:          return null;
    }
  }

  private sorted(items: CandidateHistoryItem[]): CandidateHistoryItem[] {
    const s = this.sort();
    if (!s) return items;
    const sign = s.dir === 'asc' ? 1 : -1;
    const keyed = items.map(h => ({ h, v: this.sortValue(s.key, h) }));
    keyed.sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? 0 : a.v === null ? 1 : -1;
      return a.v.localeCompare(b.v, undefined, { sensitivity: 'base', numeric: true }) * sign;
    });
    return keyed.map(k => k.h);
  }

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(0);
  }

  /**
   * One filter per column (the detail is free text — the search covers it). Every select
   * offers only the values the loaded history holds: no choice can empty the table.
   * Statuses and types keep process order (first seen first); the others are A→Z.
   */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const oldestFirst = [...this.items()].reverse();
    const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

    /** Distinct (value, label) pairs of one column. */
    const optionsOf = (key: keyof ColumnFilters, label: (h: CandidateHistoryItem) => string,
                       sort: boolean) => {
      const map = new Map<string, string>();
      for (const h of oldestFirst) {
        const value = this.filterValue(h, key);
        if (value && !map.has(value)) map.set(value, label(h));
      }
      const opts = [...map].map(([value, l]) => ({ value, label: l }));
      return sort ? opts.sort(byLabel) : opts;
    };
    const system = t('CANDIDATES.HISTORY.SYSTEM');
    const all = t('CANDIDATES.HISTORY.ALL');

    return [
      { name: 'date', label: t('CANDIDATES.HISTORY.FILTER_DATE'), type: 'daterange' },
      { name: 'candidate', label: t('CANDIDATES.HISTORY.COL_CANDIDATE'), type: 'select', searchable: true,
        placeholder: all, options: optionsOf('candidate', h => h.candidateName || '—', true) },
      { name: 'position', label: t('CANDIDATES.HISTORY.COL_POSITION'), type: 'select', searchable: true,
        placeholder: all, options: optionsOf('position', h => h.candidatePosition ?? '', true) },
      { name: 'action', label: t('CANDIDATES.HISTORY.COL_ACTION'), type: 'select', searchable: true,
        placeholder: all, options: optionsOf('action', h => this.actionLabel(h), true) },
      { name: 'category', label: t('CANDIDATES.HISTORY.COL_CATEGORY'), type: 'select',
        placeholder: all, options: optionsOf('category', h => this.categoryLabel(h.category), false) },
      { name: 'actor', label: t('CANDIDATES.HISTORY.COL_ACTOR'), type: 'select', searchable: true,
        placeholder: all, options: optionsOf('actor', h => h.performedByName || system, true) },
      { name: 'status', label: t('CANDIDATES.HISTORY.COL_STATUS'), type: 'select',
        placeholder: t('CANDIDATES.HISTORY.ALL_STATUSES'),
        options: optionsOf('status', h => this.statusLabel(h.status ?? ''), false) },
    ];
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      title:        t('CANDIDATES.FILTERS.TITLE'),
      applyLabel:   t('CANDIDATES.FILTERS.APPLY'),
      cancelLabel:  t('CANDIDATES.FILTERS.CANCEL'),
      resetLabel:   t('CANDIDATES.FILTERS.RESET'),
      triggerLabel: t('CANDIDATES.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: {
        ...Object.fromEntries(FILTER_KEYS.map(k => [k, this.filters()[k] ? [this.filters()[k]] : []])),
        date: this.range(),
      },
    };
  });

  // ── Table ──────────────────────────────────────────────────────────────────

  /** Every column sorts — on the whole filtered list (`manualSort`, see `sortValue`). */
  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'date',      label: t('CANDIDATES.HISTORY.COL_DATE'), sortable: true },
      { key: 'candidate', label: t('CANDIDATES.HISTORY.COL_CANDIDATE'), type: 'avatar', sortable: true },
      { key: 'action',    label: t('CANDIDATES.HISTORY.COL_ACTION'), sortable: true },
      { key: 'category',  label: t('CANDIDATES.HISTORY.COL_CATEGORY'), type: 'badge', sortable: true },
      { key: 'actor',     label: t('CANDIDATES.HISTORY.COL_ACTOR'), sortable: true },
      { key: 'status',    label: t('CANDIDATES.HISTORY.COL_STATUS'), type: 'badge', sortable: true },
      { key: 'detail',    label: t('CANDIDATES.HISTORY.COL_DETAIL'), sortable: true },
    ];
  });

  private readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const system = this.translate.instant('CANDIDATES.HISTORY.SYSTEM');
    return this.sorted(this.filtered()).map(h => {
      const name = h.candidateName || '—';
      return {
        date:      this.dateTime(h.timestamp),
        candidate: {
          name,
          initials: candidateInitials(h.candidateName),
          avatar:   candidateAvatar(h.candidateGender),
          subtitle: h.candidatePosition || '',
        },
        action:    this.actionLabel(h),
        category:  { label: this.categoryLabel(h.category),
                     options: { variant: CATEGORY_VARIANT[h.category] ?? 'neutral' } } as BadgeCell,
        actor:     h.performedByName || system,
        status:    h.status
          ? { label: this.statusLabel(h.status),
              options: { variant: STATUS_VARIANT[h.status] ?? 'neutral', dot: true } } as BadgeCell
          : { label: '—', options: { variant: 'neutral' } } as BadgeCell,
        detail:    this.detailText(h) || '—',
        _source:   h,
      };
    });
  });

  readonly pagedRows = computed(() => {
    const start = this.page() * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      showHeader:   false,
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: 10,
      emptyMessage: t(this.items().length ? 'CANDIDATES.HISTORY.EMPTY_FILTERED' : 'CANDIDATES.HISTORY.EMPTY'),
      rowId:        (row) => (row['_source'] as CandidateHistoryItem).id,
      resizableColumns:  true,
      columnPicker:      true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        t('REQUESTS.TABLE.RESET'),
      sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
      manualSort:        true,
      // A seed read once by the table — tracking it would rebuild the config on every click.
      ...(untracked(this.sort) ? { defaultSort: untracked(this.sort)! } : {}),
    };
  });
}
