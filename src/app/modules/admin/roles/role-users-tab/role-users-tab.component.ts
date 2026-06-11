import {
  Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { RoleListItem, RoleUserItem } from '../role.model';
import { RoleManagementService } from '../role-management.service';

@Component({
  selector: 'app-role-users-tab',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './role-users-tab.component.html',
  styleUrl:    './role-users-tab.component.scss',
})
export class RoleUsersTabComponent {
  role = input.required<RoleListItem>();

  // Emits updated userCount so parent can refresh the badge
  usersChanged = output<number>();

  private svc = inject(RoleManagementService);

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
    this.svc.getRoleUsers(roleId).subscribe({
      next:  us => { this.users.set(us); this.loading.set(false); },
      error: ()  => { this.loading.set(false); this.error.set('Erreur lors du chargement des utilisateurs.'); },
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
        this.error.set('Erreur lors de l\'assignation.');
      },
    });
  }

  removeUser(user: RoleUserItem): void {
    this.svc.removeUserFromRole(this.role().id, user.userId).subscribe({
      next: () => {
        this.users.update(us => us.filter(u => u.userId !== user.userId));
        this.usersChanged.emit(this.users().length);
      },
      error: () => this.error.set('Erreur lors de la suppression.'),
    });
  }

  closeAddPanel(): void {
    this.showAddPanel.set(false);
    this.addQuery.set('');
    this.searchResults.set([]);
  }
}
