import { computed, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';
import {
  MeResponse,
  UserActions,
  selectCurrentUser,
  selectUserPermissions,
} from '@khalilrebhiitec/daf360';
import { environment } from '../../environments/environment';

// Permissions that indicate HR management rights
// (based on CK_RolePermissions_Permission 32-value set)
const HR_MANAGER_PERMS = [
  'HR_CREATE_PROFILE',
  'HR_UPDATE_PROFILE',
  'HR_ARCHIVE_PROFILE',
  'HR_ONBOARDING',
  'SETTLE_LEAVES',
  'RESPONSE_LEAVE',
];
const ADMIN_PERMS = ['CREATE_ROLE', 'UPDATE_ROLE', 'DELETE_ROLE', 'HR_ADMIN_ROLES'];

@Injectable({ providedIn: 'root' })
export class UserStore {
  private http = inject(HttpClient);
  private store = inject(Store);

  // ── Signals ──────────────────────────────────────────────────────────────
  // currentUser/permissions are derived from the shared NgRx store (single
  // source of truth across the shell + all federated remotes) rather than
  // fetched independently — whichever app populates the store first is enough.
  private _loading = signal(false);
  private _error   = signal<string | null>(null);

  readonly currentUser = toSignal(this.store.select(selectCurrentUser), { initialValue: null });
  readonly permissions = toSignal(this.store.select(selectUserPermissions), {
    initialValue: [] as string[],
  });
  readonly loading         = this._loading.asReadonly();
  readonly error           = this._error.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  readonly isHrManager = computed(() =>
    HR_MANAGER_PERMS.some(p => this.permissions().includes(p)));

  readonly isAdmin = computed(() =>
    ADMIN_PERMS.some(p => this.permissions().includes(p)));

  readonly userInitials = computed(() => {
    const name = this.currentUser()?.fullName ?? '';
    return name.split(' ').map(n => n[0] ?? '').slice(0, 2).join('').toUpperCase();
  });

  // ── Methods ───────────────────────────────────────────────────────────────

  /** Returns true if the current user holds the given permission. */
  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  /**
   * Called by APP_INITIALIZER on bootstrap.
   * Resolves successfully even on 401 (unauthenticated state is valid at startup).
   */
  loadCurrentUser(): Promise<void> {
    this._loading.set(true);
    return firstValueFrom(
      this.http
        .get<MeResponse>(`${environment.portalUrl}/api/me`, { withCredentials: true })
        .pipe(
          tap(user => {
            this.store.dispatch(UserActions.loadCurrentUserSuccess({ user }));
            this._error.set(null);
          }),
          catchError(err => {
            // Any failure means we can't confirm the session — clear the shared
            // store rather than just recording an error, so isAuthenticated()
            // reflects reality for callers re-checking an existing session.
            this.store.dispatch(UserActions.clearUser());
            if (err.status !== 401) {
              this._error.set('Could not load user profile');
            }
            return of(null);
          }),
          map(() => void 0)
        )
    ).finally(() => this._loading.set(false));
  }

  clearUser(): void {
    this.store.dispatch(UserActions.clearUser());
  }
}
