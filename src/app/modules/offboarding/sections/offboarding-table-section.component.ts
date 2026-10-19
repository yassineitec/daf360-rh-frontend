import { DepartureReasonLabelService } from '../departure-reason-labels.service';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, untracked, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import {
  DEPARTURE_REASONS, OffboardingStatus, OffboardingWorkflowInstance,
} from '../models/offboarding.model';
import { employeeAvatar } from '../../../shared/utils/avatar.utils';
import {
  initialsOf, isOverdue, localeDate, stageProgressOf, statusVariant,
} from '../offboarding-display';

/** Header sort as the page holds it — `null` = the list's natural order. */
export interface OffboardingSort {
  key: string;
  dir: 'asc' | 'desc';
}

/** Workflow order of a departure file, for the "Statut" sort — not the translated label. */
const STATUS_ORDER: OffboardingStatus[] = [
  'PENDING', 'IN_PROGRESS', 'BLOCKED', 'VALIDATED', 'CANCELLED', 'ARCHIVED',
];

/** Position in a fixed order; an unknown code is "no value" (sorted last), never -1. */
function rank<T>(order: readonly T[], value: T): number | null {
  const i = order.indexOf(value);
  return i < 0 ? null : i;
}

/** What each table column sorts on — keyed by the table's column keys. */
const SORT_VALUE: Record<string, (wf: OffboardingWorkflowInstance) => string | number | null> = {
  employee:       wf => wf.employeeFullName || null,
  // The reasons' declared order (the sidebar's), not their translated labels.
  reason:         wf => rank(DEPARTURE_REASONS, wf.departureReason),
  // How far the file has gone: the active step, 1 … 7.
  stage:          wf => stageProgressOf(wf).step,
  status:         wf => rank(STATUS_ORDER, wf.status),
  lastWorkingDay: wf => wf.lastWorkingDay?.slice(0, 10) || null, // ISO: string order = date order
};

/**
 * Sorts the whole filtered list — /rh/offboarding (and its per-reason sub-pages) calls it
 * before slicing a page, since the table is `manualSort`. Missing values sort last in
 * both directions, like the library's own comparator.
 */
