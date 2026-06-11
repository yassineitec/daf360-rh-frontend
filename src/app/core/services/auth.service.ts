import { Injectable } from '@angular/core';
import { BehaviorSubject, ReplaySubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'daf360_rh_token';

export interface RhUser {
  oid: string;
  email: string;
  name: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser$ = new BehaviorSubject<RhUser | null>(null);
  private initialized$ = new ReplaySubject<void>(1);

  constructor() {
    // Parse user from the stored JWT on page refresh
    const token = this.getToken();
    if (token) {
      const user = this.parseJwt(token);
      if (user) {
        this.currentUser$.next(user);
      } else {
        this.clearToken(); // token is malformed / expired
      }
    }
    this.initialized$.next();
  }

  /**
   * Called by AuthCallbackComponent after the portal redirects here with a JWT.
   * Stores the token and extracts user info from its claims.
   */
  handleCallback(token: string): RhUser | null {
    const user = this.parseJwt(token);
    if (!user) return null;
    sessionStorage.setItem(TOKEN_KEY, token);
    this.currentUser$.next(user);
    return user;
  }

  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  getUser(): Observable<RhUser | null> {
    return this.currentUser$.asObservable();
  }

  getCurrentUser(): RhUser | null {
    return this.currentUser$.value;
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.currentUser$.value;
  }

  waitForInit(): Observable<void> {
    return this.initialized$.asObservable();
  }

  logout(): void {
    this.clearToken();
    // Redirect back to portal
    window.location.href = environment.portalUrl;
  }

  private clearToken(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.currentUser$.next(null);
  }

  /** Decode JWT payload (no signature verification — backend validates on each request). */
  private parseJwt(token: string): RhUser | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      // Check expiry
      if (payload.exp && Date.now() / 1000 > payload.exp) return null;

      return {
        oid:   payload.sub   ?? '',
        email: payload.email ?? '',
        name:  payload.name  ?? payload.email ?? 'User',
        roles: Array.isArray(payload.roles) ? payload.roles : [],
      };
    } catch {
      return null;
    }
  }
}
