import { Component, computed, inject, input, output } from '@angular/core';
import {
  AvatarCell, BadgeCell, DafCellDirective, DataTableComponent,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeListItem } from '../models/profile.model';
import { getAvatarUrl, getInitials } from '../../../shared/utils/avatar.utils';
import { contractLabel, lifecycleLabel, lifecycleVariant } from '../profile-labels';

/**
 * Table view of the employee directory, on the library's `daf-data-table`.
 *
 * Replaces the hand-rolled `rh-profile-list-card` stack. Stateless like its card
 * sibling — the page owns selection, search, filters and paging, which is what
 * makes switching views lossless.
 *
 * The leading `select` column is a projected `dafCell` template: `daf-data-table`
 * has no built-in selection column, and the cell must stop propagation itself
 * because a non-`clickable` column lets the click bubble to the row.
 */
@Component({
  selector: 'rh-profiles-table-section',
  standalone: true,
  imports: [DataTableComponent, DafCellDirective],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      (rowClick)="onRowClick($event)">

      <!-- Selection checkbox. Native input rather than daf-checkbox: this is a
           bare 16px control in a dense cell with no label, hint or error row. -->
      <ng-template dafCell="select" let-row>
        <input
          type="checkbox"
          class="w-4 h-4 rounded cursor-pointer accent-[#3a6567] align-middle"
          [checked]="selectedIds().has(row['userId'])"
          [attr.aria-label]="row['selectLabel']"
          (click)="$event.stopPropagation()"
          (change)="onToggle(row, $any($event.target).checked)" />
      </ng-template>

    </daf-data-table>
  `,
})
export class ProfilesTableSectionComponent {
  private translate = inject(TranslateService);

  readonly employees   = input.required<EmployeeListItem[]>();
  readonly selectedIds = input.required<Set<number>>();
  readonly loading     = input<boolean>(false);
  readonly skeletonCount = input<number>(10);

  readonly viewProfile  = output<number | null>();
  readonly toggleSelect = output<{ userId: number; checked: boolean }>();
  readonly edit         = output<number>();
  readonly remove       = output<number>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // No column is marked `sortable`: daf-data-table sorts client-side, which with
    // a server-paginated list would silently reorder only the visible page. The
    // backend ignores Pageable's sort too (the SQL pins ORDER BY u.fullName), so
    // shipping the arrows would be a lie. Wire both ends before adding them.
    return [
      // Empty label: the select-all affordance now lives in daf-bulk-action-bar.
      { key: 'select',     label: '',                             width: '40px' },
      { key: 'employee',   label: t('PROFILES.TABLE.EMPLOYEE'),   type: 'avatar' },
      { key: 'grade',      label: t('PROFILES.TABLE.GRADE') },
      { key: 'department', label: t('PROFILES.TABLE.DEPARTMENT') },
      { key: 'pays',       label: t('PROFILES.TABLE.PAYS') },
      { key: 'contract',   label: t('PROFILES.TABLE.CONTRACT') },
      { key: 'status',     label: t('PROFILES.TABLE.STATUS'),     type: 'badge' },
      { key: 'hireDate',   label: t('PROFILES.TABLE.HIRE_DATE') },
    ];
  });

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonCount(), 20),
      emptyMessage: this.translate.instant('PROFILES.LIST.NO_EMPLOYEES'),
      actions: [
        {
          id: 'view',
          tooltip: this.translate.instant('PROFILES.CARD.VIEW_PROFILE'),
          onClick: (row: TableRow) => this.viewProfile.emit(row['profileId'] ?? null),
        },
        {
          id: 'edit',
          tooltip: this.translate.instant('PROFILES.TABLE.EDIT'),
          onClick: (row: TableRow) => {
            if (row['profileId'] != null) this.edit.emit(row['profileId']);
          },
        },
        {
          id: 'delete',
          variant: 'danger' as const,
          tooltip: this.translate.instant('PROFILES.BULK.DELETE'),
          onClick: (row: TableRow) => {
            if (row['profileId'] != null) this.remove.emit(row['profileId']);
          },
        },
      ],
    };
  });

  protected readonly rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.employees().map(emp => {
      const employee: AvatarCell = {
        name:     emp.fullName || '—',
        initials: getInitials(emp.fullName || '??'),
        avatar:   getAvatarUrl(emp.profileId, emp.photoUrl, emp.gender),
        subtitle: emp.email ?? undefined,
      };
      const status: BadgeCell = {
        label:   lifecycleLabel(emp.lifecycleStatus, this.translate),
        options: { variant: lifecycleVariant(emp.lifecycleStatus), dot: true },
      };
      return {
        // Carried for the row handlers, not rendered — no matching column.
        userId:      emp.userId,
        profileId:   emp.profileId,
        selectLabel: this.translate.instant('PROFILES.TABLE.SELECT_ROW', {
          name: emp.fullName || '—',
        }),
        employee,
        // roleName is the fallback the card view already uses when a row has no
        // HR profile yet, so grade is null.
        grade:      emp.grade ?? emp.roleName ?? '—',
        department: emp.department ?? '—',
        pays:       emp.paysLabel ?? '—',
        contract:   contractLabel(emp.contractType, this.translate),
        status,
        hireDate:   this.formatDate(emp.hireDate),
      } satisfies TableRow;
    });
  });

  /**
   * A row click toggles selection — it does NOT open the profile. The profile is
   * reached through the `view` action button, and `daf-data-table` already stops
   * propagation on its actions cell, so the two can't fire together.
   */
  protected onRowClick(row: TableRow): void {
    this.onToggle(row, !this.selectedIds().has(row['userId']));
  }

  protected onToggle(row: TableRow, checked: boolean): void {
    const userId = row['userId'];
    if (userId != null) this.toggleSelect.emit({ userId, checked });
  }

  private formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(this.translate.currentLang() || 'fr', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
