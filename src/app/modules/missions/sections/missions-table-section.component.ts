import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, StatusBadgeComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
import { Mission } from '../mission.model';
import {
  daysUntil, destination, formatAmount, initialsOf, isLate, localeDate, localeOf,
  statusKey, statusVariant,
} from '../mission-display';
import { MissionCardAction } from './missions-cards-section.component';

/**
 * List view of `/rh/missions`, on the §6b house table style: no wrapper,
 * `showHeader: false`, `emptyMessage`, icon-only trailing actions.
 *
 * It carries what the cards cannot: the two-line period cell and its lateness warning,
 * and the "modification demandée" flag next to the status — a table can project a cell,
 * `daf-entity-card` has no content slot.
 *
 * **No column is `sortable`.** The rows are one *page* of the filtered set and
 * `daf-data-table` sorts client-side, so the arrows would silently reorder only the
 * visible page (§10b).
 */
@Component({
  selector: 'rh-missions-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent, DafCellDirective, StatusBadgeComponent, TableActionComponent,
    TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="open.emit($any($event)['_source'].id)">

      <ng-template dafCell="period" let-row>
        <p class="text-body-md text-on-surface">{{ row['period'] }}</p>
        @if (row['late']) {
          <p class="flex items-center gap-1 text-body-sm font-bold text-danger">
            <span class="material-symbols-outlined text-body-lg">error</span>
            {{ 'MISSIONS.CARD.LATE_DAYS' | translate:{ days: row['lateDays'] } }}
          </p>
        } @else {
          <p class="text-body-sm text-outline">
            {{ 'MISSIONS.FORM.DURATION' | translate:{ days: row['_source'].durationDays } }}
          </p>
        }
      </ng-template>

      <!-- The status badge plus the employee-ask flag. Not a column of its own: an ask is
           rare, and it is a qualifier on the status rather than a value beside it. -->
      <ng-template dafCell="status" let-row>
        <div class="flex flex-wrap items-center gap-2">
          <daf-badge [label]="row['status'].label" [options]="row['status'].options" />
          @if (row['_source'].pendingChangeRequest) {
            <daf-badge
              [label]="'MISSIONS.LIST.CHANGE_REQUESTED' | translate"
              [options]="{ variant: 'warning', size: 'sm', dot: true }" />
          }
        </div>
      </ng-template>

      <ng-template dafCell="cost" let-row>
        @if (row['_source'].expenses) {
          <span class="text-body-md font-semibold text-on-surface">{{ row['cost'] }}</span>
        } @else {
          <span class="text-body-sm italic text-outline">{{ 'BILLETERIE.NOT_PRICED' | translate }}</span>
        }
      </ng-template>

      <ng-template dafCell="_actions" let-row>
        <div class="flex items-center justify-end gap-2">
          <rh-table-action id="view"
            [tooltip]="'MISSIONS.LIST.VIEW' | translate"
            (action)="open.emit(row['_source'].id)" />
          @if (allowCancel() && row['_source'].status === 'PENDING_HR') {
            <rh-table-action id="delete" icon="cancel" variant="danger"
              [tooltip]="'MISSIONS.LIST.CANCEL' | translate"
              (action)="act.emit({ mission: row['_source'], action: 'cancel' })" />
          }
        </div>
      </ng-template>

    </daf-data-table>
  `,
})
export class MissionsTableSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<Mission[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);
  readonly emptyMessage = input('');
  readonly allowCancel  = input(true);

  readonly open = output<number>();
  readonly act  = output<{ mission: Mission; action: MissionCardAction }>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'employee',    label: t('MISSIONS.LIST.COL_EMPLOYEE'), type: 'avatar' },
      { key: 'destination', label: t('MISSIONS.LIST.COL_DESTINATION') },
      { key: 'period',      label: t('MISSIONS.LIST.COL_PERIOD') },
      { key: 'status',      label: t('MISSIONS.LIST.COL_STATUS'), type: 'badge' },
      { key: 'cost',        label: t('BILLETERIE.COL_TOTAL'), align: 'right' },
      { key: '_actions',    label: '', align: 'right', width: '1%' },
    ];
  });

  /** Dates and amounts follow the UI language, not a hard-wired fr-FR. */
  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const loc = this.locale();
    return this.items().map(m => ({
      // §6b rule 6: identity is one avatar column carrying the secondary line, never a
      // name and its subject split across two columns.
      employee: {
        name: m.employeeName ?? '—',
        initials: initialsOf(m.employeeName),
        subtitle: m.title,
      },
      destination: destination(m),
      period: `${localeDate(m.startDate, loc)} → ${localeDate(m.endDate, loc)}`,
      late: isLate(m),
      lateDays: Math.abs(daysUntil(m.startDate)),
      status: {
        label: this.translate.instant(statusKey(m.status)),
        options: { variant: statusVariant(m.status), size: 'sm', dot: true },
      } satisfies BadgeCell,
      cost: formatAmount(m.expenses?.totalEstimatedCost ?? null, m.expenses?.currency ?? null, loc),
      _source: m,
    }));
  });

  protected readonly config = computed<TableConfig>(() => ({
    showHeader: false,          // the page-header is the only h1 (§6b rule 2)
    hoverable: true,
    loading: this.loading(),
    skeletonRows: Math.min(this.skeletonRows(), 20),
    emptyMessage: this.emptyMessage(),
  }));
}
