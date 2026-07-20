import {
  Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import {
  ButtonComponent, FormFieldComponent, StatusBadgeComponent, PaginationComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow, AvatarCell,
} from '@khalilrebhiitec/daf360';
import { RoleListItem, RoleUserItem } from '../role.model';
import { RoleManagementService } from '../role-management.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-role-users-tab',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, StatusBadgeComponent, PaginationComponent,
    DataTableComponent, DafCellDirective, TranslatePipe,
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

  filteredUsers = computed(() => {
    const q = this.localSearch().toLowerCase();
    return q
      ? this.users().filter(u =>
          u.fullName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.paysLabel?.toLowerCase().includes(q))
      : this.users();
  });

  // ── Pagination — 5 per page ─────────────────────────────────────────────────
  currentPage = signal(0);

  readonly totalElements = computed(() => this.filteredUsers().length);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / PAGE_SIZE));

  readonly pagedUsers = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.filteredUsers().slice(start, start + PAGE_SIZE);
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'user', label: this.translate.instant('ADMIN.roles.users.COL_USER'), type: 'avatar' },
      { key: 'pays', label: this.translate.instant('ADMIN.roles.users.COL_PAYS') },
      { key: '_actions', label: this.translate.instant('ADMIN.roles.users.COL_ACTIONS'), align: 'right' },
    ];
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedUsers().map(u => ({
      user: { name: u.fullName, initials: u.fullName.charAt(0).toUpperCase(), subtitle: u.email } as AvatarCell,
      pays: u.paysLabel ?? '—',
      _source: u,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => ({
    hoverable: true,
    loading: this.loading(),
    emptyMessage: this.translate.instant('ADMIN.roles.users.EMPTY'),
  }));

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  onLocalSearch(value: string): void {
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
