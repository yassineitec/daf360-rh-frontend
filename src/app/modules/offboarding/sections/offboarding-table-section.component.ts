import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, ProgressBarComponent, StatusBadgeComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
import { OffboardingWorkflowInstance } from '../models/offboarding.model';
import {
  hasTasks, initialsOf, isOverdue, localeDate, progressPct, statusVariant,
} from '../offboarding-display';

/**
 * List view of `/rh/offboarding`, on the §6b table house style: no wrapper, no
 * outer card, `showHeader: false`, `emptyMessage`, icon-only row actions.
 *
 * The employee column is now an `avatar` cell (it was plain text), the task
 * progress a `daf-progress-bar` in place of a hand-rolled `div` pair, and the SLA
 * column keeps a projected cell because it has three states rather than one badge.
 *
 * **No column is `sortable`** — the rows are one client-paginated page and
 * `daf-data-table` sorts client-side, so the arrows would reorder just that page (§10b).
 */
@Component({
  selector: 'rh-offboarding-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent, DafCellDirective, ProgressBarComponent, StatusBadgeComponent,
    TableActionComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="open.emit($any($event)['_source'].id)">

      <ng-template dafCell="sla" let-row>
        @if (row['slaBreached']) {
          <daf-badge [label]="'OFFBOARDING.BADGE.SLA_BREACHED' | translate"
                     [options]="{ variant: 'danger', size: 'sm', dot: true }" />
        } @else if (row['overdue']) {
          <daf-badge [label]="'OFFBOARDING.BADGE.OVERDUE' | translate"
                     [options]="{ variant: 'warning', size: 'sm', dot: true }" />
        } @else {
          <span class="text-body-sm text-outline">—</span>
        }
      </ng-template>

      <ng-template dafCell="progress" let-row>
        @if (row['hasTasks']) {
          <div class="w-24">
            <daf-progress-bar
              [label]="row['pct'] + '%'"
              [value]="row['pct']"
              [options]="{ max: 100, size: 'xs', variant: row['pct'] >= 100 ? 'tertiary' : 'primary', showPercent: false }" />
          </div>
        } @else {
          <span class="text-body-sm text-outline">—</span>
        }
      </ng-template>

      <ng-template dafCell="_actions" let-row>
        <div class="flex items-center justify-end gap-2">
          <rh-table-action
            id="view"
            [tooltip]="'OFFBOARDING.LIST.OPEN' | translate"
            (action)="open.emit(row['_source'].id)" />
        </div>
      </ng-template>

    </daf-data-table>
  `,
})
export class OffboardingTableSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<OffboardingWorkflowInstance[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);
  readonly emptyMessage = input('');

  readonly open = output<number>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'employee',       label: t('OFFBOARDING.LIST.COL_EMPLOYEE'), type: 'avatar' },
      { key: 'reason',         label: t('OFFBOARDING.LIST.COL_REASON') },
      { key: 'triggerDate',    label: t('OFFBOARDING.LIST.COL_TRIGGER') },
      { key: 'lastWorkingDay', label: t('OFFBOARDING.LIST.COL_LAST_DAY') },
      { key: 'status',         label: t('OFFBOARDING.LIST.COL_STATUS'), type: 'badge' },
      { key: 'sla',            label: t('OFFBOARDING.LIST.COL_SLA') },
      { key: 'progress',       label: t('OFFBOARDING.LIST.COL_PROGRESS') },
      { key: '_actions',       label: '', align: 'right', width: '1%' },
    ];
  });

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const t = (k: string, p?: object) => this.translate.instant(k, p);
    const locale = this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';

    return this.items().map(item => ({
      employee: {
        name:     item.employeeFullName ?? t('OFFBOARDING.LIST.PROFILE_PREFIX', { id: item.employeeProfileId }),
        initials: initialsOf(item.employeeFullName),
        subtitle: item.handoverManagerName ?? undefined,
      },
      reason:         t('OFFBOARDING.REASON.' + item.departureReason),
      triggerDate:    localeDate(item.triggerDate, locale),
      lastWorkingDay: localeDate(item.lastWorkingDay, locale),
      status:         {
        label:   t('OFFBOARDING.STATUS.' + item.status),
        options: { variant: statusVariant(item.status), size: 'sm', dot: true },
      } as BadgeCell,
      slaBreached:    item.slaBreachFlag,
      overdue:        isOverdue(item),
      pct:            progressPct(item),
      hasTasks:       hasTasks(item),
      _source:        item,
    }));
  });

  protected readonly config = computed<TableConfig>(() => ({
    showHeader:   false,          // the page's daf-page-header is the only h1
    hoverable:    true,
    loading:      this.loading(),
    skeletonRows: Math.min(this.skeletonRows(), 20),
    emptyMessage: this.emptyMessage(),
  }));
}
