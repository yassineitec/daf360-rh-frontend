import { ChangeDetectionStrategy, Component, computed, inject, input, output, untracked, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, StatusBadgeComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { statusBadge } from '../../../shared/status-badge.utils';
import { OnboardingListItem } from '../onboarding.model';
import { initialsOf, isoDate, lastUpdated } from '../onboarding-display';
import { avatarUrl } from '../../../shared/utils/avatar.utils';

/** Header sort as the page holds it — `null` = the list's natural order. */
export interface OnboardingSort {
  key: string;
  dir: 'asc' | 'desc';
}

/**
 * List view of `/rh/onboarding`, on the §6b table house style: no wrapper,
 * `showHeader: false`, `emptyMessage`, icon-only row actions from `config.actions`.
 *
 * The `status` column keeps a projected cell because it can show **two** badges
 * (the candidate status plus "Brouillon"); `itStatus` is a plain `type: 'badge'`
 * column, which the lib renders itself.
 *
 * Library table tools are on, same as /rh/it-provisioning: sortable headers, resizable
 * columns and rows, the column picker and the reset icon. **Sorting is `manualSort`**: the
 * rows handed in are one *page* of the filtered set, so a local sort would only reorder the
 * visible page (§10b). The header just emits `sortChange` and the page sorts the whole
 * filtered list before slicing it — `sort` feeds back in as `defaultSort` so the arrow
 * survives a grid ↔ list round trip. Reset only emits `resetClick`, so the page's sort is
 * cleared on it too.
 *
 * The row action is a library `config.actions` entry, not a projected `_actions` column:
 * under `resizableColumns` (fixed layout) the lib sizes its own actions column, whereas a
 * `width: '1%'` cell collapses to a few pixels — and it would show up, unnamed, in the
 * column picker.
 */
@Component({
  selector: 'rh-onboarding-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DafCellDirective, StatusBadgeComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="open.emit($any($event)['_source'].candidateId)"
      (sortChange)="sortChange.emit($event.dir ? { key: $event.key, dir: $event.dir } : null)"
      (resetClick)="sortChange.emit(null)">

      <ng-template dafCell="ms365Email" let-row>
        @if (row['ms365Email']) {
          <span class="text-body-md text-on-surface">{{ row['ms365Email'] }}</span>
        } @else {
          <span class="text-body-sm italic text-outline">—</span>
        }
      </ng-template>

      <ng-template dafCell="status" let-row>
        <div class="flex flex-wrap items-center gap-1.5">
          <daf-badge [label]="row['status'].label" [options]="row['status'].options" />
          @if (row['hasDraft']) {
            <daf-badge [label]="'ONBOARDING.LIST.BADGE_DRAFT' | translate"
                       [options]="{ variant: 'warning', size: 'sm', dot: true }" />
          }
        </div>
      </ng-template>

    </daf-data-table>
  `,
})
export class OnboardingTableSectionComponent {
  private translate = inject(TranslateService);

  /** The rendered table — the page hands it to `daf-search-toolbar` so the reset + column
   *  picker sit right of Filtres instead of above the card. */
  readonly table = viewChild(DataTableComponent);

  readonly items        = input.required<OnboardingListItem[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);
  /** The page's current sort — seeds the header arrow when the table (re)mounts. */
  readonly sort         = input<OnboardingSort | null>(null);

  readonly open       = output<number>();
  readonly sortChange = output<OnboardingSort | null>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // `manualSort`: no sortAccessor here — the page sorts (`sortOnboarding`).
    return [
      { key: 'employe',           label: t('ONBOARDING.LIST.COL_EMPLOYEE'), type: 'avatar', sortable: true },
      { key: 'ms365Email',        label: t('ONBOARDING.LIST.COL_EMAIL'), sortable: true },
      { key: 'itStatus',          label: t('ONBOARDING.LIST.COL_IT_STATUS'), type: 'badge', sortable: true },
      { key: 'expectedStartDate', label: t('ONBOARDING.LIST.COL_START'), sortable: true },
      { key: 'status',            label: t('ONBOARDING.LIST.COL_STATUS'), sortable: true },
      { key: 'maj',               label: t('ONBOARDING.LIST.COL_UPDATED'), sortable: true },
    ];
  });

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.items().map(item => ({
      employe: {
        name:     item.candidateFullName,
        // Same rule as the card view: the shared gendered avatar PNG (the cell prefers
        // `avatar` and only falls back to `initials`).
        avatar:   avatarUrl(item.gender),
        initials: initialsOf(item.candidateFullName),
        subtitle: item.appliedPosition ?? '',
      },
      ms365Email:        item.ms365Email,
      itStatus:          this.badge('IT_PROVISIONING.STATUS.', item.itProvisioningStatus),
      expectedStartDate: isoDate(item.expectedStartDate),
      status:            this.badge('CANDIDATES.STATUS.', item.candidateStatus),
      hasDraft:          item.hasDraft,
      maj:               lastUpdated(item),
      _source:           item,
    }));
  });

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: t('ONBOARDING.LIST.EMPTY_TITLE'),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId:        (row) => (row['_source'] as OnboardingListItem).candidateId,
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
        { id: 'complete', icon: 'edit_note', tooltip: t('ONBOARDING.LIST.COMPLETE'),
          onClick: (row) => this.open.emit((row['_source'] as OnboardingListItem).candidateId) },
      ],
    };
  });

  /**
   * Translated label + the shared badge variant. The variant map is shared with
   * every other page so one status can't be badged two ways; only its *label*
   * comes from i18n rather than the map's hardcoded French.
   */
  private badge(prefix: string, status: string): BadgeCell {
    return {
      label:   this.translate.instant(prefix + status),
      options: { ...statusBadge(status).options, size: 'sm', dot: true },
    };
  }
}
