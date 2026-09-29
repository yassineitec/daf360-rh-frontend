import { ChangeDetectionStrategy, Component, computed, inject, input, output, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { Mission } from '../../missions/mission.model';
import {
  daysUntil, destination, formatAmount, initialsOf, isLate, localeDate, localeOf,
} from '../../missions/mission-display';
import { BilleterieAction } from './billeterie-cards-section.component';

/** Header sort as the page holds it — `null` = the queue's natural order. */
export interface BilleterieSort {
  key: string;
  dir: 'asc' | 'desc';
}

/** What each table column sorts on — keyed by the table's column keys. */
const SORT_VALUE: Record<string, (m: Mission) => string | number | null> = {
  employee:    m => m.employeeName || null,
  destination: m => destination(m) || null,
  period:      m => m.startDate?.slice(0, 10) || null, // ISO: string order = date order
  // Not priced first on an ascending sort: those are the ones still to work on.
  priced:      m => (m.expenses ? 1 : 0),
  total:       m => m.expenses?.totalEstimatedCost ?? null,
};

/**
 * Sorts the whole filtered queue — the page calls it before slicing a page, since the
 * table is `manualSort`. Missing values sort last in both directions, like the library.
 */
export function sortBilleterie(items: Mission[], sort: BilleterieSort | null): Mission[] {
  const value = sort && SORT_VALUE[sort.key];
  if (!sort || !value) return items;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = value(a), vb = value(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
    return cmp * sign;
  });
}

/**
 * List view of the billeterie queue, on the §6b house table style.
 *
 * The pricing state is a badge column rather than the mission status: every row here is
 * PENDING_HR, so the useful distinction is priced / not priced — it is what decides
 * whether the row can be validated at all.
 *
 * No `rowClick`: every action here is a decision, so a row click would be ambiguous (§6b).
 *
 * Library table tools are on, same as the other RH tables. **Sorting is `manualSort`**: the
 * rows are one client-side page of the queue, so the header only emits `sortChange` and the
 * page sorts the whole filtered queue (`sortBilleterie`) before slicing it; `sort` feeds back
 * in as `defaultSort`. The actions are `config.actions` (per-row `disabled` for "Valider"),
 * no longer a projected `_actions` cell, which fixed layout would squeeze to a few pixels.
 */
@Component({
  selector: 'rh-billeterie-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-data-table [columns]="columns()" [rows]="rows()" [config]="config()"
      (sortChange)="sortChange.emit($event.dir ? { key: $event.key, dir: $event.dir } : null)"
      (resetClick)="sortChange.emit(null)">

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

    </daf-data-table>
  `,
})
export class BilleterieTableSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<Mission[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);
  readonly emptyMessage = input('');
  /** The page's current sort — seeds the header arrow when the table (re)mounts. */
  readonly sort         = input<BilleterieSort | null>(null);

  readonly act        = output<{ mission: Mission; action: BilleterieAction }>();
  readonly sortChange = output<BilleterieSort | null>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // `manualSort`: no sortAccessor here — the page sorts (`sortBilleterie`).
    return [
      { key: 'employee',    label: t('MISSIONS.LIST.COL_EMPLOYEE'), type: 'avatar', sortable: true },
      { key: 'destination', label: t('MISSIONS.LIST.COL_DESTINATION'), sortable: true },
      { key: 'period',      label: t('MISSIONS.LIST.COL_PERIOD'), sortable: true },
      { key: 'priced',      label: t('BILLETERIE.COL_STATE'), type: 'badge', sortable: true },
      { key: 'total',       label: t('BILLETERIE.COL_TOTAL'), align: 'right', sortable: true },
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

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const mission = (row: TableRow) => row['_source'] as Mission;
    const emit = (row: TableRow, action: BilleterieAction) => this.act.emit({ mission: mission(row), action });
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader: false,
      hoverable: false,
      loading: this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: this.emptyMessage(),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId: (row) => mission(row).id,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        t('REQUESTS.TABLE.RESET'),
      sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
      manualSort:        true,
      ...(sort ? { defaultSort: sort } : {}),
      actions: [
        { id: 'view', icon: 'visibility', tooltip: t('MISSIONS.LIST.VIEW'),
          onClick: (row) => emit(row, 'view') },
        { id: 'price', icon: 'receipt_long', tooltip: t('BILLETERIE.PRICE'),
          onClick: (row) => emit(row, 'price') },
        // No expense sheet yet → nothing to validate.
        { id: 'validate', icon: 'check_circle', tooltip: t('BILLETERIE.VALIDATE'),
          disabled: (row) => !mission(row).expenses,
          onClick: (row) => emit(row, 'validate') },
        { id: 'reject', icon: 'block', variant: 'danger', tooltip: t('BILLETERIE.REJECT'),
          onClick: (row) => emit(row, 'reject') },
      ],
    };
  });
}
