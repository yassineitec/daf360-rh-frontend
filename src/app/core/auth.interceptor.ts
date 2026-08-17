import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserStore } from './user.store';
import { NotificationService } from './notification.service';

/**
 * Security baseline:
 * 1. Adds withCredentials=true for all our-API requests (sends HttpOnly portal cookie).
 * 2. For rh-service calls: also adds Authorization: Bearer {rhToken} from /api/me.
 *    This avoids cross-port cookie-sending issues (cookie set at :8080, used at :8082).
 * 3. Catches 401 from the PORTAL only → redirects to Azure OAuth2 (session expired).
 *    rh-service 401s are propagated so components show their own error state.
 */

/**
 * Image retrievals whose failure already has an in-place fallback (real photo →
 * gendered avatar → initials), so a toast would be pure noise: a profile with no
 * uploaded file, or a stale `photo_url` pointing at a file that is gone, is a
 * normal state — see `shared/utils/avatar.utils`.
 *
 * Matched on GET only: photo *uploads* (POST .../photo) must keep surfacing their
 * error, and the upload UI adds its own message on top.
 */
const SILENT_IMAGE_GET = ['/photo', '/avatars'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const userStore = inject(UserStore);
  const notify = inject(NotificationService);

  const silentImage =
    req.method === 'GET' && SILENT_IMAGE_GET.some(u => req.url.includes(u));

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
      } else if (silentImage) {
        // Avatar/photo GET failed — the caller falls back to a gendered avatar or
        // initials, so stay quiet and just propagate the error.
      } else if (err.status === 403) {
        notify.error("Vous n'avez pas les droits pour cette action.", 'Accès refusé');
      } else if (err.status >= 500) {
        notify.error('Une erreur serveur est survenue. Veuillez réessayer.', 'Erreur serveur');
      }
      return throwError(() => err);
    })
  );
};
