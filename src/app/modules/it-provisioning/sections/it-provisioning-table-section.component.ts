import { ChangeDetectionStrategy, Component, computed, inject, input, output, untracked, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, ProgressBarComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { statusBadge } from '../../../shared/status-badge.utils';
import { ProvisioningListItem } from '../it-provisioning.model';
import {
  HARDWARE_SLOTS, LICENCE_SLOTS, hardwareComplete, initialsOf, isOverdue,
  licCount, licencesComplete, overdueDays,
} from '../it-provisioning-display';

/** Header sort as the page holds it — `null` = the list's natural order. */
export interface ProvisioningSort {
  key: string;
  dir: 'asc' | 'desc';
}

/**
 * List view of `/rh/it-provisioning`, on the §6b table house style: no wrapper,
 * `showHeader: false`, `emptyMessage`, icon-only row actions from `config.actions`.
 *
 * The hardware/licence `daf-progress-bar`s live here rather than on the cards
 * because a table can project a cell and `daf-entity-card` has no content slot.
 *
 * Library table tools are on: sortable headers, resizable columns and rows, the
 * column picker and the reset icon. **Sorting is `manualSort`**: the rows handed in
 * are one *page* of the filtered set, so a local sort would only reorder the visible
 * page (§10b). The header just emits `sortChange` and the page sorts the whole
 * filtered list before slicing it — `sort` feeds back in as `defaultSort` so the
 * arrow survives a grid ↔ list round trip. Reset clears widths/heights/columns/sort
 * inside the table but only emits `resetClick`, so the page's sort is cleared on it.
 */
@Component({
  selector: 'rh-it-provisioning-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective, ProgressBarComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="open.emit($any($event)['_source'].id)"
      (sortChange)="sortChange.emit($event.dir ? { key: $event.key, dir: $event.dir } : null)"
      (resetClick)="sortChange.emit(null)">

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

    </daf-data-table>
  `,
})
export class ItProvisioningTableSectionComponent {
  private translate = inject(TranslateService);

  /** The rendered table — the page hands it to `daf-search-toolbar` so the reset + column
   *  picker sit right of Filtres instead of above the card. */
  readonly table = viewChild(DataTableComponent);

  readonly items        = input.required<ProvisioningListItem[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);
  /** The page's current sort — seeds the header arrow when the table (re)mounts. */
  readonly sort         = input<ProvisioningSort | null>(null);

  readonly open       = output<number>();
  readonly sortChange = output<ProvisioningSort | null>();

  protected readonly hardwareSlots = HARDWARE_SLOTS;
  protected readonly licenceSlots  = LICENCE_SLOTS;

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // `manualSort`: no sortAccessor here — the page sorts (`sortProvisioning`).
    return [
      { key: 'candidat',          label: t('IT_PROVISIONING.LIST.COL_CANDIDATE'), type: 'avatar', sortable: true },
      { key: 'ms365Email',        label: t('IT_PROVISIONING.LIST.COL_EMAIL'), sortable: true },
      { key: 'status',            label: t('IT_PROVISIONING.LIST.COL_STATUS'), type: 'badge', sortable: true },
      { key: 'expectedStartDate', label: t('IT_PROVISIONING.LIST.COL_START'), sortable: true },
      { key: 'hwLabel',           label: t('IT_PROVISIONING.LIST.COL_HARDWARE'), sortable: true },
      { key: 'licLabel',          label: t('IT_PROVISIONING.LIST.COL_LICENSES'), sortable: true },
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
    const t = (k: string) => this.translate.instant(k);
    const done = (row: TableRow) => row['isCompleted'] === true;
    const openRow = (row: TableRow) => this.open.emit((row['_source'] as ProvisioningListItem).id);
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: t('IT_PROVISIONING.LIST.TABLE_EMPTY'),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId:        (row) => (row['_source'] as ProvisioningListItem).id,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        t('REQUESTS.TABLE.RESET'),
      sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
      manualSort:        true,
      ...(sort ? { defaultSort: sort } : {}),
      // Exactly one per row: view a completed file, complete an open one.
      actions: [
        { id: 'view',     icon: 'visibility', tooltip: t('IT_PROVISIONING.LIST.VIEW'),
          hidden: (row) => !done(row), onClick: openRow },
        { id: 'complete', icon: 'edit_note',  tooltip: t('IT_PROVISIONING.LIST.COMPLETE'),
          hidden: done, onClick: openRow },
      ],
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
