import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeCell, DafCellDirective, DataTableComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { TableActionComponent } from '../../../shared/table-action.component';
import { OffboardingWorkflowInstance } from '../models/offboarding.model';
import { employeeAvatar } from '../../../shared/utils/avatar.utils';
import {
  initialsOf, isOverdue, localeDate, stageProgressOf, statusVariant,
} from '../offboarding-display';

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
 * **No column is `sortable`** — the rows are one client-paginated page and
 * `daf-data-table` sorts client-side, so the arrows would reorder just that page (§10b).
 */
@Component({
  selector: 'rh-offboarding-table-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent, DafCellDirective,
    TableActionComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="open.emit($any($event)['_source'].id)">

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
      { key: 'stage',          label: t('OFFBOARDING.LIST.COL_STAGE') },
      { key: 'status',         label: t('OFFBOARDING.LIST.COL_STATUS'), type: 'badge' },
      { key: 'lastWorkingDay', label: t('OFFBOARDING.LIST.COL_LAST_DAY') },
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
        // Photo → gendered avatar → initials. `avatar` must be undefined for the cell to
        // fall back to `initials`, so an unknown gender does NOT resolve to male.png.
        avatar:   this.avatarFor(item),
        initials: initialsOf(item.employeeFullName),
        subtitle: item.handoverManagerName ?? undefined,
      },
      reason:         t('OFFBOARDING.REASON.' + item.departureReason),
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

  protected readonly config = computed<TableConfig>(() => ({
    showHeader:   false,          // the page's daf-page-header is the only h1
    hoverable:    true,
    loading:      this.loading(),
    skeletonRows: Math.min(this.skeletonRows(), 20),
    emptyMessage: this.emptyMessage(),
  }));
}
