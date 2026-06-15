import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { UserStore } from './user.store';
import { environment } from '../../environments/environment';

export const authGuard: CanActivateFn = async () => {
  const userStore = inject(UserStore);

  if (userStore.isAuthenticated()) return true;

  try {
    await userStore.loadCurrentUser();
    if (userStore.isAuthenticated()) return true;
  } catch {
    // network error — treat as unauthenticated
  }

  window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
  return false;
};
