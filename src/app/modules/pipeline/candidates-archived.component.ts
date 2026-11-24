import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, BadgeOptions, DataTableComponent, EntityCardComponent, EntityCardOptions, FilterField, FilterResult,
  PaginationComponent, SearchToolbarComponent,
  SearchToolbarFilterConfig, SkeletonComponent, TableColumn, TableConfig, TableRow, ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';

import { candidateAvatar } from '../candidates/candidate-display';
import { candidateInitials } from './pipeline-display';
import { ArchivedCandidate, PipelineService } from './services/pipeline.service';

const PAGE_SIZE = 12;
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

type ViewMode = 'grid' | 'table';

/** Badge colour per archive reason. */
const REASON_VARIANT: Record<string, BadgeOptions['variant']> = {
  POSITION_FILLED: 'success', DEMAND_CLOSED: 'warning', MANUAL: 'neutral', UNKNOWN: 'neutral',
};

/** Local calendar day as yyyy-MM-dd — toISOString() would shift it to UTC. */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/**
 * /rh/candidates/archives — « Archivés » tab of the Candidats page: every archived
 * candidature of the user's entities, newest first, with WHY (post filled after its 30 days,
 * demand closed, archived by hand), the status it had and the demand it answered.
 *
 * Read-only: an archived candidature comes back only as a copy, from the creation wizard
 * (« Nouveau candidat » on a demand whose post was requested before). Cards or table, like the
 * other lists; search, filters and paging run over the loaded list (the endpoint caps it at the
 * 300 most recent). The page around it — title, « Nouveau candidat », KPIs, tab strip — is
 * CandidatesPageComponent's, drawn once for every tab.
 */
@Component({
  selector: 'rh-candidates-archived',
  standalone: true,
  imports: [
    SearchToolbarComponent, DataTableComponent, EntityCardComponent, PaginationComponent,
    SkeletonComponent, TranslatePipe,
  ],
  // A tab of CandidatesPageComponent: its sections join the page's own flex column.
  host: { style: 'display: contents' },
  template: `
      <daf-search-toolbar
        [placeholder]="'CANDIDATES.ARCHIVED.SEARCH' | translate"
        [value]="search()"
        [debounce]="300"
        (valueChange)="onSearch($event)"
        [filterFields]="filterFields()"
        [filterConfig]="filterConfig()"
        (filterApply)="applyFilters($event)"
        [views]="viewOptions()"
        [view]="viewMode()"
        (viewChange)="setView($event)"
        [table]="table() ?? null" />

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span class="flex-1">{{ error() }}</span>
          <button type="button" class="font-semibold underline" (click)="load()">{{ 'HISTORY.RETRY' | translate }}</button>
        </div>
      }

      @if (viewMode() === 'grid') {
        @if (loading()) {
          <div class="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 xl:grid-cols-3">
            @for (i of [0, 1, 2, 3, 4, 5]; track i) {
              <daf-skeleton variant="block" radius="xl" width="100%" height="190px" />
            }
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 xl:grid-cols-3">
            @for (card of pagedCards(); track card.id) {
              <daf-entity-card
                [options]="card.options"
                (cardClick)="open(card.id)"
                (viewClick)="open(card.id)" />
            } @empty {
              <div class="col-span-full flex flex-col items-center gap-2 py-16 text-center text-outline">
                <span class="material-symbols-outlined text-[40px] opacity-30">inventory_2</span>
                <p class="m-0 text-[14px] font-semibold text-on-surface">{{ emptyMessage() }}</p>
              </div>
            }
          </div>
        }
      } @else {
        <daf-data-table
          [columns]="columns()"
          [rows]="pagedRows()"
          [config]="tableConfig()"
          (rowClick)="open($any($event)['_id'])" />
      }

      @if (totalPages() > 0) {
        <daf-pagination
          [currentPage]="page()"
          [totalPages]="totalPages()"
          [totalElements]="filtered().length"
          [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
          [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
          (pageChange)="page.set($event)"
          (pageSizeChange)="onPageSize($event)" />
      }
  `,
})
export class CandidatesArchivedComponent implements OnInit {
  private readonly pipelineSvc = inject(PipelineService);
  private readonly translate   = inject(TranslateService);
  private readonly router      = inject(Router);

  /** Table view only — its daf-data-table goes to the toolbar (column picker). */
  readonly table = viewChild(DataTableComponent);

