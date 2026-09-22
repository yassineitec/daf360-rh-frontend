import { Routes } from '@angular/router';

export const PROFILES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./profile-list.component').then(m => m.ProfileListComponent),
  },
  {
    // The standalone "new profile" wizard is gone — a profile is created by the
    // Candidate → Onboarding pipeline. Kept as a redirect rather than deleted so the
    // old URL lands on the list instead of falling through to `:id` and asking the
    // backend for a profile literally named "new".
    path: 'new',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    // Keyed by USER id, not profile id — the point is the people who have no profile id.
    // Must stay above ':id': that pattern would otherwise swallow 'user' and ask the
    // backend for a profile named "user".
    path: 'user/:userId',
    loadComponent: () =>
      import('./profile-create.component').then(m => m.ProfileCreateComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./profile-detail.component').then(m => m.ProfileDetailComponent),
  },
];
