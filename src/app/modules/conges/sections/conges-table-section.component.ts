import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, StatusBadgeComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
import { CongeRow } from '../models/conge.model';
import {
  avatarFor, formatDays, initialsOf, localeOf, periodOf, stateKey, stateVariant,
} from '../conge-display';

/** What a row can ask the page to do. The page decides which of these it offers. */
export type CongeRowAction = 'view' | 'approve' | 'refuse' | 'archive';

/**
 * The congé table, shared by all four screens (§6b house style: no wrapper,
 * `showHeader: false`, `emptyMessage`, icon-only trailing actions).
 *
 * SORTING IS SERVER-SIDE, AND THAT IS WHY `manualSort` IS ON.
 * -----------------------------------------------------------------------------
 * Without it `daf-data-table` re-sorts the rows it was handed — one page of a paginated
 * set — so the arrows would reorder twenty rows and silently claim to have ordered
 * thousands. With it the header still cycles and emits `sortChange`, the page re-queries,
 * and the rows render in the order the server returned.
 *
 * Only columns the server can actually order by are marked `sortable`, and the list matches
 * `LeaveRequestController.SORTABLE` exactly. `collaborateurName` and `typeLabel` are NOT
 * sortable: both are resolved after the query — one by a batched name lookup, the other by
 * the type catalogue — so no column in the table holds the value being sorted on.
 */
