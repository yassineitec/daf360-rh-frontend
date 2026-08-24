import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
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
 */
@Component({
  selector: 'rh-change-requests-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective, TableActionComponent, TranslatePipe],
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

      <ng-template dafCell="_actions" let-row>
        <div class="flex items-center justify-end gap-2">
          <rh-table-action id="approve" icon="check_circle"
            [tooltip]="'BILLETERIE.ACCEPT_REQUEST' | translate"
            (action)="act.emit({ request: row['_source'], action: 'accept' })" />
          <rh-table-action id="reject" icon="block" variant="danger"
            [tooltip]="'BILLETERIE.REFUSE_REQUEST' | translate"
            (action)="act.emit({ request: row['_source'], action: 'refuse' })" />
        </div>
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
    return [
      { key: 'employee', label: t('MISSIONS.LIST.COL_EMPLOYEE'), type: 'avatar' },
      { key: 'type',     label: t('BILLETERIE.COL_ASK'), type: 'badge' },
      { key: 'ask',      label: t('MISSIONS.CHANGE.REQUESTED_PERIOD') },
      { key: 'reason',   label: t('BILLETERIE.COL_REASON') },
      { key: 'created',  label: t('BILLETERIE.COL_SUBMITTED') },
      { key: '_actions', label: '', align: 'right', width: '1%' },
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

  protected readonly config = computed<TableConfig>(() => ({
    showHeader: false,
    hoverable: false,
    loading: this.loading(),
    skeletonRows: Math.min(Math.max(this.items().length, 3), 20),
    emptyMessage: this.emptyMessage(),
  }));
}
