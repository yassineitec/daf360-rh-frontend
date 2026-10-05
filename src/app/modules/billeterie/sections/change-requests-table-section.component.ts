import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { MissionChangeRequest } from '../../missions/mission.model';
import { initialsOf, localeDate, localeOf } from '../../missions/mission-display';

/** Accept moves the mission (or cancels it); refuse only closes the ask. */
export type ChangeRequestAction = 'accept' | 'refuse';

/**
 * The employees' asks on their own missions — a table only, no card view.
 *
 * Deliberately: an ask is three fields and a reason, and the decision is read from the
 * requested dates next to the current ones. A card grid would spread four short values
 * over a 232px tile and bury the comparison the reviewer actually needs.
 *
 * Library table tools are on, same as the other RH tables. **No `manualSort`**: this list
 * is not paginated, every ask is already a row, so the library's own client-side sort orders
 * the whole set — through `sortAccessor`s, since the cells hold formatted dates. The actions
 * are `config.actions`, not a projected `_actions` cell that fixed layout would squeeze.
 */
@Component({
  selector: 'rh-change-requests-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective],
  host: { class: 'block' },
  template: `
    <daf-data-table [columns]="columns()" [rows]="rows()" [config]="config()">

      <ng-template dafCell="ask" let-row>
        <p class="text-body-md font-semibold text-on-surface">{{ row['askLabel'] }}</p>
        @if (row['_source'].requestedStartDate) {
          <p class="text-body-sm text-outline">
            {{ localeDate(row['_source'].requestedStartDate) }} →
            {{ localeDate(row['_source'].requestedEndDate) }}
          </p>
        }
      </ng-template>

      <!-- The reason is the whole decision, so it wraps instead of truncating. -->
      <ng-template dafCell="reason" let-row>
        <p class="max-w-md whitespace-pre-line text-body-md text-on-surface">
          {{ row['_source'].reason }}
        </p>
      </ng-template>

    </daf-data-table>
  `,
})
export class ChangeRequestsTableSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<MissionChangeRequest[]>();
  readonly loading      = input(false);
  readonly emptyMessage = input('');

  readonly act = output<{ request: MissionChangeRequest; action: ChangeRequestAction }>();

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  /**
   * Bound so the template keeps calling `localeDate(x)` while the locale follows the UI
   * language. The bare helper defaults to fr-FR, which printed French dates under English
   * labels.
   */
  protected readonly localeDate = (iso: string | null) => localeDate(iso, this.locale());

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const src = (row: TableRow) => row['_source'] as MissionChangeRequest;
    const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || null : null);
    return [
      // Avatar / badge cells: the library's own fallback sorts on .name / .label.
      { key: 'employee', label: t('MISSIONS.LIST.COL_EMPLOYEE'), type: 'avatar', sortable: true },
      { key: 'type',     label: t('BILLETERIE.COL_ASK'), type: 'badge', sortable: true },
      // The requested start date; a cancellation has none and sorts last.
      { key: 'ask',      label: t('MISSIONS.CHANGE.REQUESTED_PERIOD'), sortable: true,
        sortAccessor: (row) => time(src(row).requestedStartDate) },
      { key: 'reason',   label: t('BILLETERIE.COL_REASON'), sortable: true,
        sortAccessor: (row) => src(row).reason || null },
      // The real submission time, not the formatted "12/03/2026" text.
      { key: 'created',  label: t('BILLETERIE.COL_SUBMITTED'), sortable: true,
        sortAccessor: (row) => time(src(row).createdAt) },
    ];
  });

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return this.items().map(r => {
      const name = r.employeeName ?? r.requestedByName ?? '—';
      return {
        employee: {
          name,
          initials: initialsOf(name),
          subtitle: r.missionTitle ?? '',
        },
        type: {
          label: t('MISSIONS.CHANGE.TYPE.' + r.requestType),
          // A cancellation kills the mission, a date shift only moves it — different
          // weights, so different colours.
          options: {
            variant: r.requestType === 'CANCELLATION' ? 'danger' : 'warning',
            size: 'sm', dot: true,
          },
        } satisfies BadgeCell,
        askLabel: t('MISSIONS.CHANGE.TYPE.' + r.requestType),
        created: this.localeDate(r.createdAt),
        _source: r,
      };
    });
  });

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const request = (row: TableRow) => row['_source'] as MissionChangeRequest;
    return {
      showHeader: false,
      hoverable: false,
      loading: this.loading(),
      skeletonRows: Math.min(Math.max(this.items().length, 3), 20),
      emptyMessage: this.emptyMessage(),
      // Stable row identity: row heights and sorting are keyed by it, not by render index.
      rowId: (row) => request(row).id,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        t('REQUESTS.TABLE.RESET'),
      sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
      actions: [
        { id: 'accept', icon: 'check_circle', tooltip: t('BILLETERIE.ACCEPT_REQUEST'),
          onClick: (row) => this.act.emit({ request: request(row), action: 'accept' }) },
        { id: 'refuse', icon: 'block', variant: 'danger', tooltip: t('BILLETERIE.REFUSE_REQUEST'),
          onClick: (row) => this.act.emit({ request: request(row), action: 'refuse' }) },
      ],
    };
  });
}
