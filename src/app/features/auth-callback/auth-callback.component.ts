import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Handles the redirect from DAF360 Portal.
 *
 * Expected URL: http://localhost:4201/auth/callback?token=<jwt>
 *
 * The portal's AzureOAuth2SuccessHandler signs an internal JWT and redirects
 * to {frontendUrl}/auth/callback?token={jwt}. This component reads that token,
 * stores it in sessionStorage, and navigates to the main app.
 *
 * If no token is in the URL, shows a "go to portal" link so the user can log in.
 */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="cb-wrapper">
      <div class="cb-card">
        @if (error) {
          <div class="cb-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#333" stroke-width="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke="#333" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <h2>Authentication required</h2>
          <p>{{ error }}</p>
          <a class="btn btn-primary" [href]="portalLoginUrl">
            Go to Portal login
          </a>
        } @else {
          <div class="spinner"></div>
          <p class="cb-hint">Signing you in…</p>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100dvh; }
    .cb-wrapper {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111111;
    }
    .cb-card {
      background: #ffffff;
      border-radius: 10px;
      padding: 48px 40px;
      width: 100%;
      max-width: 360px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .cb-icon { margin-bottom: 16px; }
    h2 { font-size: 1.2rem; color: #111; margin-bottom: 8px; }
    p { color: #666; font-size: 0.9rem; margin-bottom: 20px; }
    .cb-hint { color: #999; font-size: 0.85rem; margin-top: 12px; margin-bottom: 0; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid #e0e0e0;
      border-top-color: #111;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class AuthCallbackComponent implements OnInit {
  error = '';
  portalLoginUrl = `${environment.portalUrl}/oauth2/authorization/azure`;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.error = 'No authentication token was received. Please sign in through the DAF360 Portal.';
      return;
    }

    const user = this.authService.handleCallback(token);
    if (!user) {
      this.error = 'The token is invalid or has expired. Please sign in again.';
      return;
    }

    this.router.navigate(['/employees'], { replaceUrl: true });
  }
}
