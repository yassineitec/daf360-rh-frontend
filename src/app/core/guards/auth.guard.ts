import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Legacy guard used by the features/ subtree.
 * Updated to use the canonical OAuth2 flow (cookie-based, same as core/auth.guard.ts).
 * The old /sso/rh SSO endpoint was deleted — portal now uses HttpOnly cookie auth.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);

  return auth.waitForInit().pipe(
    take(1),
    map(() => {
      if (auth.isAuthenticated()) return true;
      window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
      return false;
    }),
  );
};
