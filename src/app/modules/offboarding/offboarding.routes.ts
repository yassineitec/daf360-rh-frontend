import { Routes } from '@angular/router';

export const OFFBOARDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./offboarding-list.component').then(m => m.OffboardingListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./offboarding-detail.component').then(m => m.OffboardingDetailComponent),
  },
];
