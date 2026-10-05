import { Component, computed, inject, input, output, signal, effect, untracked, viewChild } from '@angular/core';
import {
  PaginationComponent, SearchToolbarComponent, ButtonComponent,
  DataTableComponent, DafCellDirective, SortDirection, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { RoleListItem } from './role.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

type RoleSort = { key: string; dir: 'asc' | 'desc' };

/** What each table column sorts on — keyed by the table's column keys. */
const ROLE_SORT_VALUE: Record<string, (r: RoleListItem) => string | number | null> = {
  name:    r => r.frenchName || null,
  // The "details" cell leads with the permission count, so that is what it sorts on.
  details: r => r.permissionCount ?? null,
  parent:  r => r.parentRoleName || null,
};

/** Sorts the whole filtered list — the table is `manualSort`, so it only reorders one page. */
function sortRoles(items: RoleListItem[], sort: RoleSort | null): RoleListItem[] {
  const value = sort && ROLE_SORT_VALUE[sort.key];
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
 * Role list of Administration → Rôles. Library table tools are on, same as the other RH
 * tables: sortable headers, resizable columns and rows, the column picker and the reset icon.
 * **Sorting is `manualSort`**: the rows are one client-side page, so the header only emits
 * `sortChange` and this component sorts the whole filtered list (`sortRoles`) before paging.
 */
@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    PaginationComponent, SearchToolbarComponent, ButtonComponent,
    DataTableComponent, DafCellDirective,
    TranslatePipe,
  ],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent {
  private translate = inject(TranslateService);

  // Inputs
  roles          = input<RoleListItem[]>([]);
  selectedRoleId = input<number | null>(null);
  loading        = input(false);

  // Outputs
  roleSelected   = output<RoleListItem>();
  createClicked  = output<void>();
  deleteClicked  = output<RoleListItem>();

  // State
  searchQuery = signal('');
  currentPage = signal(0);

  pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  /** Table header sort — applied to the whole filtered list, before paging. */
  sort = signal<RoleSort | null>(null);

  /** Le tableau (absent pendant le chargement) — passé au `[table]` de la barre. */
  readonly table = viewChild(DataTableComponent);

  /** Nouvelle recherche → retour à la première page (sinon on peut rester sur une page vide). */
  onSearch(value: string): void {
    if (value === this.searchQuery()) return;
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  filteredRoles = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.roles();
    return this.roles().filter(r =>
      r.frenchName.toLowerCase().includes(q)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredRoles().length / this.pageSize())));

  pagedRoles = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return sortRoles(this.filteredRoles(), this.sort()).slice(start, start + this.pageSize());
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    // `manualSort`: no sortAccessor — this component sorts (`sortRoles`).
    return [
      { key: 'name',    label: this.translate.instant('ADMIN.roles.list.COL_NAME'), sortable: true },
      { key: 'details', label: this.translate.instant('ADMIN.roles.list.COL_DETAILS'), sortable: true },
      { key: 'parent',  label: this.translate.instant('ADMIN.roles.list.COL_PARENT'), sortable: true },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedRoles().map(r => ({
      name:    r.frenchName,
      parent:  r.parentRoleName ?? null,
      _source: r,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // A seed read once by the table: it is re-created by the loading @if, and this keeps
    // the header arrow — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
    hoverable: true,
    // No title here: the list's own header row already carries it, and the library's
    // empty title bar would sit as a blank white band above the column picker.
    showHeader: false,
    emptyMessage: t('ADMIN.roles.list.EMPTY'),
    // Stable row identity: row heights are keyed by it, not by render index.
    rowId: (row: TableRow) => (row['_source'] as RoleListItem).id,
    resizableColumns:  true,
    resizableRows:     true,
    columnPicker:      true,
    columnPickerLabel: t('REQUESTS.TABLE.COLUMN_PICKER'),
    showReset:         true,
    resetLabel:        t('REQUESTS.TABLE.RESET'),
    sortLabel:         t('REQUESTS.TABLE.SORT_BY'),
    manualSort:        true,
    ...(sort ? { defaultSort: sort } : {}),
    actions: [{
      id: 'delete', icon: 'delete',
      tooltip: this.translate.instant('ADMIN.roles.list.DELETE_TOOLTIP'),
      disabled: (row: TableRow) => (row['_source'] as RoleListItem).userCount > 0,
      onClick: (row: TableRow) => this.deleteClicked.emit(row['_source'] as RoleListItem),
    }],
    };
  });

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(key && dir ? { key, dir } : null);
    this.currentPage.set(0);
  }

  private resetPageOnFilterChange = effect(() => {
    this.filteredRoles();
    this.currentPage.set(0);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** `pageSizeChange` fires alone — go back to page 0 with the new size (same as /rh/profiles). */
  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
  }
}
