import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
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
 */
@Component({
  selector: 'rh-pipeline-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective, TableActionComponent, TranslatePipe],
  host: { class: 'hidden sm:block' },
  template: `
    <daf-data-table
      [columns]="columnDefs()"
      [rows]="rows()"
      [config]="tableConfig()"
      (rowClick)="open.emit($any($event)['_source'].id)">

      <ng-template dafCell="_actions" let-row>
        <div class="flex items-center justify-end gap-2">
          <rh-table-action
            id="view"
            [tooltip]="'PIPELINE.VIEW' | translate"
            (action)="open.emit(row['_source'].id)" />
        </div>
      </ng-template>

    </daf-data-table>
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
    return [
      { key: 'candidat',  label: t('PIPELINE.COL_CANDIDATE'), type: 'avatar' },
      { key: 'poste',     label: t('PIPELINE.COL_POSITION') },
      { key: 'stage',     label: t('PIPELINE.COL_STAGE'), type: 'badge' },
      { key: 'fit',       label: t('PIPELINE.COL_FIT'), align: 'right' },
      { key: '_actions',  label: '', align: 'right', width: '1%' },
    ];
  });

  /**
   * Rows carry the stage *label of the column they were grouped into*, not
   * `candidate.stageLabel`: the board moves a pending candidate with a planned
   * interview into Entretien, and the table has to agree with what the board shows.
   */
  protected readonly rows = computed<TableRow[]>(() =>
    this.columns().flatMap(col =>
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
        _source: c,
      })),
    ),
  );

  protected readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: this.translate.instant('PIPELINE.NO_CANDIDATES'),
    };
  });
}
