import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectCurrentUser } from '@khalilrebhiitec/daf360';
import { firstValueFrom } from 'rxjs';
import { UserStore } from './user.store';
import { environment } from '../../environments/environment';

export const authGuard: CanActivateFn = async () => {
  const store     = inject(Store);
  const userStore = inject(UserStore);

  // In federation mode the shell may have already populated the shared NgRx
  // store — check that first to avoid a redundant /api/me round-trip.
  const storeUser = await firstValueFrom(store.select(selectCurrentUser));
  if (storeUser) return true;

  // Standalone mode or shell not yet authenticated: use local UserStore.
  if (userStore.isAuthenticated()) return true;

  try {
    await userStore.loadCurrentUser();
    if (userStore.isAuthenticated()) return true;
  } catch {
    // network error — treat as unauthenticated
  }

  window.location.href = environment.shellUrl || '/';
  return false;
};
