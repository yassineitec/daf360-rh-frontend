import { Routes } from '@angular/router';

export const REQUESTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./request-list.component').then(m => m.RequestListComponent),
  },
  {
    path: 'inbox',
    loadComponent: () =>
      import('./request-officer-inbox.component').then(m => m.RequestOfficerInboxComponent),
    // Note: canActivate with permission check is handled inline via userStore.isHrManager()
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./request-detail.component').then(m => m.RequestDetailComponent),
  },
];
