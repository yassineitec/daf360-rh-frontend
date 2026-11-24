import { Component, OnInit, signal, computed, inject, input, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  DafCellDirective, DataTableComponent, FilterField, FilterResult, PageComponent, PageHeaderComponent,
  PaginationComponent, SearchToolbarComponent, SearchToolbarFilterConfig,
  StatusBadgeComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { DafModalComponent } from '../../shared/daf-modal.component';
import { AUDIT_SYSTEM_ACTOR, AuditFacets, AuditLogQuery, AuditService } from '../../core/services/audit.service';
import { EmployeeService } from '../../core/services/employee.service';
import { AuditLog } from '../../core/models/audit.model';
import { Page } from '../../core/models/page.model';
import {
  tableLabel, tableDomain, tablesOfDomain, recordIdentity, rowEmployeeProfileId, computeFieldDiffs, groupBatches,
  actionVariant, domainVariant, actorIdsIn, FieldDiff, DisplayRow, FunctionalDomain,
} from './audit-display.util';

const PAGE_SIZE = 30;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

/** The panel's selects, by field name ('' = all). */
interface AuditFilters {
  source: '' | 'EVENT_LOG' | 'GENERIC';
  domain: string;
  entityType: string;
  action: string;
  actor: string;
}
const NO_FILTERS: AuditFilters = { source: '', domain: '', entityType: '', action: '', actor: '' };
const FILTER_KEYS = Object.keys(NO_FILTERS) as (keyof AuditFilters)[];

/** Sent when a domain covers no logged table: matches nothing, instead of « no filter ». */
const NO_TABLE = '__none__';

/** Local calendar day as yyyy-MM-dd — toISOString() would shift it to UTC. */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    TranslatePipe, DafModalComponent, StatusBadgeComponent, SearchToolbarComponent,
    PageComponent, PageHeaderComponent, PaginationComponent, DataTableComponent, DafCellDirective,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="0">
      @if (!embedded()) {
        <daf-page-header
          [title]="'AUDIT.TITLE' | translate"
          [subtitle]="'AUDIT.SUBTITLE' | translate" />
      } @else {
        <p class="text-sm text-muted">{{ 'AUDIT.SUBTITLE' | translate }}</p>
      }

      <daf-search-toolbar
        [placeholder]="'AUDIT.SEARCH' | translate"
        [value]="search()"
        [debounce]="300"
        (valueChange)="onSearch($event)"
        [filterFields]="filterFields()"
        [filterConfig]="filterConfig()"
        (filterApply)="applyFilters($event)"
        [table]="table() ?? null" />

      @if (paysId() != null && paysLabel()) {
        <p class="m-0 text-xs text-muted">{{ 'AUDIT.PAYS_SCOPE' | translate: { pays: paysLabel() } }}</p>
      }

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span class="flex-1">{{ error() }}</span>
          <button type="button" class="font-semibold underline" (click)="load()">{{ 'HISTORY.RETRY' | translate }}</button>
        </div>
      }

      <daf-data-table
        [columns]="columns()"
        [rows]="rows()"
        [config]="tableConfig()"
        (rowClick)="onRowClick($event)">

        <ng-template dafCell="date" let-row>
          <span class="ledger-rail" [class.ledger-rail-group]="row['kind'] === 'group'"
                [style.--rail-color]="railColor(row['action'])">
            {{ row['date'].slice(0,16).replace('T',' ') }}
          </span>
        </ng-template>

        <ng-template dafCell="domain" let-row>
          @if (row['kind'] === 'group') {
            <daf-badge [label]="tableDomain(row['entityType'])"
                       [options]="{ variant: domainVariant(tableDomain(row['entityType'])), size: 'sm' }" />
          } @else if (row['entry'].source === 'GENERIC') {
            <daf-badge [label]="tableDomain(row['entry'].entityType)"
                       [options]="{ variant: domainVariant(tableDomain(row['entry'].entityType)), size: 'sm' }" />
          } @else {
            <span class="text-muted">—</span>
          }
        </ng-template>

        <ng-template dafCell="source" let-row>
          @if (row['kind'] === 'group' || row['entry'].source !== 'EVENT_LOG') {
            <daf-badge [label]="'AUDIT.SOURCE_FIELD_CHANGE' | translate" [options]="{ variant: 'neutral', size: 'sm' }" />
          } @else {
            <daf-badge [label]="'AUDIT.SOURCE_EVENT' | translate" [options]="{ variant: 'secondary', size: 'sm' }" />
          }
        </ng-template>

        <ng-template dafCell="actor" let-row>
          <span class="actor-cell" [title]="row['kind'] === 'group' ? '' : (row['entry'].actor ?? '')">
            {{ row['kind'] === 'group' ? ('AUDIT.ACTOR_SYSTEM' | translate) : actorName(row['entry'].actor) }}
          </span>
        </ng-template>

        <ng-template dafCell="action" let-row>
          @if (row['kind'] === 'group') {
            <daf-badge [label]="'AUDIT.ACTION_' + row['action'] | translate" [options]="{ variant: actionVariant(row['action']), size: 'sm' }" />
          } @else if (row['entry'].source === 'GENERIC') {
            <daf-badge [label]="'AUDIT.ACTION_' + row['entry'].action | translate" [options]="{ variant: actionVariant(row['entry'].action), size: 'sm' }" />
          } @else {
            <span class="action-badge" [title]="row['entry'].action">
              <daf-badge [label]="eventActionLabel(row['entry'].action)" [options]="{ variant: 'secondary', size: 'sm' }" />
            </span>
          }
        </ng-template>

        <ng-template dafCell="entity" let-row>
          <span class="entity-cell">
            {{ row['kind'] === 'group' ? tableLabel(row['entityType'])
               : tableLabel(row['entry'].entityType) }}
          </span>
        </ng-template>

        <ng-template dafCell="reference" let-row>
          @if (row['kind'] === 'group') {
            <span class="mono-cell group-cell" [title]="'AUDIT.GROUP_HINT' | translate">
              <span class="material-symbols-outlined group-icon">schedule</span>
              {{ 'AUDIT.GROUP_LABEL' | translate: { count: row['members'].length } }}
            </span>
          } @else {
            <span class="mono-cell">
              {{ row['entry'].source === 'GENERIC' ? recordIdentity(row['entry']) : (row['entry'].entityId ?? '—') }}
            </span>
          }
        </ng-template>

        <ng-template dafCell="employee" let-row>
          {{ row['kind'] === 'group' ? '—' : employeeLabelFor(row['entry']) }}
        </ng-template>

        <ng-template dafCell="ip" let-row>
          <span class="text-muted">{{ row['kind'] === 'group' ? '—' : (row['entry'].ip ?? '—') }}</span>
        </ng-template>

      </daf-data-table>

      @if (page(); as p) {
        @if (p.totalElements > 0) {
          <daf-pagination
            [currentPage]="p.number"
            [totalPages]="p.totalPages"
            [totalElements]="p.totalElements"
            [pageSize]="pageSize()"
            [pageSizeOptions]="pageSizeOptions"
            [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
            [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
            (pageChange)="goTo($event)"
            (pageSizeChange)="onPageSize($event)" />
        }
      }
    </daf-page>

    <app-daf-modal [title]="'AUDIT.DETAIL_TITLE' | translate" [visible]="detailOpen()" size="lg"
               [hasFooter]="true" (closed)="detailOpen.set(false)">
      @if (activeEntry(); as entry) {
        <div class="detail-meta">
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_DATE' | translate }}</span>{{ entry.timestamp.slice(0,19).replace('T',' ') }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_DOMAIN' | translate }}</span>{{ entry.source === 'GENERIC' ? tableDomain(entry.entityType) : '—' }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_ENTITY' | translate }}</span>{{ tableLabel(entry.entityType) }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_ACTION' | translate }}</span>{{ entry.source === 'GENERIC' ? ('AUDIT.ACTION_' + entry.action | translate) : eventActionLabel(entry.action) }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_ENTITY_ID' | translate }}</span>{{ entry.source === 'GENERIC' ? recordIdentity(entry) : (entry.entityId ?? '—') }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_EMPLOYEE' | translate }}</span>{{ employeeLabelFor(entry) }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_ACTOR' | translate }}</span>{{ actorName(entry.actor) }}</div>
        </div>

        @if (activeDiff().length === 0) {
          <p class="text-muted">{{ 'AUDIT.DETAIL_NO_FIELDS' | translate }}</p>
        } @else {
          <div class="diff-list">
            @for (d of activeDiff(); track d.field) {
              <div class="diff-row">
                <div class="diff-field-name">{{ d.field }}</div>
                @if (d.changed) {
                  <div class="diff-line diff-line-removed"><span class="diff-marker">−</span>{{ diffText(d.before, d.beforeActorId) }}</div>
                  <div class="diff-line diff-line-added"><span class="diff-marker">+</span>{{ diffText(d.after, d.afterActorId) }}</div>
                } @else {
                  <div class="diff-line diff-line-unchanged">{{ diffText(d.after, d.afterActorId) }}</div>
                }
              </div>
            }
          </div>
        }
      }
      <div slot="footer">
        <button class="page-btn" (click)="detailOpen.set(false)">{{ 'AUDIT.CLOSE' | translate }}</button>
      </div>
    </app-daf-modal>

    <app-daf-modal [title]="'AUDIT.GROUP_MODAL_TITLE' | translate" [visible]="groupOpen()" size="lg"
               [hasFooter]="true" (closed)="groupOpen.set(false)">
      @if (activeGroup(); as members) {
        <p class="text-muted">{{ 'AUDIT.GROUP_MODAL_HINT' | translate }}</p>
        <table class="diff-table group-members-table">
          <thead>
            <tr>
              <th>{{ 'AUDIT.COL_DATE' | translate }}</th>
              <th>{{ 'AUDIT.COL_ENTITY_ID' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (m of members; track m.id) {
              <tr class="group-member-row" (click)="openDetailFromGroup(m)">
                <td>{{ m.timestamp.slice(0,19).replace('T',' ') }}</td>
                <td>{{ recordIdentity(m) }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
      <div slot="footer">
        <button class="page-btn" (click)="groupOpen.set(false)">{{ 'AUDIT.CLOSE' | translate }}</button>
      </div>
    </app-daf-modal>
  `,
  styles: [`
    /* ── Ledger rail: a thin coloured spine on the date cell, keyed to the action ── */
    .ledger-rail { position: relative; display: inline-block; padding-left: 0.65rem;
      font-family: ui-monospace, 'Consolas', monospace; font-size: 0.75rem; color: #475569; }
    .ledger-rail::before { content: ''; position: absolute; left: 0; top: 1px; bottom: 1px;
      width: 3px; border-radius: 2px; background: var(--rail-color, #cbd5e1); }
    .ledger-rail-group::before { background-image:
      repeating-linear-gradient(to bottom, var(--rail-color, #cbd5e1) 0 3px, transparent 3px 6px);
      background-color: transparent; }

    .mono-cell { font-family: ui-monospace, 'Consolas', monospace; font-size: 0.75rem; color: #475569; }

    /* Cells keep to their own column: a long event code wraps instead of running under the next one. */
    .action-badge { display: inline-block; max-width: 100%; }
    .action-badge ::ng-deep span { white-space: normal; overflow-wrap: anywhere; text-align: left; }
    .actor-cell, .entity-cell { display: inline-block; max-width: 100%; overflow-wrap: anywhere; }
    .text-muted { color: #94a3b8; }

    .group-cell { font-style: italic; display: inline-flex; align-items: center; gap: 0.35rem; }
    .group-icon { font-size: 15px; color: #64748b; }

    .detail-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1.5rem; margin-bottom: 1.25rem;
      font-size: 0.8rem; }
    .detail-meta-label { display: block; font-size: 0.7rem; font-weight: 600; color: #94a3b8; }

    /* ── Field diff: a version-control-style +/- list, one entry per changed field ── */
    .diff-list { display: flex; flex-direction: column; font-size: 0.8rem;
      font-family: ui-monospace, 'Consolas', monospace; }
    .diff-row { padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
    .diff-field-name { font-family: -apple-system, sans-serif; font-weight: 600; color: #64748b;
      font-size: 0.75rem; margin-bottom: 0.25rem; }
    .diff-line { padding: 0.15rem 0.5rem; border-radius: 4px; white-space: pre-wrap; word-break: break-word; }
    .diff-marker { display: inline-block; width: 1.2em; font-weight: 700; }
    .diff-line-removed { background: #fef2f2; color: #991b1b; }
    .diff-line-removed .diff-marker { color: #dc2626; }
    .diff-line-added { background: #f0fdf4; color: #166534; margin-top: 2px; }
    .diff-line-added .diff-marker { color: #16a34a; }
    .diff-line-unchanged { color: #94a3b8; }

    .diff-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .diff-table th { text-align: left; padding: 0.5rem 0.75rem; background: #f8fafc; color: #475569;
      font-weight: 700; font-size: 0.7rem; border-bottom: 1px solid #e2e8f0; }
    .diff-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; vertical-align: top;
      word-break: break-word; }
    .group-members-table .group-member-row { cursor: pointer; }
    .group-members-table .group-member-row:hover { background: #eff6ff; }
  `],
})
export class AuditLogComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly employeeService = inject(EmployeeService);

  /**
   * Rendered as a tab of Administration (its only home since it left the sidebar): the
   * tab's breadcrumb header already carries the title, so only the subtitle stays.
   */
  readonly embedded = input(false);

  /** The Administration pays picker's entity: its rows + the company-wide ones (no country).
   *  null = no country filter. The server clamps it to the caller's own perimeter anyway. */
  readonly paysId = input<number | null>(null);
  readonly paysLabel = input<string>('');

  /** Handed to the toolbar: column picker sits beside Filtres. */
  readonly table = viewChild(DataTableComponent);

  readonly search   = signal('');
  readonly filters  = signal<AuditFilters>(NO_FILTERS);
  /** One day or [from, to] from the panel; null = all time. */
  readonly range    = signal<Date[] | null>(null);
  readonly pageSize = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly facets   = signal<AuditFacets>({ entityTypes: [], actors: [], eventActions: [] });

  /** Only the latest request's answer is kept — a slow page must not overwrite a newer search. */
  private requestSeq = 0;

  page      = signal<Page<AuditLog> | null>(null);
  firstLoad = signal(true);
  loading   = signal(true);
  error     = signal('');

  detailOpen  = signal(false);
  groupOpen   = signal(false);
  activeEntry = signal<AuditLog | null>(null);
  activeGroup = signal<AuditLog[] | null>(null);

  /** employee_profile_id -> "Prénom Nom", resolved lazily for whichever ids show up on the
   *  current page. A placeholder is shown (and kept) if the lookup 404s. */
  private employeeLabels = signal<Record<number, string>>({});

  /** Users.id -> display name, resolved lazily for whichever `*_by` actor-reference fields
   *  show up in the detail modal currently open (not the row's own `actor` column, which is
   *  already a readable string -- this is for an id found INSIDE a row's own JSON, e.g.
   *  `validated_by`). */
  private actorLabels = signal<Record<number, string>>({});

  readonly displayRows = computed<DisplayRow<AuditLog>[]>(() =>
    groupBatches(this.page()?.content ?? []));

  readonly activeDiff = computed<FieldDiff[]>(() => {
    const entry = this.activeEntry();
    return entry ? computeFieldDiffs(entry) : [];
  });

  readonly tableLabel = tableLabel;
  readonly tableDomain = tableDomain;
  readonly recordIdentity = recordIdentity;
  readonly actionVariant = actionVariant;
  readonly domainVariant = domainVariant;

  /** One `daf-data-table` row per display row -- `kind: 'group'` carries `members`,
   *  `kind: 'single'` carries the raw `entry`. Every cell template branches on `kind`. */
  readonly rows = computed<TableRow[]>(() => this.displayRows().map(row => row.kind === 'group'
    ? { kind: 'group' as const, date: row.timestamp, action: row.action, entityType: row.entityType, members: row.members }
    : { kind: 'single' as const, date: row.entry.timestamp, action: row.entry.action, entry: row.entry }));

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'date',      label: t('AUDIT.COL_DATE'), width: '150px' },
      { key: 'domain',    label: t('AUDIT.COL_DOMAIN') },
      { key: 'source',    label: t('AUDIT.COL_SOURCE') },
      { key: 'actor',     label: t('AUDIT.COL_ACTOR') },
      // No fixed width: event codes (OFFBOARDING_TASK_DONE…) are longer than any I/U/D label.
      { key: 'action',    label: t('AUDIT.COL_ACTION') },
      { key: 'entity',    label: t('AUDIT.COL_ENTITY') },
      { key: 'reference', label: t('AUDIT.COL_ENTITY_ID') },
      { key: 'employee',  label: t('AUDIT.COL_EMPLOYEE') },
      { key: 'ip',        label: t('AUDIT.COL_IP'), width: '110px' },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      hoverable: true,
      loading: this.loading(),
      skeletonRows: 10,
      emptyMessage: t(this.hasCriteria() ? 'AUDIT.EMPTY_FILTERED' : 'AUDIT.EMPTY'),
      resizableColumns: true,
      columnPicker: true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      // Rows arrive in the server's own newest-first order -- no column here sorts.
      rowId: (row) => row['kind'] === 'group'
        ? `group-${(row['members'] as AuditLog[])[0].source}:${(row['members'] as AuditLog[])[0].id}`
        : `${(row['entry'] as AuditLog).source}:${(row['entry'] as AuditLog).id}`,
    };
  });

  /** The ledger rail's colour, by action -- same green/blue/red convention as the action badge,
   *  just restated as a CSS colour since the rail is a plain border, not a `daf-badge`. Also used
   *  for EVENT_LOG rows (an arbitrary action string), which fall through to the neutral blue. */
  railColor(action: string): string {
    switch (action) {
      case 'I': return '#15803d';
      case 'D': return '#b91c1c';
      case 'U': return '#2563eb';
      default:  return '#94a3b8';
    }
  }

  constructor(private auditService: AuditService) {}

  ngOnInit(): void {
    this.load(0);
    this.auditService.facets().subscribe({
      next: f => {
        this.facets.set({
          entityTypes: f?.entityTypes ?? [], actors: f?.actors ?? [], eventActions: f?.eventActions ?? [],
        });
        this.resolveActorNamesOf(f?.actors ?? []); // the « Acteur » filter lists names, not ids
      },
      error: () => {}, // The selects then only offer the fixed choices; search still works.
    });
  }

  /** Loads a page with the current search/filters; no argument = reload the current page. */
  load(page = this.page()?.number ?? 0): void {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set('');
    this.auditService.logs(page, this.pageSize(), this.query()).subscribe({
      next: (p) => {
        if (seq !== this.requestSeq) return;
        // A filter narrowed the set under the page we were on: fall back to its last page.
        if (p.content.length === 0 && p.totalPages > 0 && page >= p.totalPages) {
          this.load(p.totalPages - 1);
          return;
        }
        this.page.set(p);
        this.loading.set(false);
        this.firstLoad.set(false);
        this.resolveEmployees(p.content);
        this.resolveActorNamesOf(p.content.map(e => e.actor));
      },
      error: (e) => {
        if (seq !== this.requestSeq) return;
        this.error.set(e.error?.detail ?? e.error?.message ?? this.translate.instant('AUDIT.ERROR'));
        this.loading.set(false);
        this.firstLoad.set(false);
      },
    });
  }

  goTo(page: number): void { this.load(page); }

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.load(0);
  }

  onSearch(value: string): void {
    const v = value ?? '';
    if (v === this.search()) return; // the toolbar re-emits on blur
    this.search.set(v);
    this.load(0);
  }

  applyFilters(result: FilterResult): void {
    const raw = result['date'];
    this.range.set(Array.isArray(raw) && raw.length ? raw as Date[] : null);
    const next = { ...NO_FILTERS } as Record<keyof AuditFilters, string>;
    for (const k of FILTER_KEYS) {
      const v = result[k];
      next[k] = typeof v === 'string' ? v : '';
    }
    this.filters.set(next as AuditFilters);
    this.load(0);
  }

  private hasCriteria(): boolean {
    const f = this.filters();
    return !!this.search().trim() || !!this.range() || FILTER_KEYS.some(k => !!f[k]);
  }

  /** The toolbar's state as the server's query. A domain is the set of logged tables it covers
   *  (field changes only); with an element too, the two intersect. */
  private query(): AuditLogQuery {
    const f = this.filters();
    const r = this.range();
    let entityTypes: string[] = f.entityType ? [f.entityType] : [];
    let source = f.source;
    if (f.domain) {
      const ofDomain = tablesOfDomain(f.domain as FunctionalDomain, this.facets().entityTypes);
      entityTypes = f.entityType ? entityTypes.filter(t => ofDomain.includes(t)) : ofDomain;
      if (entityTypes.length === 0) entityTypes = [NO_TABLE];
      source = 'GENERIC';
    }
    return {
      q: this.search(),
      from: r?.[0] ? toIsoDay(r[0]) : null,
      to: r?.[0] ? toIsoDay(r[1] ?? r[0]) : null,
      source,
      actions: f.action ? [f.action] : [],
      entityTypes,
      actor: f.actor,
      paysId: this.paysId(),
    };
  }

  readonly filterFields = computed<FilterField[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const all = t('AUDIT.ALL');
    const facets = this.facets();
    this.actorLabels(); // relabel the « Acteur » options once names arrive
    const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

    const domains = Array.from(new Set(facets.entityTypes.map(e => tableDomain(e))))
      .map(d => ({ value: d, label: d })).sort(byLabel);
    // Curated label for known tables; anything else (an event's OffboardingTask) made readable.
    const entities = facets.entityTypes.map(e => ({ value: e, label: tableLabel(e) })).sort(byLabel);
    const actions = [
      { value: 'I', label: t('AUDIT.ACTION_I') },
      { value: 'U', label: t('AUDIT.ACTION_U') },
      { value: 'D', label: t('AUDIT.ACTION_D') },
      ...facets.eventActions.filter(a => !['I', 'U', 'D'].includes(a)).map(a => ({ value: a, label: this.eventActionLabel(a) })),
    ];
    const actors = [
      { value: AUDIT_SYSTEM_ACTOR, label: t('AUDIT.ACTOR_SYSTEM') },
      ...facets.actors.map(a => ({ value: a, label: this.actorName(a) })).sort(byLabel),
    ];

    return [
      { name: 'date', label: t('AUDIT.FILTER_DATE'), type: 'daterange' },
      { name: 'source', label: t('AUDIT.COL_SOURCE'), type: 'select', placeholder: all, options: [
        { value: 'GENERIC', label: t('AUDIT.SOURCE_FIELD_CHANGE') },
        { value: 'EVENT_LOG', label: t('AUDIT.SOURCE_EVENT') },
      ] },
      { name: 'domain', label: t('AUDIT.COL_DOMAIN'), type: 'select', searchable: true, placeholder: all, options: domains },
      { name: 'entityType', label: t('AUDIT.COL_ENTITY'), type: 'select', searchable: true, placeholder: all, options: entities },
      { name: 'action', label: t('AUDIT.COL_ACTION'), type: 'select', searchable: true, placeholder: all, options: actions },
      { name: 'actor', label: t('AUDIT.COL_ACTOR'), type: 'select', searchable: true, placeholder: all, options: actors },
    ];
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

  employeeLabelFor(entry: AuditLog): string {
    if (entry.source !== 'GENERIC') return '—';
    const id = rowEmployeeProfileId(entry);
    if (id === null) return '—';
    return this.employeeLabels()[id] ?? this.translate.instant('AUDIT.EMPLOYEE_PLACEHOLDER', { id });
  }

  /** Resolves whichever employee_profile_ids appear on this page and aren't already cached --
   *  at most a handful of individual GETs per page (same pattern as Facturation's affaire
   *  resolution in audit-trail-admin.component.ts). */
  private resolveEmployees(entries: AuditLog[]): void {
    const known = this.employeeLabels();
    const missing = Array.from(new Set(
      entries
        .filter(e => e.source === 'GENERIC')
        .map(rowEmployeeProfileId)
        .filter((id): id is number => id !== null && !(id in known))
    ));
    if (missing.length === 0) return;

    forkJoin(missing.map(id => this.employeeService.get(id).pipe(
      catchError(() => of(null)),
    ))).subscribe(results => {
      const next = { ...this.employeeLabels() };
      results.forEach((employee, i) => {
        if (employee) next[missing[i]] = `${employee.firstName} ${employee.lastName}`;
      });
      this.employeeLabels.set(next);
    });
  }

  /** What a diff line shows: the resolved actor name when this value is a Users.id, else the
   *  raw display value computeFieldDiffs already produced. */
  diffText(raw: string, actorId: number | null): string {
    return actorId !== null ? this.actorLabelFor(actorId) : raw;
  }

  actorLabelFor(id: number): string {
    return this.actorLabels()[id] ?? this.translate.instant('AUDIT.ACTOR_PLACEHOLDER', { id });
  }

  /** Resolves whichever Users.ids the open entry's own diff references and aren't already
   *  cached -- same lazy/batched/cached pattern as resolveEmployees, just against Users
   *  instead of employee_profiles. */
  private resolveActors(diffs: FieldDiff[]): void {
    this.resolveActorIds(actorIdsIn(diffs));
  }

  /** A row's actor is the caller's Users.id (audit_log.userId, and the token subject written
   *  into audit_trail.changed_by): shown as that user's name once resolved. Anything that is
   *  not an id (a legacy username, an email) is shown as it is. */
  actorName(actor: string | null): string {
    if (actor == null || actor.trim() === '') return this.translate.instant('AUDIT.ACTOR_SYSTEM');
    const id = AuditLogComponent.actorId(actor);
    return id === null ? actor : this.actorLabelFor(id);
  }

  private static actorId(actor: string | null): number | null {
    if (!actor || !/^\d+$/.test(actor.trim())) return null;
    const id = Number(actor.trim());
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  private resolveActorNamesOf(actors: (string | null)[]): void {
    this.resolveActorIds(actors.map(a => AuditLogComponent.actorId(a)).filter((id): id is number => id !== null));
  }

  /** Event codes are SCREAMING_SNAKE (OFFBOARDING_TASK_DONE): a translation if one exists
   *  (AUDIT.EVENT.<code>), else the code made readable. */
  eventActionLabel(code: string): string {
    const key = 'AUDIT.EVENT.' + code;
    const tr = this.translate.instant(key);
    return tr && tr !== key ? tr : this.humanizeCode(code);
  }

  /** OFFBOARDING_TASK_DONE → « Offboarding task done », OffboardingTask → « Offboarding task ». */
  humanizeCode(code: string | null): string {
    if (!code) return '—';
    const words = code
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_\-]+/g, ' ')
      .trim()
      .toLowerCase();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : code;
  }

  private resolveActorIds(ids: number[]): void {
    const known = this.actorLabels();
    // Deduplicated, and under SQL Server's 2100-parameter ceiling for the IN list.
    const missing = Array.from(new Set(ids)).filter(id => !(id in known)).slice(0, 2000);
    if (missing.length === 0) return;

    this.auditService.usersByIds(missing).subscribe({
      next: (actors) => {
        const next = { ...this.actorLabels() };
        for (const a of actors) next[a.id] = a.fullName || a.email || `#${a.id}`;
        this.actorLabels.set(next);
      },
      error: () => {}, // Unresolved ids keep showing the placeholder -- see actorLabelFor.
    });
  }

  onRowClick(row: TableRow): void {
    if (row['kind'] === 'group') this.openGroup(row['members']);
    else this.openDetail(row['entry']);
  }

  openDetail(entry: AuditLog): void {
    this.activeEntry.set(entry);
    this.detailOpen.set(true);
    this.resolveActors(computeFieldDiffs(entry));
  }

  openGroup(members: AuditLog[]): void {
    this.activeGroup.set(members);
    this.groupOpen.set(true);
  }

  /** Clicking a member inside the group modal replaces it with that entry's own detail. */
  openDetailFromGroup(entry: AuditLog): void {
    this.groupOpen.set(false);
    this.openDetail(entry);
  }
}
