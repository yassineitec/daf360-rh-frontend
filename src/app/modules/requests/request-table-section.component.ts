import { ChangeDetectionStrategy, Component, computed, inject, input, output, viewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BadgeCell, DataTableComponent, TableColumn, TableConfig, TableRow } from '@khalilrebhiitec/daf360';

import { decisionDate, RequestCardAction, RequestCardItem } from './request-cards-section.component';
import { RequestStatus } from './models/request.model';
import { RelativeDatePipe } from '../../shared/relative-date.pipe';
import { initialsOf } from '../it-provisioning/it-provisioning-display';

/** Workflow order, so a status sort reads Soumis → En traitement → … → Annulé. */
const STATUS_RANK: Record<RequestStatus, number> = {
  SUBMITTED: 0, IN_REVIEW: 1, PENDING_L2: 2, APPROVED: 3, REJECTED: 4, CANCELLED: 5,
};

/**
 * Table column → EmployeeRequest entity field, for the server-side sort. Only real columns
 * can be sorted by the database: the employee name, type label, category and SLA are
 * computed after the query, so they have no entry here. `status` sorts on the stored enum
 * name — alphabetical (APPROVED, CANCELLED, REJECTED…), not the workflow order.
 */
const SERVER_SORT_FIELD: Record<string, string> = {
  submitted: 'submissionDate',
  decided:   'resolutionDate',
  status:    'status',
};

/** Epoch ms for a sort key; null (always sorted last) when there is no date. */
function toTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Table view of `/rh/requests`, on `daf-data-table` — same house style as
 * `rh-it-provisioning-table-section`: `showHeader: false` (the page header is the only h1),
 * `emptyMessage`, icon-only row actions from `config.actions`.
 *
 * `tools` (on for /rh/requests) turns on the library's own table tools: sortable headers,
 * resizable columns and rows, the column picker and the reset icon. Sorting is client-side,
 * so it reorders the fetched batch (up to the page size) — the same batch the search and the
 * "Filtres" panel already work on. Every non-text column sorts through a `sortAccessor`:
 * a relative date ("il y a 2 j") or a badge label would otherwise sort as plain text.
 */
