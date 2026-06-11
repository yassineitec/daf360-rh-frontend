import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserStore } from './user.store';

/**
 * Handles OAuth redirect flows and session termination.
 * User state is managed by UserStore — this service delegates to it.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http      = inject(HttpClient);
  private userStore = inject(UserStore);

  /** Proxy to UserStore for template convenience. */
  readonly user            = this.userStore.currentUser;
  readonly isAuthenticated = this.userStore.isAuthenticated;

  /** Redirects to portal → Azure AD login page. */
  login(): void {
    window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
  }

  /** Clears server-side session and local user signal. */
  async logout(): Promise<void> {
    await firstValueFrom(
      this.http
        .post(`${environment.portalUrl}/auth/logout`, {}, { withCredentials: true })
        .pipe(catchError(() => of(null)))
    );
    this.userStore.clearUser();
    this.login();
  }

  /** Silently refresh the JWT — browser sends the HttpOnly cookie automatically. */
  refreshToken() {
    return this.http.post(`${environment.portalUrl}/auth/refresh`, {}, { withCredentials: true });
  }
}
