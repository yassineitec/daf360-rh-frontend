import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { BoardColumn } from '../board.model';
import { KanbanCandidate } from '../services/pipeline.service';
import { candidateAvatar, candidateInitials, stageVariant } from '../pipeline-display';

/**
 * List view of /rh/candidates — `daf-data-table` on the canonical table pattern
 * (UI-PLAYBOOK §6b), over the same board data flattened stage by stage.
 *
 * The kanban endpoint returns the whole tenant-scoped set in one call, so this
 * view is client-side and needs no pagination; the search and stage filter
 * already applied to the board apply here too.
 *
 * Stateless: rows are derived from `columns`, and every action leaves as an
 * output. `config.loading` renders skeleton rows shaped per column, so this
 * section needs no separate `daf-skeleton` for re-fetches (§10b).
 *
 * Library table tools are on, same as the other RH tables: sortable headers, resizable
 * columns and rows, the column picker and the reset icon. **No `manualSort` here**: with
 * no pagination every candidate is already a row, so the library's own client-side sort
 * orders the whole set — `manualSort` only exists to sort beyond the rows handed in.
 *
 * The row action is `config.actions`, not a projected `_actions` column: under
 * `resizableColumns` (fixed layout) the lib sizes its own actions column, whereas a
 * `width: '1%'` cell collapses to a few pixels and would be listed, unnamed, in the
 * column picker.
 */
@Component({
  selector: 'rh-pipeline-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent],
  host: { class: 'hidden sm:block' },
  template: `
    <daf-data-table
      [columns]="columnDefs()"
      [rows]="rows()"
      [config]="tableConfig()"
      (rowClick)="open.emit($any($event)['_source'].id)" />
  `,
})
export class PipelineTableSectionComponent {
  private translate = inject(TranslateService);

  readonly columns      = input.required<BoardColumn[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);

  readonly open = output<number>();

  protected readonly columnDefs = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const src = (row: TableRow) => row['_source'] as KanbanCandidate;
    return [
      // Avatar / text cells: the library's own fallback sorts on .name / the text.
      { key: 'candidat',  label: t('PIPELINE.COL_CANDIDATE'), type: 'avatar', sortable: true },
      { key: 'poste',     label: t('PIPELINE.COL_POSITION'), sortable: true,
        sortAccessor: (row) => src(row).poste || null },
      // Board order (Nouveau → … → Recruté), not the badge label's alphabetical order.
      { key: 'stage',     label: t('PIPELINE.COL_STAGE'), type: 'badge', sortable: true,
        sortAccessor: (row) => row['stageIndex'] as number },
      // The number, not the "85%" string ("100%" would sort before "9%").
      { key: 'fit',       label: t('PIPELINE.COL_FIT'), align: 'right', sortable: true,
        sortAccessor: (row) => src(row).fitScore ?? null },
    ];
  });

  /**
   * Rows carry the stage *label of the column they were grouped into*, not
   * `candidate.stageLabel`: the board moves a pending candidate with a planned
   * interview into Entretien, and the table has to agree with what the board shows.
   */
  protected readonly rows = computed<TableRow[]>(() =>
    this.columns().flatMap((col, stageIndex) =>
      col.candidates.map((c: KanbanCandidate) => ({
        candidat: {
          name:     c.fullName,
          initials: c.initials || candidateInitials(c.fullName),
          avatar:   candidateAvatar(c),
          subtitle: c.email,
        },
        poste:   c.poste || '—',
        stage:   { label: col.label, options: { variant: stageVariant(col.key), dot: true } } as BadgeCell,
        fit:     c.fitScore != null ? `${c.fitScore}%` : '—',
        stageIndex,
        _source: c,
      })),
    ),
  );

  protected readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const src = (row: TableRow) => row['_source'] as KanbanCandidate;
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: t('PIPELINE.NO_CANDIDATES'),
      // Stable row identity: row heights and sorting are keyed by it, not by render index.
      rowId:        (row) => src(row).id,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        t('REQUESTS.TABLE.RESET'),
      sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
      actions: [
        { id: 'view', icon: 'visibility', tooltip: t('PIPELINE.VIEW'),
          onClick: (row) => this.open.emit(src(row).id) },
      ],
    };
  });
}