@Component({
  selector: 'app-request-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="emit('view', $event)"
      (sortChange)="onSortChange($event.key, $event.dir)"
      (resetClick)="onSortChange('', null)" />
  `,
})
export class RequestTableSectionComponent {
  private translate = inject(TranslateService);

  /** The rendered table — the page hands it to `daf-search-toolbar` so the reset + column
   *  picker sit right of Filtres instead of above the card. */
  readonly table = viewChild(DataTableComponent);
  private relativeDate = new RelativeDatePipe();

  readonly items = input.required<RequestCardItem[]>();
  readonly loading = input(false);
  readonly skeletonRows = input(10);
  readonly canApprove = input(false);
  readonly emptyMessage = input('');
  /** Historique: no cancel action, and a "Décidée" column replaces the SLA one. */
  readonly history = input(false);
  /** Sort, resize, column picker and reset — /rh/requests only for now. */
  readonly tools = input(false);
  /**
   * Server-side sort (`manualSort`): a header click no longer reorders the rows here — it
   * emits `serverSortChange` with a Spring `sort` value and the page re-fetches. Only the
   * columns backed by an entity field stay sortable (see SERVER_SORT_FIELD).
   */
  readonly serverSort = input(false);
  readonly serverSortChange = output<string | null>();

  readonly action = output<{ action: RequestCardAction; item: RequestCardItem }>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const server = this.serverSort();
    // In server mode only entity-backed columns can sort; the others keep sortable: false.
    const sortableKey = (key: string) => this.tools() && (!server || key in SERVER_SORT_FIELD);
    const sortable = this.tools() && !server;
    const src = (row: TableRow) => (row['_source'] as RequestCardItem).source;
    return [
      // Avatar / plain-text cells: the table's own fallback already sorts on .name / the text.
      { key: 'employee',  label: t('REQUESTS.LIST.COL_EMPLOYEE'), type: 'avatar', sortable },
      { key: 'type',      label: t('REQUESTS.LIST.COL_TYPE'), sortable },
      { key: 'category',  label: t('REQUESTS.CARDS.CATEGORY_LABEL'), sortable },
      { key: 'status',    label: t('REQUESTS.LIST.COL_STATUS'), type: 'badge', sortable: sortableKey('status'),
        sortAccessor: (row) => STATUS_RANK[src(row).status] },
      this.history()
        ? { key: 'decided', label: t('REQUESTS.CARDS.DECIDED_LABEL'), sortable: sortableKey('decided'),
            sortAccessor: (row) => toTime(decisionDate(src(row))) }
        // The SLA deadline is submission + 3 days, so the oldest request is the most urgent;
        // a request with no SLA (not "en cours") returns null and always sorts last.
        : { key: 'sla',     label: t('REQUESTS.CARDS.URGENCY_LABEL'), type: 'badge', sortable,
            sortAccessor: (row) => (row['_source'] as RequestCardItem).isActive ? toTime(src(row).submissionDate) : null },
      { key: 'submitted', label: t('REQUESTS.LIST.COL_SUBMITTED'), sortable: sortableKey('submitted'),
        sortAccessor: (row) => toTime(src(row).submissionDate) },
    ];
  });

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.items().map((item) => ({
      employee: {
        name: item.employeeLabel,
        initials: initialsOf(item.employeeLabel),
        subtitle: item.ref,
      },
      type: item.type,
      category: item.categoryLabel || '—',
      status: { label: item.status.label, options: { ...item.status.options, size: 'sm', dot: true } } satisfies BadgeCell,
      sla: item.isActive && item.slaLabel
        ? { label: item.slaLabel, options: { variant: item.slaVariant, size: 'sm', dot: true } } satisfies BadgeCell
        : { label: '—', options: { variant: 'neutral', size: 'sm' } } satisfies BadgeCell,
      submitted: this.relativeDate.transform(item.submissionDate) || '—',
      decided: this.relativeDate.transform(decisionDate(item.source)) || '—',
      _source: item,
    }));
  });

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const item = (row: TableRow) => row['_source'] as RequestCardItem;
    return {
      showHeader: false,
      hoverable: true,
      loading: this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: this.emptyMessage(),
      // Stable row identity: row heights and sorting are keyed by it, not by render index.
      rowId: (row) => (row['_source'] as RequestCardItem).id,
      // Rows are rendered in the order the server returned; sortChange still fires.
      manualSort: this.serverSort(),
      ...(this.tools() ? {
        resizableColumns: true,
        resizableRows: true,
        columnPicker: true,
        columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
        showReset: true,
        resetLabel: t('REQUESTS.TABLE.RESET'),
        sortLabel: t('REQUESTS.TABLE.SORT_BY'),
      } : {}),
      actions: [
        { id: 'view', icon: 'visibility', tooltip: t('REQUESTS.LIST.VIEW_DETAIL'),
          onClick: (row) => this.emit('view', row) },
        { id: 'approve', icon: 'check_circle', tooltip: t('REQUESTS.DETAIL.APPROVE_BTN'),
          hidden: (row) => !this.canApprove() || !item(row).isActive,
          onClick: (row) => this.emit('approve', row) },
        // Kept visible but greyed when not allowed, like the card list's disabled button.
        { id: 'cancel', icon: 'cancel', variant: 'danger', tooltip: t('REQUESTS.DETAIL.CANCEL_BTN'),
          hidden: () => this.history(),
          disabled: (row) => !!item(row).cancelDisabledReason,
          onClick: (row) => this.emit('cancel', row) },
      ],
    };
  });

  /** Header click in server mode → Spring `sort` value, or null when the sort is cleared —
   *  also on the reset icon, which clears the table's sort without emitting sortChange. */
  protected onSortChange(key: string, dir: 'asc' | 'desc' | null): void {
    if (!this.serverSort()) return;
    const field = SERVER_SORT_FIELD[key];
    this.serverSortChange.emit(field && dir ? `${field},${dir}` : null);
  }

  protected emit(action: RequestCardAction, row: TableRow): void {
    this.action.emit({ action, item: row['_source'] as RequestCardItem });
  }
}
