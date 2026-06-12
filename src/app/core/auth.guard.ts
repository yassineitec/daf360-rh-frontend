// import { inject } from '@angular/core';
// import { CanActivateFn } from '@angular/router';
// import { UserStore } from './user.store';
// import { environment } from '../../environments/environment';

// export const authGuard: CanActivateFn = () => {
//   const store = inject(UserStore);

//   // Load user if not already authenticated
//   if (!store.isAuthenticated()) {
//     return store.loadCurrentUser().then(
//       () => {
//         if (store.isAuthenticated()) {
//           return true;
//         }
//         window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
//         return false;
//       },
//       () => {
//         // Network error - treat as unauthenticated
//         window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
//         return false;
//       }
//     );
//   }

//   if (store.isAuthenticated()) {
//     return true;
//   }

//   // Not authenticated and can't load - redirect
//   window.location.href = `${environment.portalUrl}/oauth2/authorization/azure`;
//   return false;
// };