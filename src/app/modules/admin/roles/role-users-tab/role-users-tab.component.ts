import {
  Component, computed, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import {
  ButtonComponent, FormFieldComponent, StatusBadgeComponent, PaginationComponent,
  DataTableComponent, SortDirection, TableColumn, TableConfig, TableRow, AvatarCell,
  SearchToolbarComponent,
} from '@khalilrebhiitec/daf360';
import { searchRows } from '../../../../shared/table-sort.utils';
import { RoleListItem, RoleUserItem } from '../role.model';
import { RoleManagementService } from '../role-management.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 5;

type RoleUserSort = { key: string; dir: 'asc' | 'desc' };

/** What each table column sorts on — keyed by the table's column keys. */
const USER_SORT_VALUE: Record<string, (u: RoleUserItem) => string | number | null> = {
  user: u => u.fullName || null,
  pays: u => u.paysLabel || null,
};

/** Sorts the whole filtered list — the table is `manualSort`, so it only reorders one page. */
function sortRoleUsers(items: RoleUserItem[], sort: RoleUserSort | null): RoleUserItem[] {
  const value = sort && USER_SORT_VALUE[sort.key];
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
 * Users of the selected role (role editor). Library table tools are on, same as the other RH
 * tables; **sorting is `manualSort`** — the rows are one 5-row page, so the header only emits
 * `sortChange` and this component sorts the whole filtered list before paging.
 */
@Component({
  selector: 'app-role-users-tab',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, StatusBadgeComponent, PaginationComponent,
    DataTableComponent, SearchToolbarComponent, TranslatePipe,
  ],
  templateUrl: './role-users-tab.component.html',
  styleUrl:    './role-users-tab.component.scss',
})
export class RoleUsersTabComponent {
  role = input.required<RoleListItem>();

  // Emits updated userCount so parent can refresh the badge
  usersChanged = output<number>();

  private svc = inject(RoleManagementService);
  private translate = inject(TranslateService);

  // ── State ────────────────────────────────────────────────────────────────
  users         = signal<RoleUserItem[]>([]);
  loading       = signal(false);
  error         = signal<string | null>(null);
  localSearch   = signal('');

  // Add-user flow
  showAddPanel  = signal(false);
  addQuery      = signal('');
  searchResults = signal<RoleUserItem[]>([]);
  searching     = signal(false);
  adding        = signal<number | null>(null); // userId being added

  private search$ = new Subject<string>();

  /** The table (absent while empty / no match) — passed to the toolbar's `[table]`. */
  readonly table = viewChild(DataTableComponent);

  filteredUsers = computed(() =>
    searchRows(this.users(), this.localSearch(), u => [u.fullName, u.email, u.paysLabel]),
  );

  // ── Pagination — 5 per page ─────────────────────────────────────────────────
  currentPage = signal(0);
  /** Table header sort — applied to the whole filtered list, before paging. */
  sort = signal<RoleUserSort | null>(null);

  readonly totalElements = computed(() => this.filteredUsers().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / PAGE_SIZE));

  readonly pagedUsers = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return sortRoleUsers(this.filteredUsers(), this.sort()).slice(start, start + PAGE_SIZE);
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    // `manualSort`: no sortAccessor — this component sorts (`sortRoleUsers`).
    return [
      { key: 'user', label: this.translate.instant('ADMIN.roles.users.COL_USER'), type: 'avatar', sortable: true },
      { key: 'pays', label: this.translate.instant('ADMIN.roles.users.COL_PAYS'), sortable: true },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedUsers().map(u => ({
      user: { name: u.fullName, initials: u.fullName.charAt(0).toUpperCase(), subtitle: u.email } as AvatarCell,
      pays: u.paysLabel ?? '—',
      _source: u,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      showHeader: false,
      hoverable: true,
      loading: this.loading(),
      emptyMessage: t('ADMIN.roles.users.EMPTY'),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId: (row: TableRow) => (row['_source'] as RoleUserItem).userId,
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
        id: 'remove', icon: 'close',
        tooltip: t('ADMIN.roles.users.REMOVE_TOOLTIP'),
        onClick: (row: TableRow) => this.removeUser(row['_source'] as RoleUserItem),
      }],
    };
  });

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(key && dir ? { key, dir } : null);
    this.currentPage.set(0);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** New search → back to the first page (otherwise it can land on an empty one). */
  onLocalSearch(value: string): void {
    if (value === this.localSearch()) return;   // daf-search-toolbar re-emits on blur
    this.localSearch.set(value);
    this.currentPage.set(0);
  }

  constructor() {
    // Reload users whenever the selected role changes
    effect(() => {
      const role = this.role();
      if (role?.id) this.loadUsers(role.id);
    });

    // Debounced search for the add-user panel
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.length < 2) { this.searchResults.set([]); return []; }
          this.searching.set(true);
          return this.svc.searchUsersForRole(this.role().id, q);
        })
      )
      .subscribe({
        next:  res => { this.searchResults.set(res); this.searching.set(false); },
        error: ()  => { this.searching.set(false); },
      });
  }

  loadUsers(roleId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.currentPage.set(0);
    this.svc.getRoleUsers(roleId).subscribe({
      next:  us => { this.users.set(us); this.loading.set(false); },
      error: ()  => { this.loading.set(false); this.error.set(this.translate.instant('ADMIN.roles.users.LOAD_ERROR')); },
    });
  }

  onAddQueryChange(q: string): void {
    this.addQuery.set(q);
    this.search$.next(q);
  }

  assignUser(user: RoleUserItem): void {
    this.adding.set(user.userId);
    this.svc.assignUserToRole(this.role().id, user.userId).subscribe({
      next: () => {
        this.adding.set(null);
        this.searchResults.update(rs => rs.filter(r => r.userId !== user.userId));
        this.users.update(us => [...us, { ...user, currentRoleName: null }]
          .sort((a, b) => a.fullName.localeCompare(b.fullName)));
        this.usersChanged.emit(this.users().length);
        if (this.searchResults().length === 0) this.addQuery.set('');
      },
      error: () => {
        this.adding.set(null);
        this.error.set(this.translate.instant('ADMIN.roles.users.ASSIGN_ERROR'));
      },
    });
  }

  removeUser(user: RoleUserItem): void {
    this.svc.removeUserFromRole(this.role().id, user.userId).subscribe({
      next: () => {
        this.users.update(us => us.filter(u => u.userId !== user.userId));
        this.usersChanged.emit(this.users().length);
      },
      error: () => this.error.set(this.translate.instant('ADMIN.roles.users.REMOVE_ERROR')),
    });
  }

  closeAddPanel(): void {
    this.showAddPanel.set(false);
    this.addQuery.set('');
    this.searchResults.set([]);
  }
}
