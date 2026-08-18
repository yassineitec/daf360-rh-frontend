import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserStore } from './user.store';

/**
 * Security baseline:
 * 1. Adds withCredentials=true for all our-API requests (sends HttpOnly portal cookie).
 * 2. For rh-service calls: also adds Authorization: Bearer {rhToken} from /api/me.
 *    This avoids cross-port cookie-sending issues (cookie set at :8080, used at :8082).
 * 3. Catches 401 from the PORTAL only → redirects to Azure OAuth2 (session expired).
 *    rh-service 401s are propagated so components show their own error state.
 *
 * This interceptor raises NO user-facing error notification. It used to toast on 403 and
 * 5xx; both are gone deliberately, because a 403 is ordinary traffic in an app where
 * sections are gated on permissions, and one toast per denial made normal navigation noisy.
 * Responsibility moved to where the context is known:
 *
 *   - a page the user may not open   -> `permissionGuard` sends them to /forbidden with no
 *     request made (see app.routes.ts);
 *   - a section inside a page they may open -> the section hides itself (`*dafHasPermission`
 *     for a static code, or a catch on 403 where it depends on the data).
 *
 * Errors still propagate via `throwError`, so nothing is swallowed — the 34 deliberate
 * `notify.*` calls in components (save/upload feedback on user-initiated actions) are
 * untouched and remain the way failures get reported.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const userStore = inject(UserStore);

  const isPortal  = req.url.startsWith(environment.portalUrl);
  const isHrApi   = req.url.startsWith(environment.hrApiUrl);

  // Attach credentials to all our backends
  let authReq = (isPortal || isHrApi)
    ? req.clone({ withCredentials: true })
    : req;

  // For rh-service: also send the HMAC token as Bearer so the service can validate it
  // without relying on cross-port cookie delivery.
  if (isHrApi) {
    const rhToken = userStore.currentUser()?.rhToken;
    if (rhToken) {
      authReq = authReq.clone({
        setHeaders: { Authorization: `Bearer ${rhToken}` },
      });
    }
  }

  return next(authReq).pipe(
    catchError(err => {
      if (err.status === 401 && isPortal) {
        // Portal session expired → re-auth via Azure OAuth2.
        window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
      }
      return throwError(() => err);
    })
  );
};
