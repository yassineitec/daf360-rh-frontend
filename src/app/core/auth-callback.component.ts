import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserStore } from './user.store';
import { SpinnerComponent } from '../shared/spinner.component';

/**
 * Landing component for /auth/callback.
 *
 * The portal redirects here after successful MS365 OAuth2 login.
 * JWT cookies are already set by the portal's success handler.
 * This component re-loads /api/me to populate the UserStore, then
 * navigates the user into the app.
 */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [SpinnerComponent],
  template: `
    <div style="display:flex;align-items:center;justify-content:center;height:100dvh;flex-direction:column;gap:16px;color:var(--color-text-muted,#6B7280)">
      <app-spinner size="lg" />
      <p style="font-size:14px;margin:0">Connexion en cours…</p>
    </div>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private store  = inject(UserStore);
  private router = inject(Router);

  async ngOnInit() {
    await this.store.loadCurrentUser();

    if (this.store.isAuthenticated()) {
      this.router.navigate(['/profiles']);
    } else {
      // Should not happen unless the JWT cookie was not set
      this.router.navigate(['/profiles']);
    }
  }
}
