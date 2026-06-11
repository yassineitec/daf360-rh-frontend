import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { UserStore } from './user.store';
import { environment } from '../../environments/environment';

/**
 * Functional route guard — blocks unauthenticated access.
 *
 * When not authenticated, redirects to the portal's OAuth2 login endpoint.
 * The portal's AzureOAuth2SuccessHandler reads the Referer header and redirects
 * back to this app's /auth/callback after successful login.
 *
 * Security: the portal validates the origin against its allowed CORS list before
 * redirecting back, so no open-redirect risk.
 */
export const authGuard: CanActivateFn = () => {
  const store = inject(UserStore);

  if (store.isAuthenticated()) {
    return true;
  }

  // Redirect to portal OAuth2 login.
  // The portal's success handler will redirect back here to /auth/callback
  // once the user is authenticated (based on the Referer header).
  window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
  return false;
};
