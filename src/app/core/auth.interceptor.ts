import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectCurrentUser } from '@khalilrebhiitec/daf360';
import { catchError, throwError, take } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification.service';

/**
 * Security baseline:
 * 1. Adds withCredentials=true for all our-API requests (sends HttpOnly portal cookie).
 * 2. For rh-service calls: also adds Authorization: Bearer {rhToken} from /api/me.
 *    This avoids cross-port cookie-sending issues (cookie set at :8080, used at :8082).
 * 3. Catches 401 from the PORTAL only → redirects to Azure OAuth2 (session expired).
 *    rh-service 401s are propagated so components show their own error state.
 *
 * Uses Store directly (not UserStore) to avoid the circular dependency:
 *   UserStore → HttpClient → interceptor → UserStore
 */

/** Read the current user's rhToken synchronously from the NgRx store. */
function getRhToken(store: Store): string | null | undefined {
  let token: string | null | undefined;
  store.select(selectCurrentUser).pipe(take(1)).subscribe(u => { token = u?.rhToken; });
  return token;
}

function withRhToken(req: HttpRequest<unknown>, token: string | null | undefined): HttpRequest<unknown> {
  return token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
    : req.clone({ withCredentials: true });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Use Store directly — avoids UserStore → HttpClient → interceptor → UserStore cycle.
  const store    = inject(Store);
  // Use Injector for lazy NotificationService — it's not a singleton singleton but
  // injecting it eagerly here still risks timing issues during bootstrap.
  const injector = inject(Injector);
  const getNotify = () => injector.get(NotificationService);

  const isPortal = req.url.startsWith(environment.portalUrl);
  const isHrApi  = req.url.startsWith(environment.hrApiUrl);

  if (isPortal) {
    return next(req.clone({ withCredentials: true })).pipe(
      catchError(err => {
        if (err.status === 401) {
          window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
        }
        return throwError(() => err);
      }),
    );
  }

  if (isHrApi) {
    return next(withRhToken(req, getRhToken(store))).pipe(
      catchError(err => {
        if (err.status === 401) {
          window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
        } else if (err.status === 403) {
          getNotify().error("Vous n'avez pas les droits pour cette action.", 'Accès refusé');
        } else if (err.status >= 500) {
          getNotify().error('Une erreur serveur est survenue. Veuillez réessayer.', 'Erreur serveur');
        }
        return throwError(() => err);
      }),
    );
  }

  return next(req);
};
