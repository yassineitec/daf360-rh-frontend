import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/hr/profiles', pathMatch: 'full' },

  // Portal redirects here after successful OAuth2 login.
  // This component re-loads /api/me and then navigates into the app.
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./core/auth-callback.component').then(m => m.AuthCallbackComponent),
  },

  {
    path: 'hr',
    loadComponent: () =>
      import('./layout/hr-shell.component').then(m => m.HrShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'profiles', pathMatch: 'full' },
      {
        path: 'profiles',
        loadChildren: () =>
          import('./modules/profiles/profiles.routes').then(m => m.PROFILES_ROUTES),
      },
      {
        path: 'candidates',
        loadChildren: () =>
          import('./modules/candidates/candidates.routes').then(m => m.CANDIDATES_ROUTES),
      },
      {
        path: 'recrutement',
        loadChildren: () =>
          import('./modules/recruitment-pipeline/recruitment-pipeline.routes').then(m => m.RECRUITMENT_PIPELINE_ROUTES),
      },
      {
        path: 'it-provisioning',
        loadChildren: () =>
          import('./modules/it-provisioning/it-provisioning.routes').then(m => m.IT_PROVISIONING_ROUTES),
      },
      {
        path: 'onboarding',
        loadChildren: () =>
          import('./modules/onboarding/onboarding.routes').then(m => m.ONBOARDING_ROUTES),
      },
      {
        path: 'leave',
        loadChildren: () =>
          import('./modules/leave/leave.routes').then(m => m.LEAVE_ROUTES),
      },
      {
        path: 'lifecycle',
        loadChildren: () =>
          import('./modules/lifecycle/lifecycle.routes').then(m => m.LIFECYCLE_ROUTES),
      },
      {
        path: 'requests',
        loadChildren: () =>
          import('./modules/requests/requests.routes').then(m => m.REQUESTS_ROUTES),
      },
      {
        path: 'recruitment-demands',
        loadChildren: () =>
          import('./modules/recruitment-demands/recruitment-demands.routes').then(m => m.RECRUITMENT_DEMANDS_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./modules/admin/admin.routes').then(m => m.ADMIN_ROUTES),
      },
    ],
  },

  { path: '**', redirectTo: '/hr/profiles' },
];
