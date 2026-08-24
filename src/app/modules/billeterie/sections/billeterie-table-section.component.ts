import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
import { Mission } from '../../missions/mission.model';
import {
  daysUntil, destination, formatAmount, initialsOf, isLate, localeDate, localeOf,
} from '../../missions/mission-display';
import { BilleterieAction } from './billeterie-cards-section.component';

/**
 * List view of the billeterie queue, on the §6b house table style.
 *
 * The pricing state is a badge column rather than the mission status: every row here is
 * PENDING_HR, so the useful distinction is priced / not priced — it is what decides
 * whether the row can be validated at all.
 *
 * No `rowClick`: every action here is a decision, so a row click would be ambiguous (§6b).
 */
@Component({
  selector: 'rh-billeterie-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective, TableActionComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-data-table [columns]="columns()" [rows]="rows()" [config]="config()">

      <ng-template dafCell="period" let-row>
        <p class="text-body-md text-on-surface">{{ row['period'] }}</p>
        @if (row['late']) {
          <p class="flex items-center gap-1 text-body-sm font-bold text-danger">
            <span class="material-symbols-outlined text-body-lg">error</span>
            {{ 'MISSIONS.CARD.LATE_DAYS' | translate:{ days: row['lateDays'] } }}
          </p>
        } @else {
          <p class="text-body-sm text-outline">
            {{ 'MISSIONS.CARD.IN_DAYS' | translate:{ days: row['untilDays'] } }}
          </p>
        }
      </ng-template>

      <ng-template dafCell="total" let-row>
        @if (row['_source'].expenses) {
          <span class="text-body-md font-semibold text-on-surface">{{ row['total'] }}</span>
        } @else {
          <span class="text-body-sm italic text-outline">{{ 'BILLETERIE.NOT_PRICED' | translate }}</span>
        }
      </ng-template>

      <!-- Projected rather than config.actions: "Valider" is conditional on the sheet
           existing, and TableAction has no row predicate (§6b rule 4). -->
      <ng-template dafCell="_actions" let-row>
        <div class="flex items-center justify-end gap-2">
          <rh-table-action id="view"
            [tooltip]="'MISSIONS.LIST.VIEW' | translate"
            (action)="act.emit({ mission: row['_source'], action: 'view' })" />
          <rh-table-action id="edit" icon="receipt_long"
            [tooltip]="'BILLETERIE.PRICE' | translate"
            (action)="act.emit({ mission: row['_source'], action: 'price' })" />
          <rh-table-action id="approve" icon="check_circle"
            [tooltip]="'BILLETERIE.VALIDATE' | translate"
            [disabled]="!row['_source'].expenses"
            (action)="act.emit({ mission: row['_source'], action: 'validate' })" />
          <rh-table-action id="reject" icon="block" variant="danger"
            [tooltip]="'BILLETERIE.REJECT' | translate"
            (action)="act.emit({ mission: row['_source'], action: 'reject' })" />
        </div>
      </ng-template>

    </daf-data-table>
  `,
})
export class BilleterieTableSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<Mission[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);
  readonly emptyMessage = input('');

  readonly act = output<{ mission: Mission; action: BilleterieAction }>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'employee',    label: t('MISSIONS.LIST.COL_EMPLOYEE'), type: 'avatar' },
      { key: 'destination', label: t('MISSIONS.LIST.COL_DESTINATION') },
      { key: 'period',      label: t('MISSIONS.LIST.COL_PERIOD') },
      { key: 'priced',      label: t('BILLETERIE.COL_STATE'), type: 'badge' },
      { key: 'total',       label: t('BILLETERIE.COL_TOTAL'), align: 'right' },
      { key: '_actions',    label: '', align: 'right', width: '1%' },
    ];
  });

  /** Dates and amounts follow the UI language, not a hard-wired fr-FR. */
  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const loc = this.locale();
    return this.items().map(m => ({
      employee: {
        name: m.employeeName ?? '—',
        initials: initialsOf(m.employeeName),
        subtitle: m.title,
      },
      destination: destination(m),
      period: `${localeDate(m.startDate, loc)} → ${localeDate(m.endDate, loc)}`,
      late: isLate(m),
      lateDays: Math.abs(daysUntil(m.startDate)),
      untilDays: daysUntil(m.startDate),
      priced: {
        label: m.expenses ? t('BILLETERIE.PRICED') : t('BILLETERIE.NOT_PRICED'),
        options: { variant: m.expenses ? 'success' : 'warning', size: 'sm', dot: true },
      } satisfies BadgeCell,
      total: formatAmount(m.expenses?.totalEstimatedCost ?? null, m.expenses?.currency ?? null, loc),
      _source: m,
    }));
  });

  protected readonly config = computed<TableConfig>(() => ({
    showHeader: false,
    hoverable: false,
    loading: this.loading(),
    skeletonRows: Math.min(this.skeletonRows(), 20),
    emptyMessage: this.emptyMessage(),
  }));
}
