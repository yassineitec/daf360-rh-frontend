import { ChangeDetectionStrategy, Component, computed, inject, input, LOCALE_ID, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { BadgeCell, DataTableComponent, TableColumn, TableConfig, TableRow } from '@khalilrebhiitec/daf360';

import { RecruitmentDemandStatus, RecruitmentDemandSummary } from '../recruitment-demand.model';
import { RecruitmentDemandAction, isStaleDemand } from './recruitment-demand-cards-section.component';
import { initialsOf } from '../../it-provisioning/it-provisioning-display';

/** Same traffic-light mapping as the recruitment-demand status badges elsewhere. */
const STATUS_VARIANT: Record<RecruitmentDemandStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  EN_ATTENTE: 'warning',
  APPROUVEE:  'success',
  REJETEE:    'danger',
  ANNULEE:    'neutral',
  CLOTUREE:   'info',
};

/** Workflow order, so a status sort reads En attente → Approuvée → Clôturée → Rejetée → Annulée. */
const STATUS_RANK: Record<RecruitmentDemandStatus, number> = {
  EN_ATTENTE: 0, APPROUVEE: 1, CLOTUREE: 2, REJETEE: 3, ANNULEE: 4,
};

/**
 * Table column → RecruitmentDemand entity field, for the server-side sort. `reason` sorts on the
 * stored code and `status` on the enum name (alphabetical: ANNULEE, APPROUVEE, CLOTUREE…), not
 * on the translated label; the urgency label comes from a lookup table and has no entry.
 */
const SERVER_SORT_FIELD: Record<string, string> = {
  poste:      'jobTitle',
  reason:     'recruitmentReason',
  headcount:  'headcount',
  candidates: 'candidateCount',
  status:     'statut',
  submitted:  'submittedAt',
};

/**
 * Table view of a recruitment-demand list, on `daf-data-table` — same house style as
 * `rh-it-provisioning-table-section` (`showHeader: false`, `emptyMessage`, icon-only row
 * actions from `config.actions`). `decisions` adds approve / reject for the validation queue.
 *
 * `tools` (on for /rh/requests) turns on sortable headers, resizable columns and rows, the
 * column picker and the reset icon — client-side, on the fetched page. Numbers and dates sort
 * through a `sortAccessor` ("10" would otherwise sort before "2", "05/03" before "12/01").
 *
 * `serverSort` switches the table to `manualSort`: a header click emits a Spring `sort` value
 * (`serverSortChange`) and the page re-fetches, so the order spans every page, not just this one.
 */
@Component({
  selector: 'app-recruitment-demand-table-section',
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
export class RecruitmentDemandTableSectionComponent {
  private translate = inject(TranslateService);
  private date = new DatePipe(inject(LOCALE_ID));

  readonly items = input.required<RecruitmentDemandSummary[]>();
  readonly loading = input(false);
  readonly skeletonRows = input(10);
  readonly decisions = input(false);
  readonly emptyMessage = input('');
  /** Sort, resize, column picker and reset — /rh/requests only for now. */
  readonly tools = input(false);
  /** Server-side sort (`manualSort`) — only entity-backed columns stay sortable (SERVER_SORT_FIELD). */
  readonly serverSort = input(false);
  readonly serverSortChange = output<string | null>();

  readonly action = output<{ action: RecruitmentDemandAction; demand: RecruitmentDemandSummary }>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('RECRUITMENT_DEMANDS.LIST.' + k);
    const server = this.serverSort();
    // In server mode only columns backed by an entity field can sort (the urgency label is not).
    const sortable = (key: string) => this.tools() && (!server || key in SERVER_SORT_FIELD);
    const src = (row: TableRow) => row['_source'] as RecruitmentDemandSummary;
    return [
      { key: 'poste',      label: t('COL_POSITION'), type: 'avatar', sortable: sortable('poste') },
      { key: 'reason',     label: t('COL_REASON'), sortable: sortable('reason') },
      { key: 'urgency',    label: t('COL_URGENCY'), sortable: sortable('urgency'),
        sortAccessor: (row) => src(row).urgencyLevelLabel },
      { key: 'headcount',  label: t('COL_HEADCOUNT'),  align: 'center', sortable: sortable('headcount'),
        sortAccessor: (row) => src(row).headcount ?? 0 },
      { key: 'candidates', label: t('COL_CANDIDATES'), align: 'center', sortable: sortable('candidates'),
        sortAccessor: (row) => src(row).candidateCount ?? 0 },
      { key: 'status',     label: t('COL_STATUS'), type: 'badge', sortable: sortable('status'),
        sortAccessor: (row) => STATUS_RANK[src(row).statut] },
      { key: 'submitted',  label: t('COL_SUBMITTED'), sortable: sortable('submitted'),
        sortAccessor: (row) => new Date(src(row).submittedAt).getTime() || null },
    ];
  });

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.items().map((d) => {
      const poste = d.jobExactTitle ?? d.jobTitle;
      return {
        poste: { name: poste, initials: initialsOf(poste), subtitle: d.department ?? '' },
        reason: d.recruitmentReasonLabel ?? '—',
        urgency: d.urgencyLevelLabel ?? '—',
        headcount: String(d.headcount ?? 0),
        candidates: String(d.candidateCount ?? 0),
        status: {
          label: this.translate.instant('RECRUITMENT_DEMANDS.STATUS.' + d.statut),
          // Waiting > 7 days reads as danger here, same cue as the card's red tile.
          options: { variant: isStaleDemand(d) ? 'danger' : STATUS_VARIANT[d.statut], size: 'sm', dot: true },
        } satisfies BadgeCell,
        submitted: this.date.transform(d.submittedAt, 'dd/MM/yyyy') ?? '—',
        _source: d,
      };
    });
  });

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      showHeader: false,
      hoverable: true,
      loading: this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: this.emptyMessage(),
      // Stable row identity: row heights and sorting are keyed by it, not by render index.
      rowId: (row) => (row['_source'] as RecruitmentDemandSummary).id,
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
        { id: 'view', icon: 'visibility',
          tooltip: t(this.decisions() ? 'RECRUITMENT_VALIDATION.OPEN' : 'RECRUITMENT_DEMANDS.LIST.VIEW'),
          onClick: (row) => this.emit('view', row) },
        { id: 'approve', icon: 'check_circle', tooltip: t('RECRUITMENT_VALIDATION.APPROVE'),
          hidden: () => !this.decisions(),
          onClick: (row) => this.emit('approve', row) },
        { id: 'reject', icon: 'cancel', variant: 'danger', tooltip: t('RECRUITMENT_VALIDATION.REJECT'),
          hidden: () => !this.decisions(),
          onClick: (row) => this.emit('reject', row) },
      ],
    };
  });

  /** Header click (or the reset icon) in server mode → Spring `sort` value, or null when cleared. */
  protected onSortChange(key: string, dir: 'asc' | 'desc' | null): void {
    if (!this.serverSort()) return;
    const field = SERVER_SORT_FIELD[key];
    this.serverSortChange.emit(field && dir ? `${field},${dir}` : null);
  }

  protected emit(action: RecruitmentDemandAction, row: TableRow): void {
    this.action.emit({ action, demand: row['_source'] as RecruitmentDemandSummary });
  }
}
