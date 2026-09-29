import { ChangeDetectionStrategy, Component, computed, inject, input, output, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, StatusBadgeComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { Mission, MissionStatus } from '../mission.model';
import {
  daysUntil, destination, formatAmount, initialsOf, isLate, localeDate, localeOf,
  statusKey, statusVariant,
} from '../mission-display';
import { MissionCardAction } from './missions-cards-section.component';

/** Header sort as the page holds it — `null` = the list's natural order. */
export interface MissionSort {
  key: string;
  dir: 'asc' | 'desc';
}

/** Workflow order of a mission, for the "Statut" sort — not the translated label. */
const STATUS_ORDER: MissionStatus[] = [
  'PENDING_HR', 'PENDING_FINANCE', 'APPROVED', 'REJECTED_HR', 'REJECTED_FINANCE', 'CANCELLED',
];

/** What each table column sorts on — keyed by the table's column keys. */
const SORT_VALUE: Record<string, (m: Mission) => string | number | null> = {
  employee:    m => m.employeeName || null,
  destination: m => destination(m) || null,
  period:      m => m.startDate?.slice(0, 10) || null, // ISO: string order = date order
  status:      m => STATUS_ORDER.indexOf(m.status),
  // Raw amount, currency ignored: missions are priced in one currency per entity.
  cost:        m => m.expenses?.totalEstimatedCost ?? null,
};

/**
 * Sorts the whole filtered list — both mission pages call it before slicing a page,
 * since the table is `manualSort`. Missing values sort last in both directions, like
 * the library's own comparator.
 */
export function sortMissions(items: Mission[], sort: MissionSort | null): Mission[] {
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
 * List view of `/rh/missions` and `/rh/missions/historique`, on the §6b house table
 * style: no wrapper, `showHeader: false`, `emptyMessage`, icon-only trailing actions
 * from `config.actions`.
 *
 * It carries what the cards cannot: the two-line period cell and its lateness warning,
 * and the "modification demandée" flag next to the status — a table can project a cell,
 * `daf-entity-card` has no content slot.
 *
 * Library table tools are on, same as /rh/it-provisioning: sortable headers, resizable
 * columns and rows, the column picker and the reset icon. **Sorting is `manualSort`**: the
 * rows handed in are one *page* of the filtered set, so a local sort would only reorder the
 * visible page (§10b). The header just emits `sortChange` and the page sorts the whole
 * filtered list (`sortMissions`) before slicing it — `sort` feeds back in as `defaultSort`
 * so the arrow survives a grid ↔ list round trip. Reset only emits `resetClick`, so the
 * page's sort is cleared on it too.
 *
 * The row actions are `config.actions`, not a projected `_actions` column: under
 * `resizableColumns` (fixed layout) the lib sizes its own actions column, whereas a
 * `width: '1%'` cell collapses to a few pixels — and would be listed, unnamed, in the
 * column picker.
 */
@Component({
  selector: 'rh-missions-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective, StatusBadgeComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="open.emit($any($event)['_source'].id)"
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
  /** The page's current sort — seeds the header arrow when the table (re)mounts. */
  readonly sort         = input<MissionSort | null>(null);

  readonly open       = output<number>();
  readonly act        = output<{ mission: Mission; action: MissionCardAction }>();
  readonly sortChange = output<MissionSort | null>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // `manualSort`: no sortAccessor here — the page sorts (`sortMissions`).
    return [
      { key: 'employee',    label: t('MISSIONS.LIST.COL_EMPLOYEE'), type: 'avatar', sortable: true },
      { key: 'destination', label: t('MISSIONS.LIST.COL_DESTINATION'), sortable: true },
      { key: 'period',      label: t('MISSIONS.LIST.COL_PERIOD'), sortable: true },
      { key: 'status',      label: t('MISSIONS.LIST.COL_STATUS'), type: 'badge', sortable: true },
      { key: 'cost',        label: t('BILLETERIE.COL_TOTAL'), align: 'right', sortable: true },
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

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const mission = (row: TableRow) => row['_source'] as Mission;
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader: false,          // the page-header is the only h1 (§6b rule 2)
      hoverable: true,
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
          onClick: (row) => this.open.emit(mission(row).id) },
        // Cancelling is only offered on /rh/missions, and only before RH has decided.
        { id: 'cancel', icon: 'cancel', variant: 'danger', tooltip: t('MISSIONS.LIST.CANCEL'),
          hidden: (row) => !this.allowCancel() || mission(row).status !== 'PENDING_HR',
          onClick: (row) => this.act.emit({ mission: mission(row), action: 'cancel' }) },
      ],
    };
  });
}
