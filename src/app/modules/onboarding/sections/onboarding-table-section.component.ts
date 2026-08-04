import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent, StatusBadgeComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
import { statusBadge } from '../../../shared/status-badge.utils';
import { OnboardingListItem } from '../onboarding.model';
import { initialsOf, isoDate, lastUpdated } from '../onboarding-display';
import { avatarUrl } from '../../../shared/utils/avatar.utils';

/**
 * List view of `/rh/onboarding`, on the §6b table house style: no wrapper,
 * `showHeader: false`, `emptyMessage`, icon-only row actions.
 *
 * The `status` column keeps a projected cell because it can show **two** badges
 * (the candidate status plus "Brouillon"); `itStatus` is a plain `type: 'badge'`
 * column, which the lib renders itself.
 *
 * **No column is `sortable`.** The rows are one *page* of the filtered set and
 * `daf-data-table` sorts client-side, so the arrows would reorder just the
 * visible page (§10b).
 */
@Component({
  selector: 'rh-onboarding-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent, DafCellDirective, StatusBadgeComponent,
    TableActionComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="open.emit($any($event)['_source'].candidateId)">

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

      <ng-template dafCell="_actions" let-row>
        <div class="flex items-center justify-end gap-2">
          <rh-table-action
            icon="edit_note"
            [tooltip]="'ONBOARDING.LIST.COMPLETE' | translate"
            (action)="open.emit(row['_source'].candidateId)" />
        </div>
      </ng-template>

    </daf-data-table>
  `,
})
export class OnboardingTableSectionComponent {
  private translate = inject(TranslateService);

  readonly items        = input.required<OnboardingListItem[]>();
  readonly loading      = input(false);
  readonly skeletonRows = input(10);

  readonly open = output<number>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'employe',           label: t('ONBOARDING.LIST.COL_EMPLOYEE'), type: 'avatar' },
      { key: 'ms365Email',        label: t('ONBOARDING.LIST.COL_EMAIL') },
      { key: 'itStatus',          label: t('ONBOARDING.LIST.COL_IT_STATUS'), type: 'badge' },
      { key: 'expectedStartDate', label: t('ONBOARDING.LIST.COL_START') },
      { key: 'status',            label: t('ONBOARDING.LIST.COL_STATUS') },
      { key: 'maj',               label: t('ONBOARDING.LIST.COL_UPDATED') },
      { key: '_actions',          label: '', align: 'right', width: '1%' },
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
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonRows(), 20),
      emptyMessage: this.translate.instant('ONBOARDING.LIST.EMPTY_TITLE'),
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
