import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
import { CandidateListItem } from '../candidate.model';
import { candidateAvatar, candidateInitials, formatDate } from '../candidate-display';

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
 * Accept / reject are per-row (PENDING + permission) and `TableAction` has no
 * row predicate, so the actions are a projected cell of `rh-table-action` rather
 * than `config.actions` — same rendering, per-row visibility (§6b).
 */
@Component({
  selector: 'rh-candidates-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective, TableActionComponent, TranslatePipe],
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="tableConfig()"
      (rowClick)="rowActivate.emit($any($event)['_source'].id)">

      <ng-template dafCell="_actions" let-row>
        <div class="flex items-center justify-end gap-2">
          @if (row['_source'].status === 'PENDING' && canAcceptReject()) {
            <rh-table-action
              icon="check_circle"
              [tooltip]="'CANDIDATES.ACTIONS.ACCEPT' | translate"
              [loading]="actioningId() === row['_source'].id"
              (action)="accept.emit({ candidate: row['_source'], event: $event })" />
            <rh-table-action
              icon="cancel"
              variant="danger"
              [tooltip]="'CANDIDATES.ACTIONS.REJECT' | translate"
              [disabled]="actioningId() === row['_source'].id"
              (action)="reject.emit({ candidate: row['_source'], event: $event })" />
          }
          <rh-table-action
            id="view"
            [tooltip]="'CANDIDATES.ACTIONS.VIEW' | translate"
            (action)="open.emit(row['_source'].id)" />
        </div>
      </ng-template>

    </daf-data-table>
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

  /** The trailing view action — always means "open this candidate". */
  readonly open = output<number>();
  /**
   * A row was clicked. Separate from `open` on purpose: recrutement opens the
   * candidate, while /rh/candidates/list opens the decision-history drawer.
   */
  readonly rowActivate = output<number>();
  readonly accept      = output<{ candidate: CandidateListItem; event: Event }>();
  readonly reject      = output<{ candidate: CandidateListItem; event: Event }>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // No column is `sortable`: daf-data-table sorts client-side, which on a
    // server-paginated list reorders only the visible page (§10b).
    return [
      { key: 'candidat',          label: t('CANDIDATES.LIST.COL_CANDIDATE'), type: 'avatar' },
      { key: 'poste',             label: t('CANDIDATES.LIST.COL_POSITION') },
      { key: 'status',            label: t('CANDIDATES.LIST.COL_STATUS'), type: 'badge' },
      { key: 'expectedStartDate', label: t('CANDIDATES.LIST.COL_START_DATE') },
      { key: '_actions',          label: '', align: 'right', width: '1%' },
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
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: this.translate.instant('CANDIDATES.PIPELINE_RH.NO_CANDIDATES_FOUND'),
    };
  });

  /** Status badges carry a dot everywhere in the app (§6b). */
  private dottedBadge(status: string): BadgeCell {
    const cell = this.statusBadge()(status);
    return { ...cell, options: { ...cell.options, dot: true } };
  }
}
