import {
  ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import {
  BadgeCell, BadgeOptions, DataTableComponent, FilterField, FilterResult, PaginationComponent,
  SearchToolbarComponent, SearchToolbarFilterConfig, SortDirection, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { getInitials } from '../utils/avatar.utils';
import { HistoryEntry, HistoryLabels } from './history.model';

const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** The panel's selects, by field name ('' = all). */
interface ColumnFilters {
  subject: string;
  subtitle: string;
  action: string;
  category: string;
  actor: string;
  status: string;
}

const NO_FILTERS: ColumnFilters = { subject: '', subtitle: '', action: '', category: '', actor: '', status: '' };
const FILTER_KEYS = Object.keys(NO_FILTERS) as (keyof ColumnFilters)[];

/** Select value of « Système » in the « Par » filter — never a real user id. */
const SYSTEM_ACTOR = 'SYSTEM';

/** Status words → badge colour, when the page does not say (works across modules' codes). */
const SUCCESS = /(DONE|APPROVED|VALIDATED|CONVERTED|RETURNED|HIRED|PASS|COMPLETED|CREATED|ACCEPTED)$/;
const DANGER  = /(REJECTED|FAIL|REFUSED)$/;
const WARNING = /(PENDING|SUBMITTED|ESCALATED|SENT|DRAFT|PLANNED|STARTED|REOPENED|SKIPPED)$/;

function defaultStatusVariant(code: string): BadgeOptions['variant'] {
  if (SUCCESS.test(code)) return 'success';
  if (DANGER.test(code)) return 'danger';
  if (WARNING.test(code)) return 'warning';
  if (/(CANCELLED|ARCHIVED)$/.test(code)) return 'neutral';
  return 'info';
}

/** Local calendar day as yyyy-MM-dd — toISOString() would shift it to UTC. */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;

/**
 * The « Historique » table shared by the RH lifecycle pages (Candidats, Onboarding, Passage en
 * CDI, Offboarding): who did what, when, on which file.
 *
 * Owns the whole tab body: the toolbar (search + one filter per column), the table (every
 * column sortable, over the whole filtered list — `manualSort`, since the rows handed to the
 * table are one page), the pagination. The page owns what is around it — its KPIs and its
 * tab strip — and says how to load and how to label its codes.
 *
 * The period is asked of the server through `source` (none = the server's default window,
 * the last 12 months); the other filters and the search apply to what came back. The server
 * window is a day wider each side (it ignores the user's time zone), the exact local days are
 * applied here.
 */
@Component({
  selector: 'rh-history-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, PaginationComponent, SearchToolbarComponent, TranslatePipe],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <daf-search-toolbar
      [placeholder]="'HISTORY.SEARCH' | translate"
      [value]="search()"
      [debounce]="300"
      (valueChange)="onSearch($event)"
      [filterFields]="filterFields()"
      [filterConfig]="filterConfig()"
      (filterApply)="applyFilters($event)"
      [table]="table() ?? null" />

    @if (!range()) {
      <p class="m-0 text-xs text-outline">{{ 'HISTORY.DEFAULT_WINDOW' | translate }}</p>
    }

    @if (error()) {
      <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
        <span class="material-symbols-outlined text-[18px]">error</span>
        <span class="flex-1">{{ error() }}</span>
        <button type="button" class="font-semibold underline" (click)="load()">
          {{ 'HISTORY.RETRY' | translate }}
        </button>
      </div>
    }

    <!-- manualSort: the rows handed in are one page, so the header only reports the sort
         and this component orders the whole filtered list. Reset clears it too. -->
    <daf-data-table
      [columns]="columns()"
      [rows]="pagedRows()"
      [config]="tableConfig()"
      (rowClick)="onRow($any($event)['_source'])"
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
  `,
})
export class HistoryTableComponent implements OnInit {
  private readonly translate = inject(TranslateService);

  /** Loads the lines of a period (yyyy-MM-dd, both included; null = the server's default). */
  readonly source = input.required<(from: string | null, to: string | null) => Observable<HistoryEntry[]>>();
  readonly labels = input.required<HistoryLabels>();
  /** Avatar of a line's subject; none = initials only. */
  readonly avatar = input<((e: HistoryEntry) => string | undefined) | null>(null);
  /** Lines without a subject to open (e.g. a deleted file) are not clickable. */
  readonly open = output<HistoryEntry>();

  /** Handed to the toolbar: column picker and sort reset sit beside Filtres. */
  readonly table = viewChild(DataTableComponent);

  readonly items   = signal<HistoryEntry[]>([]);
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  readonly search  = signal('');
  readonly filters = signal<ColumnFilters>(NO_FILTERS);
  /** One day or [from, to] from the panel; null = the server's default window. */
  readonly range   = signal<Date[] | null>(null);
  /** Header sort over the whole filtered list; null = newest first (the server's order). */
  readonly sort    = signal<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  readonly page    = signal(0);
  readonly pageSize = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const r = this.range();
    this.loading.set(true);
    this.error.set(null);
    this.source()(r?.[0] ? toIsoDay(r[0]) : null, r?.[0] ? toIsoDay(r[1] ?? r[0]) : null).subscribe({
      next: list => { this.items.set(list ?? []); this.loading.set(false); },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('HISTORY.ERR_LOAD'));
      },
    });
  }

  protected onRow(e: HistoryEntry | undefined): void {
    if (e?.subjectId != null) this.open.emit(e);
  }

  // ── Labels ─────────────────────────────────────────────────────────────────

  /** Translation if there is one, else the fallback (a missing key comes back as itself). */
  private tr(key: string, fallback: string, params?: Record<string, unknown>): string {
    const v = this.translate.instant(key, params);
    return v && v !== key ? v : fallback;
  }

  private locale(): string {
    const lang = this.translate.currentLang();
    return lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar-TN' : 'fr-FR';
  }

  private dateTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(this.locale(), {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  private day(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(this.locale(), { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private subtitleOf(e: HistoryEntry): string {
    const l = this.labels();
    return (l.subtitleText ? l.subtitleText(e) : e.subjectSubtitle) ?? '';
  }

  /** The facts of the action (dates and amounts formatted), then what the actor typed. */
  private detailOf(e: HistoryEntry): string {
    const l = this.labels();
    if (l.detail) return l.detail(e);
    const parts: string[] = [];
    for (const [k, raw] of Object.entries(e.details ?? {})) {
      if (!raw) continue;
      let value = raw;
      if (ISO_DATE.test(raw)) value = this.day(raw);
      else if (ISO_INSTANT.test(raw)) value = this.dateTime(raw);
      else if (/^-?\d+(\.\d+)?$/.test(raw) && /(salary|amount|prorata|net)/i.test(k)) {
        value = Number(raw).toLocaleString(this.locale());
      }
      const generic = this.tr('HISTORY.DETAIL.' + k, k + ' : ' + value, { value });
      parts.push(l.detailPrefix ? this.tr(l.detailPrefix + k, generic, { value }) : generic);
    }
    if (e.comment) parts.push('« ' + e.comment + ' »');
    return parts.join(' · ');
  }

  /** The value a line has for a panel select — what its options are built from too. */
  private filterValue(e: HistoryEntry, key: keyof ColumnFilters): string {
    switch (key) {
      case 'subject':  return e.subjectId != null ? String(e.subjectId) : '';
      case 'subtitle': return this.subtitleOf(e);
      // By label, not code: two codes for the same action read as one.
      case 'action':   return this.labels().action(e);
      case 'category': return e.category ?? '';
      case 'actor':    return e.actorName && e.actorId != null ? String(e.actorId) : SYSTEM_ACTOR;
      case 'status':   return e.status ?? '';
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  readonly filtered = computed<HistoryEntry[]>(() => {
    this.translate.currentLang();
    const l = this.labels();
    const q = this.search().trim().toLowerCase();
    const f = this.filters();
    const active = FILTER_KEYS.filter(k => f[k]);
    const range = this.range();
    const from = range?.[0] ? toIsoDay(range[0]) : null;
    const to   = range?.[0] ? toIsoDay(range[1] ?? range[0]) : null;
    return this.items().filter(e => {
      if (active.some(k => this.filterValue(e, k) !== f[k])) return false;
      if (from && to) {
        const d = toIsoDay(new Date(e.timestamp));
        if (d < from || d > to) return false;
      }
      if (q) {
        const hay = [e.subjectName, this.subtitleOf(e), l.action(e), e.actorName, this.detailOf(e),
                     e.status ? l.status(e.status) : null, e.category ? l.category(e.category) : null]
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
    const key = (r: Date[] | null) => r?.map(toIsoDay).join('|') ?? '';
    const periodChanged = key(this.range()) !== key(range);
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

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(0);
  }

  /**
   * One filter per column (the detail is free text — the search covers it). Every select
   * offers only the values the loaded history holds, so no choice can empty the table.
   * Types and statuses keep the order they first happened in; the others are A→Z.
   */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const l = this.labels();
    const t = (k: string) => this.translate.instant(k);
    const oldestFirst = [...this.items()].reverse();
    const all = t('HISTORY.ALL');
    const system = t('HISTORY.SYSTEM');

    const optionsOf = (key: keyof ColumnFilters, label: (e: HistoryEntry) => string, sort: boolean) => {
      const map = new Map<string, string>();
      for (const e of oldestFirst) {
        const value = this.filterValue(e, key);
        if (value && !map.has(value)) map.set(value, label(e));
      }
      const opts = [...map].map(([value, lab]) => ({ value, label: lab }));
      return sort ? opts.sort((a, b) => a.label.localeCompare(b.label)) : opts;
    };

    const fields: FilterField[] = [
      { name: 'date', label: t('HISTORY.FILTER_DATE'), type: 'daterange' },
      { name: 'subject', label: l.subject(), type: 'select', searchable: true, placeholder: all,
        options: optionsOf('subject', e => e.subjectName || '—', true) },
    ];
    if (l.subtitle) {
      fields.push({ name: 'subtitle', label: l.subtitle(), type: 'select', searchable: true, placeholder: all,
        options: optionsOf('subtitle', e => this.subtitleOf(e), true) });
    }
    fields.push(
      { name: 'action', label: t('HISTORY.COL_ACTION'), type: 'select', searchable: true, placeholder: all,
        options: optionsOf('action', e => l.action(e), true) },
      { name: 'category', label: t('HISTORY.COL_CATEGORY'), type: 'select', placeholder: all,
        options: optionsOf('category', e => l.category(e.category ?? ''), false) },
      { name: 'actor', label: t('HISTORY.COL_ACTOR'), type: 'select', searchable: true, placeholder: all,
        options: optionsOf('actor', e => e.actorName || system, true) },
      { name: 'status', label: t('HISTORY.COL_STATUS'), type: 'select', placeholder: t('HISTORY.ALL_STATUSES'),
        options: optionsOf('status', e => l.status(e.status ?? ''), false) },
    );
    return fields;
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const f = this.filters();
    return {
      title:        t('HISTORY.FILTERS.TITLE'),
      applyLabel:   t('HISTORY.FILTERS.APPLY'),
      cancelLabel:  t('HISTORY.FILTERS.CANCEL'),
      resetLabel:   t('HISTORY.FILTERS.RESET'),
      triggerLabel: t('HISTORY.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: {
        ...Object.fromEntries(FILTER_KEYS.map(k => [k, f[k] ? [f[k]] : []])),
        date: this.range(),
      },
    };
  });

  // ── Sorting ────────────────────────────────────────────────────────────────

  onSort(key: string, dir: SortDirection | null): void {
    this.sort.set(key && (dir === 'asc' || dir === 'desc') ? { key, dir } : null);
    this.page.set(0);
  }

  /** What each column sorts on: what it reads (labels), the date on the instant itself. */
  private sortValue(key: string, e: HistoryEntry): string | null {
    const l = this.labels();
    switch (key) {
      case 'date':     return e.timestamp;                 // ISO: string order = time order
      case 'subject':  return e.subjectName || null;
      case 'action':   return l.action(e);
      case 'category': return e.category ? l.category(e.category) : null;
      case 'actor':    return e.actorName || null;
      case 'status':   return e.status ? l.status(e.status) : null;
      case 'detail':   return this.detailOf(e) || null;
      default:         return null;
    }
  }

  private sorted(items: HistoryEntry[]): HistoryEntry[] {
    const s = this.sort();
    if (!s) return items;
    const sign = s.dir === 'asc' ? 1 : -1;
    const keyed = items.map(e => ({ e, v: this.sortValue(s.key, e) }));
    keyed.sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? 0 : a.v === null ? 1 : -1;
      return a.v.localeCompare(b.v, undefined, { sensitivity: 'base', numeric: true }) * sign;
    });
    return keyed.map(k => k.e);
  }

  // ── Table ──────────────────────────────────────────────────────────────────

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'date',     label: t('HISTORY.COL_DATE'), sortable: true },
      { key: 'subject',  label: this.labels().subject(), type: 'avatar', sortable: true },
      { key: 'action',   label: t('HISTORY.COL_ACTION'), sortable: true },
      { key: 'category', label: t('HISTORY.COL_CATEGORY'), type: 'badge', sortable: true },
      { key: 'actor',    label: t('HISTORY.COL_ACTOR'), sortable: true },
      { key: 'status',   label: t('HISTORY.COL_STATUS'), type: 'badge', sortable: true },
      { key: 'detail',   label: t('HISTORY.COL_DETAIL'), sortable: true },
    ];
  });

  private readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const l = this.labels();
    const avatar = this.avatar();
    const system = this.translate.instant('HISTORY.SYSTEM');
    const statusVariant = l.statusVariant ?? defaultStatusVariant;
    return this.sorted(this.filtered()).map(e => ({
      date:     this.dateTime(e.timestamp),
      subject:  {
        name:     e.subjectName || '—',
        initials: e.subjectName ? getInitials(e.subjectName) : '?',
        avatar:   avatar ? avatar(e) : undefined,
        subtitle: this.subtitleOf(e),
      },
      action:   l.action(e),
      category: e.category
        ? { label: l.category(e.category), options: { variant: l.categoryVariant?.(e.category) ?? 'neutral' } } as BadgeCell
        : { label: '—', options: { variant: 'neutral' } } as BadgeCell,
      actor:    e.actorName || system,
      status:   e.status
        ? { label: l.status(e.status), options: { variant: statusVariant(e.status), dot: true } } as BadgeCell
        : { label: '—', options: { variant: 'neutral' } } as BadgeCell,
      detail:   this.detailOf(e) || '—',
      _source:  e,
    }));
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
      emptyMessage: t(this.items().length ? 'HISTORY.EMPTY_FILTERED' : 'HISTORY.EMPTY'),
      rowId:        (row) => (row['_source'] as HistoryEntry).id,
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
