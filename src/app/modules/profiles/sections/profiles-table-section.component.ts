import { Component, computed, inject, input, output, viewChild } from '@angular/core';
import {
  AvatarCell, BadgeCell, DataTableComponent, SortDirection,
  TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeListItem } from '../models/profile.model';
import { getAvatarUrl, getInitials } from '../../../shared/utils/avatar.utils';
import { contractLabel, lifecycleLabel, lifecycleVariant } from '../profile-labels';

/**
 * Table column → backend sort key of `GET /api/hr/profiles/employees`. The backend only
 * accepts a whitelist (EmployeeProfileService.employeeOrderBy); `grade` sorts on the grade
 * itself, so rows that show their role instead (no HR profile yet) come last.
 */
const SERVER_SORT_FIELD: Record<string, string> = {
  employee:   'fullName',
  grade:      'grade',
  department: 'department',
  pays:       'pays',
  contract:   'contractType',
  status:     'lifecycleStatus',
  hireDate:   'hireDate',
};

/**
 * Table view of the employee directory, on the library's `daf-data-table`.
 *
 * Replaces the hand-rolled `rh-profile-list-card` stack. Stateless like its card
 * sibling — the page owns selection, search, filters and paging, which is what
 * makes switching views lossless.
 *
 * Selection is the library's own `selectable` column (keyed by `rowId` = userId), bound
 * to the page's `selectedIds`: the page stays the owner — it feeds the bulk bar and is
 * cleared on every new result set. It replaced a projected `select` column, which the
 * column picker would have listed with no name and fixed layout would have squeezed.
 *
 * Table tools are on, same as /rh/requests: sortable headers, resizable columns and rows,
 * the column picker and the reset icon. **Sorting is server-side (`manualSort`)**: the list
 * is server-paginated, so a header click emits `sortChange` with a Spring `sort` value
 * (see SERVER_SORT_FIELD) and the page re-fetches page 0 — the order spans every page.
 */
@Component({
  selector: 'rh-profiles-table-section',
  standalone: true,
  imports: [DataTableComponent],
  host: { class: 'block' },
  template: `
    <daf-data-table
      [columns]="columns()"
      [rows]="rows()"
      [config]="config()"
      [selected]="selectedKeys()"
      (selectedChange)="onSelectedChange($event)"
      (rowClick)="onRowClick($event)"
      (sortChange)="onSortChange($event.key, $event.dir)"
      (resetClick)="onSortChange('', null)" />
  `,
})
export class ProfilesTableSectionComponent {
  private translate = inject(TranslateService);

  /** The rendered table — the page hands it to `daf-search-toolbar` so the reset + column
   *  picker sit right of Filtres instead of above the card. */
  readonly table = viewChild(DataTableComponent);

  readonly employees   = input.required<EmployeeListItem[]>();
  readonly selectedIds = input.required<Set<number>>();
  readonly loading     = input<boolean>(false);
  readonly skeletonCount = input<number>(10);

  /** `HR_UPDATE_PROFILE` / `HR_CREATE_PROFILE`, resolved once by the page. */
  readonly canEdit          = input<boolean>(false);
  readonly canCreateProfile = input<boolean>(false);

  /** The whole row, not an id: a row with no `profileId` still routes, on its `userId`. */
  readonly viewProfile  = output<EmployeeListItem>();
  readonly toggleSelect = output<{ userId: number; checked: boolean }>();
  /** The whole selection after a checkbox, a header "select all" or a reset. */
  readonly selectionChange = output<number[]>();
  /** Spring `sort` value (`hireDate,desc`…) from a header click, or null when cleared. */
  readonly sortChange = output<string | null>();

  /** The page's Set<number> as the string keys the library selects by (`rowId`). */
  protected readonly selectedKeys = computed(() => [...this.selectedIds()].map(String));
  readonly edit         = output<EmployeeListItem>();

  protected readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // Every column sorts server-side (`manualSort`, see SERVER_SORT_FIELD): the list is
    // server-paginated, so a client-side sort would only reorder the visible page.
    return [
      { key: 'employee',   label: t('PROFILES.TABLE.EMPLOYEE'),   type: 'avatar', sortable: true },
      { key: 'grade',      label: t('PROFILES.TABLE.GRADE'),      sortable: true },
      { key: 'department', label: t('PROFILES.TABLE.DEPARTMENT'), sortable: true },
      { key: 'pays',       label: t('PROFILES.TABLE.PAYS'),       sortable: true },
      { key: 'contract',   label: t('PROFILES.TABLE.CONTRACT'),   sortable: true },
      { key: 'status',     label: t('PROFILES.TABLE.STATUS'),     type: 'badge', sortable: true },
      { key: 'hireDate',   label: t('PROFILES.TABLE.HIRE_DATE'),  sortable: true },
    ];
  });

  protected readonly config = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return {
      showHeader:   false,          // the page's daf-page-header is the only h1
      hoverable:    true,
      loading:      this.loading(),
      skeletonRows: Math.min(this.skeletonCount(), 20),
      emptyMessage: t('PROFILES.LIST.NO_EMPLOYEES'),
      // Stable row identity — selection, row heights and sorting are keyed by it.
      rowId:        (row: TableRow) => row['userId'],
      selectable:     true,
      selectAllLabel: t('PROFILES.BULK.SELECT_ALL'),
      selectRowLabel: t('PROFILES.TABLE.SELECT_ROW_LABEL'),
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        t('REQUESTS.TABLE.RESET'),
      sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
      // Rows are rendered in the order the server returned; sortChange still fires.
      manualSort:        true,
      // Both actions are conditional now — see the card view's canConsult/canModify for
      // the reasoning, which is the same on both surfaces.
      actions: [
        {
          id: 'view',
          // `person_add` for a row with no dossier: that button opens a creation form, and
          // the default eye would promise a record that does not exist.
          icon: 'visibility',
          tooltip: this.translate.instant('PROFILES.CARD.VIEW_PROFILE'),
          hidden: (row: TableRow) => row['profileId'] == null,
          onClick: (row: TableRow) => this.viewProfile.emit(row['employeeItem'] as EmployeeListItem),
        },
        {
          id: 'create',
          icon: 'person_add',
          tooltip: this.translate.instant('PROFILES.CARD.CREATE_PROFILE'),
          hidden: (row: TableRow) => row['profileId'] != null || !this.canCreateProfile(),
          onClick: (row: TableRow) => this.viewProfile.emit(row['employeeItem'] as EmployeeListItem),
        },
        {
          id: 'edit',
          tooltip: this.translate.instant('PROFILES.TABLE.EDIT'),
          // Nothing to modify without a dossier — creating one is the action above.
          hidden: (row: TableRow) => row['profileId'] == null || !this.canEdit(),
          onClick: (row: TableRow) => this.edit.emit(row['employeeItem'] as EmployeeListItem),
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
        // The source row, so an action can emit it whole. `profileId` above stays because
        // the `hidden` predicates read it directly.
        employeeItem: emp,
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

  /** Checkbox, header "select all" or reset: hand the page the full new selection. */
  protected onSelectedChange(keys: string[]): void {
    this.selectionChange.emit(keys.map(Number).filter(n => !Number.isNaN(n)));
  }

  /** Header click (or the reset icon) → Spring `sort` value, or null when cleared. */
  protected onSortChange(key: string, dir: SortDirection): void {
    const field = SERVER_SORT_FIELD[key];
    this.sortChange.emit(field && dir ? `${field},${dir}` : null);
  }

  /** `null` and an unparseable string both render as the em dash, never as 'Invalid Date'. */
  private formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(this.translate.currentLang() || 'fr', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
