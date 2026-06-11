import { computed, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// DTO from portal /api/me — mirrors daf360-shell MeResponse
// ─────────────────────────────────────────────────────────────────────────────
export interface MeResponse {
  userId:      number;
  fullName:    string;
  email:       string;
  azureUpn:    string;
  roleId:      number;
  roleName:    string;
  permissions: string[];
  paysId:      number;
  isoCode:     string;
  employeeId:  string;
  photoUrl:    string | null;
  /** HMAC JWT for authenticating requests to the rh-service (sent as Authorization: Bearer). */
  rhToken:     string | null;
}

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

  // ── Signals ──────────────────────────────────────────────────────────────
  private _user   = signal<MeResponse | null>(null);
  private _loading = signal(false);
  private _error   = signal<string | null>(null);

  readonly currentUser    = this._user.asReadonly();
  readonly loading        = this._loading.asReadonly();
  readonly error          = this._error.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /** User's permission strings from /api/me (MeResponse.permissions[]). */
  readonly permissions = computed<string[]>(() => this._user()?.permissions ?? []);

  readonly isHrManager = computed(() =>
    HR_MANAGER_PERMS.some(p => this.permissions().includes(p)));

  readonly isAdmin = computed(() =>
    ADMIN_PERMS.some(p => this.permissions().includes(p)));

  readonly userInitials = computed(() => {
    const name = this._user()?.fullName ?? '';
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
            this._user.set(user);
            this._error.set(null);
          }),
          catchError(err => {
            this._user.set(null);
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
    this._user.set(null);
  }
}
