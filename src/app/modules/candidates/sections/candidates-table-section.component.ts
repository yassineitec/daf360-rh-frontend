import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DataTableComponent, SortDirection, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { CandidateListItem } from '../candidate.model';
import { candidateAvatar, candidateInitials, formatDate } from '../candidate-display';

/** Table column → Candidate entity field, for the server-side sort. `status` sorts on the
 *  stored enum name (alphabetical), not the translated label or the pipeline order. */
const SERVER_SORT_FIELD: Record<string, string> = {
  candidat:          'firstName',
  poste:             'appliedPosition',
  status:            'status',
  expectedStartDate: 'expectedStartDate',
};

/**
 * Candidate list table — `daf-data-table` on the canonical table pattern
 * (UI-PLAYBOOK §6b, mirroring `/rh/profiles`). Shared by `/rh/recrutement`
 * (list view) and `/rh/candidates/list`, which had two identical tables before.
 *
 * Stateless: rows are derived from `candidates`, and every action leaves as an
 * output. A row click and the trailing view action are deliberately *separate*
 * outputs — recrutement opens the candidate on both, while the list page opens
 * the decision-history drawer on the row and navigates only from the action.
 *
 * The section carries **no breakpoint class**: the page decides whether it is
 * desktop-only (recrutement pairs it with a mobile card list) or shown at every
 * width (the list page has no mobile variant and scrolls horizontally instead).
 *
 * Accept / reject are per-row (PENDING + permission): `config.actions` with the
 * library's per-row `hidden` / `disabled` predicates. They used to be a projected
 * `_actions` cell (from before `TableAction` had predicates), whose `width: '1%'`
 * collapses to a few pixels under `resizableColumns` and would be listed, unnamed, in
 * the column picker. The row being accepted is disabled while its request runs.
 *
 * `tools` (on for /rh/recrutement) turns on the library table tools — sortable headers,
 * resizable columns and rows, the column picker, the reset icon — with **server-side
 * sorting** (`manualSort`): the list is server-paginated, so a header click emits
 * `sortChange` with a Spring `sort` value and the page re-fetches from page 0.
 */
@Component({
  selector: 'rh-candidates-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent],
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="tableConfig()"
      (rowClick)="rowActivate.emit($any($event)['_source'].id)"
      (sortChange)="onSortChange($event.key, $event.dir)"
      (resetClick)="onSortChange('', null)" />
  `,
})
export class CandidatesTableSectionComponent {
  private translate = inject(TranslateService);

  readonly candidates      = input.required<CandidateListItem[]>();
  readonly loading         = input(false);
  readonly skeletonRows    = input(10);
  readonly canAcceptReject = input(false);
  readonly actioningId     = input<number | null>(null);
  /** Status → translated badge label + variant, owned by the page. */
  readonly statusBadge     = input.required<(status: string) => BadgeCell>();
  /** Sort, resize, column picker and reset, with server-side sort — /rh/recrutement and /rh/candidates/list. */
  readonly tools           = input(false);

  /** The trailing view action — always means "open this candidate". */
  readonly open = output<number>();
  /**
   * A row was clicked. Separate from `open` on purpose: recrutement opens the
   * candidate, while /rh/candidates/list opens the decision-history drawer.
   */
  readonly rowActivate = output<number>();
  readonly accept      = output<{ candidate: CandidateListItem; event: Event }>();
  readonly reject      = output<{ candidate: CandidateListItem; event: Event }>();
  /** Spring `sort` value from a header click (`tools` only), or null when cleared. */
  readonly sortChange  = output<string | null>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // Sortable only with `tools`, and then server-side (`manualSort`): the list is
    // server-paginated, so a client-side sort would reorder only the visible page (§10b).
    const sortable = this.tools();
    return [
      { key: 'candidat',          label: t('CANDIDATES.LIST.COL_CANDIDATE'), type: 'avatar', sortable },
      { key: 'poste',             label: t('CANDIDATES.LIST.COL_POSITION'), sortable },
      { key: 'status',            label: t('CANDIDATES.LIST.COL_STATUS'), type: 'badge', sortable },
      { key: 'expectedStartDate', label: t('CANDIDATES.LIST.COL_START_DATE'), sortable },
    ];
  });

  protected readonly rows = computed<TableRow[]>(() =>
    this.candidates().map(c => ({
      candidat: {
        name:     `${c.firstName} ${c.lastName}`,
        initials: candidateInitials(c.firstName, c.lastName),
        avatar:   candidateAvatar(c.gender),
        subtitle: c.emailPersonal,
      },
      poste:             c.appliedPosition ?? '—',
      status:            this.dottedBadge(c.status),
      expectedStartDate: formatDate(c.expectedStartDate),
      _source:           c,
    })),
  );

  protected readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const cand = (row: TableRow) => row['_source'] as CandidateListItem;
    const decidable = (row: TableRow) => cand(row).status === 'PENDING' && this.canAcceptReject();
    const busy = (row: TableRow) => this.actioningId() === cand(row).id;
    // The page handlers call event.stopPropagation() (the card list hands them the real
    // click); the library already stops it on its actions cell, so a plain Event does.
    const click = () => new Event('click');
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: t('CANDIDATES.PIPELINE_RH.NO_CANDIDATES_FOUND'),
      // Stable row identity: row heights and sorting are keyed by it, not by render index.
      rowId:        (row) => cand(row).id,
      ...(this.tools() ? {
        resizableColumns:  true,
        resizableRows:     true,
        columnPicker:      true,
        columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
        showReset:         true,
        resetLabel:        t('REQUESTS.TABLE.RESET'),
        sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
        // Rows are rendered in the order the server returned; sortChange still fires.
        manualSort:        true,
      } : {}),
      actions: [
        { id: 'accept', icon: 'check_circle', tooltip: t('CANDIDATES.ACTIONS.ACCEPT'),
          hidden: (row) => !decidable(row), disabled: busy,
          onClick: (row) => this.accept.emit({ candidate: cand(row), event: click() }) },
        { id: 'reject', icon: 'cancel', variant: 'danger', tooltip: t('CANDIDATES.ACTIONS.REJECT'),
          hidden: (row) => !decidable(row), disabled: busy,
          onClick: (row) => this.reject.emit({ candidate: cand(row), event: click() }) },
        { id: 'view', icon: 'visibility', tooltip: t('CANDIDATES.ACTIONS.VIEW'),
          onClick: (row) => this.open.emit(cand(row).id) },
      ],
    };
  });

  /** Header click (or the reset icon) → Spring `sort` value, or null when cleared. */
  protected onSortChange(key: string, dir: SortDirection): void {
    if (!this.tools()) return;
    const field = SERVER_SORT_FIELD[key];
    this.sortChange.emit(field && dir ? `${field},${dir}` : null);
  }

  /** Status badges carry a dot everywhere in the app (§6b). */
  private dottedBadge(status: string): BadgeCell {
    const cell = this.statusBadge()(status);
    return { ...cell, options: { ...cell.options, dot: true } };
  }
}