@Component({
  selector: 'rh-conges-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent, DafCellDirective, StatusBadgeComponent, TableActionComponent,
    TranslatePipe,
  ],
  /**
   * `min-w-0` is load-bearing, not cosmetic.
   *
   * A flex/grid item defaults to `min-width: auto`, which refuses to shrink below its content.
   * With resizable columns the table can easily exceed the page width, so this host grew
   * instead of letting `daf-data-table`'s own `overflow-x-auto` engage — the surplus spilled
   * out and was then clipped by `.shell-content { overflow-x: hidden }`. The result: the last
   * columns were unreachable and the column-picker trigger sat off-screen with them.
   *
   * With `min-w-0` the host stays at the page width and the table scrolls inside itself.
   * `/rh/admin`'s `.tab-content` carries the same rule for the same reason.
   */
  host: { class: 'block min-w-0' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      [selected]="selected()"
      (selectedChange)="selectedChange.emit($event)"
      (sortChange)="sortChange.emit($event)"
      (rowClick)="open.emit($any($event)['_source'])">

      <!-- The period plus what it costs in working days — two facts that are always read
           together, so one cell rather than a second column the eye has to pair up. -->
      <ng-template dafCell="periode" let-row>
        <p class="text-body-md text-on-surface">{{ row['periode'] }}</p>
        <p class="text-body-sm text-outline">{{ row['categoryLabel'] }}</p>
      </ng-template>

      <ng-template dafCell="etatBadge" let-row>
        <div class="flex flex-wrap items-center gap-2">
          <daf-badge [label]="row['etatBadge'].label" [options]="row['etatBadge'].options" />
          <!-- A régularisation is a congé somebody else filed. Flagged next to the state
               rather than given a column: it qualifies the row, it is not a value beside it. -->
          @if (row['_settled']) {
            <daf-badge
              [label]="'CONGES.COL.SETTLED_FLAG' | translate"
              [options]="{ variant: 'info', size: 'sm', dot: true }" />
          }
        </div>
      </ng-template>

      <ng-template dafCell="_actions" let-row>
        <div class="flex items-center justify-end gap-2">
          <rh-table-action id="view"
            [tooltip]="'CONGES.VIEW' | translate"
            (action)="open.emit(row['_source'])" />

          @if (allowDecide() && row['_source'].etatDemande === 'EN_ATTENTE') {
            <rh-table-action id="approve" icon="check_circle"
              [tooltip]="'CONGES.INBOX.APPROVE' | translate"
              [disabled]="busy()"
              (action)="act.emit({ row: row['_source'], action: 'approve' })" />
            <rh-table-action id="refuse" icon="cancel" variant="danger"
              [tooltip]="'CONGES.INBOX.REFUSE' | translate"
              [disabled]="busy()"
              (action)="act.emit({ row: row['_source'], action: 'refuse' })" />
          }

          @if (allowArchive() && row['_source'].etatDemande !== 'ARCHIVE') {
            <rh-table-action id="delete" icon="archive" variant="danger"
              [tooltip]="'CONGES.ARCHIVE' | translate"
              [disabled]="busy()"
              (action)="act.emit({ row: row['_source'], action: 'archive' })" />
          }
        </div>
      </ng-template>

    </daf-data-table>
  `,
})
export class CongesTableSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<CongeRow[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);
  readonly emptyMessage = input('');
  /** Approve / refuse — only where the caller may decide, i.e. the queue. */
  readonly allowDecide  = input(false);
  readonly allowArchive = input(false);
  /** Shows who filed each row. On by default only on the régularisations screen. */
  readonly showFiledBy  = input(false);
  readonly busy         = input(false);
  readonly sortKey      = input<string>('createdAt');
  readonly sortDir      = input<'asc' | 'desc'>('desc');

  /**
   * Row selection, as the id strings `daf-data-table` works in. Off unless the page asks:
   * a checkbox column that leads nowhere is clutter on the three read-only screens.
   */
  readonly selectable = input(false);
  readonly selected   = input<string[]>([]);

  readonly open = output<CongeRow>();
  readonly act  = output<{ row: CongeRow; action: CongeRowAction }>();
  readonly sortChange = output<{ key: string; dir: 'asc' | 'desc' | null }>();
  readonly selectedChange = output<string[]>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // WIDTHS ARE SET ONLY ON THE NARROW COLUMNS.
    //
    // Under the `table-layout: fixed` that `resizableColumns` brings, a column with a declared
    // width takes exactly that and the rest share what is left. Sizing the short ones — a day
    // count, a pill, a date — therefore hands the remainder to the three that actually need
    // room (name, type, period), and the table still totals the container width, so nothing
    // overflows. Giving every column a width instead is what produces a scrollbar: the sum
    // stops being the container's width.
    const cols: TableColumn[] = [
      // §6b rule 6: identity is ONE avatar column carrying its secondary line.
      { key: 'employee',  label: t('CONGES.COL.EMPLOYEE'), type: 'avatar' },
      { key: 'typeLabel', label: t('CONGES.COL.TYPE') },
      { key: 'periode',   label: t('CONGES.COL.PERIOD'), sortable: true },
      { key: 'totalJours', label: t('CONGES.COL.DAYS'), align: 'right', sortable: true, width: '90px' },
      { key: 'etatBadge', label: t('CONGES.COL.STATE'), type: 'badge', sortable: true, width: '150px' },
    ];
    if (this.showFiledBy()) {
      cols.push({ key: 'createdByName', label: t('CONGES.COL.FILED_BY') });
    }
    cols.push(
      { key: 'createdAt', label: t('CONGES.COL.SUBMITTED'), type: 'date',
        format: { dateStyle: 'short' }, sortable: true, width: '130px' },
      // A REAL WIDTH, not the `1%` the house style uses elsewhere.
      //
      // `resizableColumns` switches the table to `table-layout: fixed`, and fixed layout
      // honours a declared width literally — `1%` then means one percent of the table, about
      // nine pixels for three 20px icons, so the actions cell overflowed into its neighbour
      // and the last one was clipped at the edge. `1%` only means "as narrow as the content
      // allows" under the default `auto` layout, which is what §6b was written against.
      //
      // Every other column stays width-less on purpose: under fixed layout they then share
      // the remaining space evenly, so the table always fits its container and the horizontal
      // scrollbar goes away.
      { key: '_actions', label: '', align: 'right', width: '132px' },
    );
    return cols;
  });

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const loc = this.locale();
    return this.items().map((r) => ({
      employee: {
        name: r.collaborateurName ?? this.translate.instant('CONGES.UNKNOWN'),
        initials: initialsOf(r.collaborateurName),
        // The real photo, same resolver /rh/profiles uses. The cell falls back to initials
        // on its own when there is none or it fails to load.
        avatar: avatarFor(r),
        subtitle: r.reason ?? '',
      },
      typeLabel: r.typeLabel,
      periode: periodOf(r, loc),
      categoryLabel: r.categoryLabel,
      totalJours: formatDays(r.totalJours, loc),
      etatBadge: {
        label: this.translate.instant(stateKey(r.etatDemande)),
        options: { variant: stateVariant(r.etatDemande), size: 'sm', dot: true },
      } satisfies BadgeCell,
      createdByName: r.createdByName ?? '—',
      createdAt: r.createdAt,
      // A congé filed by someone other than the person it is for. Same test the server's
      // régularisation query uses, so the flag and that list can never disagree.
      _settled: r.createdBy != null && r.createdBy !== r.collaborateurId,
      _source: r,
    }));
  });

  protected readonly config = computed<TableConfig>(() => ({
    showHeader: false,               // the page-header is the only h1 (§6b rule 2)
    hoverable: true,
    loading: this.loading(),
    skeletonRows: Math.min(this.skeletonRows(), 20),
    emptyMessage: this.emptyMessage(),
    // The rows arrive already ordered — see the class comment.
    manualSort: true,
    defaultSort: { key: this.sortKey(), dir: this.sortDir() },
    // `rowId` is load-bearing with resizing on: the width and height maps were keyed by
    // render index, which stops being stable the moment the user sorts.
    // `rowId` is what selection is keyed by as well as what tracking uses, so the ids the
    // page sends to the server are these — the request id, not a render index.
    rowId: (row) => (row['_source'] as CongeRow).id,
    selectable: this.selectable(),
    selectAllLabel: this.translate.instant('CONGES.SELECT_ALL'),
    selectRowLabel: this.translate.instant('CONGES.SELECT_ROW'),
    // Congé rows carry a reason that can run long and an employee cell that cannot be
    // truncated usefully, so the reader gets to decide which columns deserve the width.
    resizableColumns: true,
    columnPicker: true,
    columnPickerLabel: this.translate.instant('CONGES.COLUMNS'),
    // Both of the above are per-viewer adjustments, and the lib offers to undo them only
    // once something has actually been changed — so this adds no chrome by default.
    sortLabel: this.translate.instant('CONGES.SORT_BY'),
  }));
}
