import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, ProgressBarComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
import { statusBadge } from '../../../shared/status-badge.utils';
import { ProvisioningListItem } from '../it-provisioning.model';
import {
  HARDWARE_SLOTS, LICENCE_SLOTS, hardwareComplete, initialsOf, isOverdue,
  licCount, licencesComplete, overdueDays,
} from '../it-provisioning-display';

/**
 * List view of `/rh/it-provisioning`, on the §6b table house style: no wrapper,
 * `showHeader: false`, `emptyMessage`, icon-only row actions.
 *
 * The hardware/licence `daf-progress-bar`s live here rather than on the cards
 * because a table can project a cell and `daf-entity-card` has no content slot.
 *
 * **No column is `sortable`.** The rows handed in are one *page* of the filtered
 * set, and `daf-data-table` sorts client-side — so the arrows would silently
 * reorder just the visible page (§10b). `candidat` used to carry `sortable: true`.
 */
@Component({
  selector: 'rh-it-provisioning-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent, DafCellDirective, ProgressBarComponent,
    TableActionComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="open.emit($any($event)['_source'].id)">

      <ng-template dafCell="ms365Email" let-row>
        @if (row['ms365Email']) {
          <span class="text-body-md text-on-surface">{{ row['ms365Email'] }}</span>
        } @else {
          <span class="text-body-sm italic text-outline">
            {{ 'IT_PROVISIONING.LIST.EMAIL_PENDING_TABLE' | translate }}
          </span>
        }
      </ng-template>

      <ng-template dafCell="expectedStartDate" let-row>
        <p class="text-body-md text-on-surface">{{ row['expectedStartDate'] ?? '—' }}</p>
        @if (row['overdue']) {
          <p class="flex items-center gap-1 text-body-sm font-bold text-danger">
            <span class="material-symbols-outlined text-body-lg">error</span>
            {{ 'IT_PROVISIONING.LIST.OVERDUE_DAYS' | translate:{ days: row['overdueDays'] } }}
          </p>
        }
      </ng-template>

      <ng-template dafCell="hwLabel" let-row>
        <div class="w-24">
          <daf-progress-bar
            [label]="row['hwLabel']"
            [value]="row['hwCount']"
            [options]="{ max: hardwareSlots, size: 'xs', variant: row['hwDone'] ? 'tertiary' : 'primary', showPercent: false }" />
        </div>
      </ng-template>

      <ng-template dafCell="licLabel" let-row>
        <div class="w-24">
          <daf-progress-bar
            [label]="row['licLabel']"
            [value]="row['licCount']"
            [options]="{ max: licenceSlots, size: 'xs', variant: row['licDone'] ? 'tertiary' : 'secondary', showPercent: false }" />
        </div>
      </ng-template>

      <ng-template dafCell="_actions" let-row>
        <div class="flex items-center justify-end gap-2">
          <rh-table-action
            [icon]="row['isCompleted'] ? 'visibility' : 'edit_note'"
            [tooltip]="(row['isCompleted'] ? 'IT_PROVISIONING.LIST.VIEW' : 'IT_PROVISIONING.LIST.COMPLETE') | translate"
            (action)="open.emit(row['_source'].id)" />
        </div>
      </ng-template>

    </daf-data-table>
  `,
})
export class ItProvisioningTableSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<ProvisioningListItem[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);

  readonly open = output<number>();

  protected readonly hardwareSlots = HARDWARE_SLOTS;
  protected readonly licenceSlots  = LICENCE_SLOTS;

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'candidat',          label: t('IT_PROVISIONING.LIST.COL_CANDIDATE'), type: 'avatar' },
      { key: 'ms365Email',        label: t('IT_PROVISIONING.LIST.COL_EMAIL') },
      { key: 'status',            label: t('IT_PROVISIONING.LIST.COL_STATUS'), type: 'badge' },
      { key: 'expectedStartDate', label: t('IT_PROVISIONING.LIST.COL_START') },
      { key: 'hwLabel',           label: t('IT_PROVISIONING.LIST.COL_HARDWARE') },
      { key: 'licLabel',          label: t('IT_PROVISIONING.LIST.COL_LICENSES') },
      { key: '_actions',          label: '', align: 'right', width: '1%' },
    ];
  });

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.items().map(item => ({
      candidat: {
        name:     item.candidateFullName,
        initials: initialsOf(item.candidateFullName),
        subtitle: item.appliedPosition ?? '',
      },
      ms365Email:        item.ms365Email,
      status:            this.statusCell(item.status),
      expectedStartDate: item.expectedStartDate,
      overdue:           isOverdue(item),
      overdueDays:       overdueDays(item),
      hwCount:           item.assetsProvided ?? 0,
      hwDone:            hardwareComplete(item),
      hwLabel:           `${item.assetsProvided ?? 0}/${HARDWARE_SLOTS}`,
      licCount:          licCount(item),
      licDone:           licencesComplete(item),
      licLabel:          `${licCount(item)}/${LICENCE_SLOTS}`,
      isCompleted:       item.status === 'COMPLETED',
      _source:           item,
    }));
  });

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: this.translate.instant('IT_PROVISIONING.LIST.TABLE_EMPTY'),
    };
  });

  /** Status badges carry a dot everywhere in the app (§6b). */
  private statusCell(status: string): BadgeCell {
    const badge = statusBadge(status);
    return {
      label:   this.translate.instant('IT_PROVISIONING.STATUS.' + status),
      options: { ...badge.options, size: 'sm', dot: true },
    };
  }
}
