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

  // Federation path: the shell populates the shared NgRx store asynchronously
  // (UserActions dispatched from ShellLayoutComponent.ngOnInit after the effect
  // runs its /api/me call). firstValueFrom would resolve immediately with null
  // if we don't filter, so we wait up to 2 s for a non-null user to arrive.
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

  // Network fallback: fetch the user directly from the portal.
  try {
    await userStore.loadCurrentUser();
    if (userStore.isAuthenticated()) return true;
  } catch {
    // network error — treat as unauthenticated
  }

  window.location.href = environment.shellUrl || '/';
  return false;
};
