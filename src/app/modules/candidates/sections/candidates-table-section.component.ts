import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, ButtonComponent, CardComponent, DafCellDirective, DafHasPermissionDirective,
  DataTableComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { CandidateListItem } from '../candidate.model';
import { candidateAvatar, candidateInitials, formatDate } from '../candidate-display';

/**
 * List view of /rh/recrutement — `daf-data-table` over the server-paginated
 * candidate page. Stateless: rows are derived from `candidates`, and every
 * action leaves as an output.
 *
 * `config.loading` renders skeleton rows shaped per column, so this section
 * needs no separate `daf-skeleton` for re-fetches (UI-PLAYBOOK §10b).
 */
@Component({
  selector: 'rh-candidates-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent, CardComponent, DafCellDirective, DafHasPermissionDirective,
    DataTableComponent, TranslatePipe,
  ],
  host: { class: 'hidden sm:block' },
  template: `
    @if (!loading() && candidates().length === 0) {
      <daf-card [options]="{ variant: 'glass', padding: 'lg' }">
        <div class="flex flex-col items-center justify-center py-10 gap-4">
          <span class="material-symbols-outlined text-6xl text-outline">inbox</span>
          <div class="text-center">
            <p class="text-body-md font-medium text-on-surface-variant">
              {{ 'CANDIDATES.PIPELINE_RH.NO_CANDIDATES_FOUND' | translate }}
            </p>
            <p class="text-label-sm text-outline mt-1">{{ 'CANDIDATES.PIPELINE_RH.TRY_ADJUST' | translate }}</p>
          </div>
          <ng-container *dafHasPermission="'CREATE_CANDIDATE'">
            <daf-button
              [label]="'CANDIDATES.ACTIONS.ADD_CANDIDATE' | translate"
              variant="secondary"
              [options]="{ iconStart: 'person_add', size: 'sm' }"
              (onClick)="create.emit()" />
          </ng-container>
        </div>
      </daf-card>
    } @else {
      <div class="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <daf-data-table
          [columns]="columns()"
          [rows]="rows()"
          [config]="tableConfig()"
          (rowClick)="open.emit($any($event)['_source'].id)">

          <ng-template dafCell="_actions" let-row>
            <div class="inline-flex items-center gap-1 flex-wrap justify-end">
              @if (row['_source'].status === 'PENDING' && canAcceptReject()) {
                <daf-button
                  [label]="'CANDIDATES.ACTIONS.ACCEPT' | translate"
                  variant="ghost"
                  [options]="{ iconStart: 'check_circle', size: 'sm', loading: actioningId() === row['_source'].id }"
                  (onClick)="accept.emit({ candidate: row['_source'], event: $event })" />
                <daf-button
                  [label]="'CANDIDATES.ACTIONS.REJECT' | translate"
                  variant="danger"
                  [options]="{ iconStart: 'cancel', size: 'sm' }"
                  (onClick)="reject.emit({ candidate: row['_source'], event: $event })" />
              }
              <daf-button
                [label]="'CANDIDATES.ACTIONS.VIEW' | translate"
                variant="ghost"
                [options]="{ iconStart: 'open_in_new', size: 'sm' }"
                (onClick)="open.emit(row['_source'].id)" />
            </div>
          </ng-template>

        </daf-data-table>
      </div>
    }
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

  readonly open   = output<number>();
  readonly create = output<void>();
  readonly accept = output<{ candidate: CandidateListItem; event: Event }>();
  readonly reject = output<{ candidate: CandidateListItem; event: Event }>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'candidat',          label: t('CANDIDATES.LIST.COL_CANDIDATE'), type: 'avatar' },
      { key: 'poste',             label: t('CANDIDATES.LIST.COL_POSITION') },
      { key: 'status',            label: t('CANDIDATES.LIST.COL_STATUS'), type: 'badge' },
      { key: 'expectedStartDate', label: t('CANDIDATES.LIST.COL_START_DATE') },
      { key: '_actions',          label: t('CANDIDATES.LIST.COL_ACTIONS'), align: 'right', clickable: true },
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
      status:            this.statusBadge()(c.status),
      expectedStartDate: formatDate(c.expectedStartDate),
      _source:           c,
    })),
  );

  protected readonly tableConfig = computed<TableConfig>(() => ({
    hoverable:    true,
    loading:      this.loading(),
    skeletonRows: this.skeletonRows(),
  }));
}
