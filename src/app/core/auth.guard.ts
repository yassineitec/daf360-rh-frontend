import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectCurrentUser } from '@khalilrebhiitec/daf360';
import { filter, firstValueFrom, of, timeout } from 'rxjs';
import { UserStore } from './user.store';
import { environment } from '../../environments/environment';

export const authGuard: CanActivateFn = async () => {
  const userStore = inject(UserStore);

  // Fast path: standalone mode — APP_INITIALIZER already populated UserStore.
  if (userStore.isAuthenticated()) return true;

  // Federation path: UserStore must be populated directly — it's the only source of
  // rhToken (auth.interceptor.ts reads it for every rh-service call; the shared NgRx
  // store's MeResponse, from @khalilrebhiitec/daf360, doesn't carry that field at all).
  // This used to be a 2 s wait on the shared store first, which could grant navigation
  // without ever populating UserStore — leaving every subsequent rh-service call
  // silently unauthenticated (no Authorization header, falling back to cookies that
  // don't reliably cross the shell/rh-service port boundary).
  try {
    await userStore.loadCurrentUser();
    if (userStore.isAuthenticated()) return true;
  } catch {
    // network error — fall through to the shared-store check below
  }

  // Fallback: if the direct call failed but the shell's shared store already confirms
  // a logged-in user, don't bounce to login — just proceed without rhToken rather than
  // block navigation (rh-service calls will fall back to cookie auth in that case).
  try {
    const store = inject(Store);
    const storeUser = await firstValueFrom(
      store.select(selectCurrentUser).pipe(
        filter(u => u !== null),
        timeout({ first: 2000, with: () => of(null) }),
      ),
    );
    if (storeUser) return true;
  } catch {
    // NgRx store not provided (standalone without APP_INITIALIZER) — fall through.
  }

  window.location.href = environment.shellUrl || '/';
  return false;
};