  readonly items    = signal<ArchivedCandidate[]>([]);
  readonly loading  = signal(true);
  readonly error    = signal<string | null>(null);

  readonly search   = signal('');
  readonly reason   = signal('');
  readonly demand   = signal('');
  readonly range    = signal<Date[] | null>(null);
  readonly viewMode = signal<ViewMode>('grid');
  readonly page     = signal(0);
  readonly pageSize = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.pipelineSvc.getArchived().subscribe({
      next: list => { this.items.set(list ?? []); this.loading.set(false); },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.ARCHIVED.ERR_LOAD'));
      },
    });
  }

  open(id: number | undefined): void {
    if (id != null) this.router.navigate(['/rh/candidates', id]);
  }

  // ── Labels ─────────────────────────────────────────────────────────────────

  private tr(key: string, fallback: string, params?: Record<string, unknown>): string {
    const v = this.translate.instant(key, params);
    return v && v !== key ? v : fallback;
  }

  private locale(): string {
    const lang = this.translate.currentLang();
    return lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar-TN' : 'fr-FR';
  }

  private dateLabel(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(this.locale(), { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private reasonKey(a: ArchivedCandidate): string {
    return a.archiveReason ?? 'UNKNOWN';
  }

  private reasonLabel(a: ArchivedCandidate): string {
    return this.translate.instant('CANDIDATES.LIFECYCLE.ARCHIVE_REASON.' + this.reasonKey(a));
  }

  private fromLabel(a: ArchivedCandidate): string {
    return a.archivedFromStatus ? this.tr('CANDIDATES.STATUS.' + a.archivedFromStatus, a.archivedFromStatus) : '—';
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  readonly filtered = computed<ArchivedCandidate[]>(() => {
    this.translate.currentLang();
    const q = this.search().trim().toLowerCase();
    const reason = this.reason();
    const demand = this.demand();
    const r = this.range();
    const from = r?.[0] ? toIsoDay(r[0]) : null;
    const to   = r?.[0] ? toIsoDay(r[1] ?? r[0]) : null;
    return this.items().filter(a => {
      if (reason && this.reasonKey(a) !== reason) return false;
      if (demand && String(a.demandId ?? '') !== demand) return false;
      if (from && to) {
        const d = a.archivedAt ? toIsoDay(new Date(a.archivedAt)) : null;
        if (!d || d < from || d > to) return false;
      }
      if (q) {
        const hay = [a.fullName, a.position, a.demandTitle, a.email, a.archiveNote, a.rejectionReason,
                     this.reasonLabel(a), a.archivedByName].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  readonly totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()));

  private readonly pageSlice = computed(() => {
    const start = this.page() * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly emptyMessage = computed(() => this.translate.instant(
    this.items().length ? 'CANDIDATES.ARCHIVED.EMPTY_FILTERED' : 'CANDIDATES.ARCHIVED.EMPTY'));

  onSearch(value: string): void {
    const v = value ?? '';
    if (v === this.search()) return; // the toolbar re-emits on blur
    this.search.set(v);
    this.page.set(0);
  }

  applyFilters(result: FilterResult): void {
    const raw = result['date'];
    this.range.set(Array.isArray(raw) && raw.length ? raw as Date[] : null);
    this.reason.set(typeof result['reason'] === 'string' ? result['reason'] as string : '');
    this.demand.set(typeof result['demand'] === 'string' ? result['demand'] as string : '');
    this.page.set(0);
  }

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(0);
  }

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'grid',  icon: 'grid_view', tooltip: this.translate.instant('REQUESTS.LIST.VIEW_GRID') },
      { id: 'table', icon: 'view_list', tooltip: this.translate.instant('REQUESTS.LIST.VIEW_TABLE') },
    ];
  });

  setView(id: string): void {
    if (id === 'grid' || id === 'table') this.viewMode.set(id);
  }

  /** Only the reasons and demands the loaded archive holds — no choice can empty the list. */
  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const all = t('CANDIDATES.ARCHIVED.ALL');
    const reasons = new Map<string, string>();
    const demands = new Map<string, string>();
    for (const a of this.items()) {
      reasons.set(this.reasonKey(a), this.reasonLabel(a));
      if (a.demandId != null) demands.set(String(a.demandId), a.demandTitle || ('#' + a.demandId));
    }
    const opts = (m: Map<string, string>) =>
      [...m].map(([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label));
    return [
      { name: 'date',   label: t('CANDIDATES.ARCHIVED.FILTER_DATE'), type: 'daterange' },
      { name: 'reason', label: t('CANDIDATES.ARCHIVED.COL_REASON'), type: 'select', placeholder: all, options: opts(reasons) },
      { name: 'demand', label: t('CANDIDATES.ARCHIVED.COL_DEMAND'), type: 'select', searchable: true, placeholder: all, options: opts(demands) },
    ];
  });

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      title:        t('HISTORY.FILTERS.TITLE'),
      applyLabel:   t('HISTORY.FILTERS.APPLY'),
      cancelLabel:  t('HISTORY.FILTERS.CANCEL'),
      resetLabel:   t('HISTORY.FILTERS.RESET'),
      triggerLabel: t('HISTORY.FILTERS.TRIGGER'),
      align:        'right',
      initialValues: {
        reason: this.reason() ? [this.reason()] : [],
        demand: this.demand() ? [this.demand()] : [],
        date:   this.range(),
      },
    };
  });

  // ── Cards ──────────────────────────────────────────────────────────────────

  readonly pagedCards = computed<{ id: number; options: EntityCardOptions }[]>(() => {
    this.translate.currentLang();
    const t = (k: string, p?: Record<string, unknown>) => this.translate.instant(k, p);
    return this.pageSlice().map(a => ({
      id: a.id,
      options: {
        image: { avatar: candidateAvatar(a.gender ?? undefined) || undefined, initials: candidateInitials(a.fullName) },
        metadata: {
          title: a.fullName || '—',
          subtitle: a.position || a.demandTitle || undefined,
          status: a.archiveReason === 'POSITION_FILLED' ? 'active' : a.archiveReason === 'DEMAND_CLOSED' ? 'pending' : 'inactive',
          statusLabel: this.reasonLabel(a),
        },
        metrics: [
          { label: t('CANDIDATES.ARCHIVED.COL_DATE'), value: this.dateLabel(a.archivedAt) },
          { label: t('CANDIDATES.ARCHIVED.COL_FROM'), value: this.fromLabel(a) },
          { label: t('CANDIDATES.ARCHIVED.COL_DEMAND'), value: a.demandTitle || t('CANDIDATES.FILTERS.SPONTANEOUS') },
        ],
        metricsColumns: 3,
        viewLabel: t('CANDIDATES.ARCHIVED.OPEN'),
        clickable: true,
      },
    }));
  });

  // ── Table ──────────────────────────────────────────────────────────────────

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'candidate', label: t('CANDIDATES.ARCHIVED.COL_CANDIDATE'), type: 'avatar' },
      { key: 'demand',    label: t('CANDIDATES.ARCHIVED.COL_DEMAND') },
      { key: 'reason',    label: t('CANDIDATES.ARCHIVED.COL_REASON'), type: 'badge' },
      { key: 'from',      label: t('CANDIDATES.ARCHIVED.COL_FROM') },
      { key: 'note',      label: t('CANDIDATES.ARCHIVED.COL_NOTE') },
      { key: 'date',      label: t('CANDIDATES.ARCHIVED.COL_DATE') },
    ];
  });

  readonly pagedRows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.pageSlice().map(a => ({
      _id: a.id,
      candidate: {
        name: a.fullName || '—',
        initials: candidateInitials(a.fullName),
        avatar: candidateAvatar(a.gender ?? undefined) || undefined,
        subtitle: a.email || a.position || '',
      },
      demand: a.demandTitle || this.translate.instant('CANDIDATES.FILTERS.SPONTANEOUS'),
      reason: { label: this.reasonLabel(a), options: { variant: REASON_VARIANT[this.reasonKey(a)] ?? 'neutral' } } as BadgeCell,
      from: this.fromLabel(a),
      note: a.archiveNote || a.rejectionReason || '—',
      date: a.archivedByName
        ? this.dateLabel(a.archivedAt) + ' · ' + a.archivedByName
        : this.dateLabel(a.archivedAt),
    }));
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      hoverable: true,
      loading: this.loading(),
      skeletonRows: 8,
      emptyMessage: this.emptyMessage(),
      rowId: (row) => String(row['_id']),
      resizableColumns: true,
      columnPicker: true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
    };
  });
}
