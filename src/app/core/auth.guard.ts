import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { UserStore } from './user.store';
import { environment } from '../../environments/environment';

export const authGuard: CanActivateFn = async () => {
  const userStore = inject(UserStore);

  // Fast path: the shared NgRx store singleton is already populated — either by
  // this app's own APP_INITIALIZER, or by the shell (or another federated remote)
  // that fetched /api/me first. UserStore.currentUser reads that same store, so
  // this one check covers both cases — including rhToken, which now lives on the
  // same canonical MeResponse regardless of which app populated it.
  if (userStore.isAuthenticated()) return true;

  // Not yet populated anywhere — fetch it ourselves.
  try {
    await userStore.loadCurrentUser();
    if (userStore.isAuthenticated()) return true;
  } catch {
    // network error — fall through to redirect
  }

  window.location.href = environment.shellUrl || '/';
  return false;
};