export function sortOffboarding(
  items: OffboardingWorkflowInstance[], sort: OffboardingSort | null,
): OffboardingWorkflowInstance[] {
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
 * List view of `/rh/offboarding`, on the same shape as the candidates list
 * (`rh-candidates-table-section`): employee avatar cell, a couple of data columns, a
 * dotted status badge and icon-only row actions. No wrapper, no outer card,
 * `showHeader: false` — the page's `daf-page-header` is the only h1 (§6b).
 *
 * It used to carry eight columns including separate SLA and progress-bar columns, which
 * made it read nothing like the candidates list. The progress bar is gone: "Informatique
 * & Matériel · étape 4/7" says the same thing AND says where the file is stuck, and the
 * SLA / overdue warning folds into that cell instead of owning a column.
 *
 * Library table tools are on, same as /rh/it-provisioning: sortable headers, resizable
 * columns and rows, the column picker and the reset icon. **Sorting is `manualSort`**: the
 * rows are one client-paginated page, so a local sort would reorder just that page (§10b).
 * The header only emits `sortChange`; the page sorts the whole filtered list
 * (`sortOffboarding`) before slicing it, and `sort` feeds back in as `defaultSort` so the
 * arrow survives a view switch. Reset only emits `resetClick`, so the page's sort clears on it.
 *
 * The row action is `config.actions`, not a projected `_actions` column: under
 * `resizableColumns` (fixed layout) the lib sizes its own actions column, whereas a
 * `width: '1%'` cell collapses to a few pixels — and would be listed, unnamed, in the
 * column picker.
 */
@Component({
  selector: 'rh-offboarding-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="open.emit($any($event)['_source'].id)"
      (sortChange)="sortChange.emit($event.dir ? { key: $event.key, dir: $event.dir } : null)"
      (resetClick)="sortChange.emit(null)">

      <!-- Where the file stands, plus the lateness signal. The step count carries the
           progress the removed progress-bar column used to show. -->
      <ng-template dafCell="stage" let-row>
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-body-lg shrink-0"
                [class.text-danger]="row['stage'].blocked"
                [class.text-primary]="!row['stage'].blocked">{{ row['stage'].icon }}</span>
          <span class="min-w-0">
            <span class="block text-body-sm font-medium text-on-surface truncate">
              {{ row['stage'].titleKey | translate }}
            </span>
            <span class="block text-[11px] text-outline">
              {{ 'OFFBOARDING.LIST.STEP_OF' | translate:{ step: row['stage'].step, total: row['stage'].total } }}
            </span>
          </span>
          @if (row['slaBreached']) {
            <span class="material-symbols-outlined text-body-lg text-danger shrink-0"
                  [title]="'OFFBOARDING.BADGE.SLA_BREACHED' | translate">warning</span>
          } @else if (row['overdue']) {
            <span class="material-symbols-outlined text-body-lg text-warning shrink-0"
                  [title]="'OFFBOARDING.BADGE.OVERDUE' | translate">schedule</span>
          }
        </div>
      </ng-template>

    </daf-data-table>
  `,
})
export class OffboardingTableSectionComponent {
  private translate = inject(TranslateService);
  protected readonly reasons = inject(DepartureReasonLabelService);

  /** The rendered table — the page hands it to `daf-search-toolbar` so the reset + column
   *  picker sit right of Filtres instead of above the card. */
  readonly table = viewChild(DataTableComponent);

  readonly items        = input.required<OffboardingWorkflowInstance[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);
  readonly emptyMessage = input('');
  /** The page's current sort — seeds the header arrow when the table (re)mounts. */
  readonly sort         = input<OffboardingSort | null>(null);

  readonly open       = output<number>();
  readonly sortChange = output<OffboardingSort | null>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // `manualSort`: no sortAccessor here — the page sorts (`sortOffboarding`).
    return [
      { key: 'employee',       label: t('OFFBOARDING.LIST.COL_EMPLOYEE'), type: 'avatar', sortable: true },
      { key: 'reason',         label: t('OFFBOARDING.LIST.COL_REASON'), sortable: true },
      { key: 'stage',          label: t('OFFBOARDING.LIST.COL_STAGE'), sortable: true },
      { key: 'status',         label: t('OFFBOARDING.LIST.COL_STATUS'), type: 'badge', sortable: true },
      { key: 'lastWorkingDay', label: t('OFFBOARDING.LIST.COL_LAST_DAY'), sortable: true },
    ];
  });

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const t = (k: string, p?: object) => this.translate.instant(k, p);
    const locale = this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';

    return this.items().map(item => ({
      employee: {
        name:     item.employeeFullName ?? t('OFFBOARDING.LIST.PROFILE_PREFIX', { id: item.employeeProfileId }),
        // Photo → gendered avatar → initials. `avatar` must be undefined for the cell to
        // fall back to `initials`, so an unknown gender does NOT resolve to male.png.
        avatar:   this.avatarFor(item),
        initials: initialsOf(item.employeeFullName),
        subtitle: item.handoverManagerName ?? undefined,
      },
      reason:         this.reasons.label(item.departureReason),
      stage:          stageProgressOf(item),
      status:         {
        label:   t('OFFBOARDING.STATUS.' + item.status),
        options: { variant: statusVariant(item.status), size: 'sm', dot: true },
      } as BadgeCell,
      lastWorkingDay: localeDate(item.lastWorkingDay, locale),
      slaBreached:    item.slaBreachFlag,
      overdue:        isOverdue(item),
      _source:        item,
    }));
  });

  /** photo → gendered avatar → undefined (initials). One rule, shared app-wide. */
  private avatarFor(item: OffboardingWorkflowInstance): string | undefined {
    return employeeAvatar(item.employeeProfileId, item.employeePhotoUrl, item.employeeGender);
  }

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    const wf = (row: TableRow) => row['_source'] as OffboardingWorkflowInstance;
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: this.emptyMessage(),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId:        (row) => wf(row).id,
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
        { id: 'open', icon: 'visibility', tooltip: t('OFFBOARDING.LIST.OPEN'),
          onClick: (row) => this.open.emit(wf(row).id) },
      ],
    };
  });
}
