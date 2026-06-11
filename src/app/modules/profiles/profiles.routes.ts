import { Routes } from '@angular/router';

export const PROFILES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./profile-list.component').then(m => m.ProfileListComponent),
  },
  {
    // /hr/profiles/new is disabled — use the Candidate → Onboarding pipeline instead.
    path: 'new',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./profile-detail.component').then(m => m.ProfileDetailComponent),
  },
];
