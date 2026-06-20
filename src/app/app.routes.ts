import { Routes } from '@angular/router';
import { provideEnvironmentInitializer, inject } from '@angular/core';
import { HrShellComponent } from './layout/hr-shell.component';
import { authGuard } from './core/auth.guard';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { rhProfilesReducer } from './store/profiles.reducer';
import { ProfilesEffects } from './store/profiles.effects';
import { TranslateService } from '@ngx-translate/core';

import en from '@public/assets/i18n/en.json';
import fr from '@public/assets/i18n/fr.json';
import ar from '@public/assets/i18n/ar.json';

function registerTranslations(): void {
  const translate = inject(TranslateService);
  translate.setTranslation('fr', fr, true);
  translate.setTranslation('en', en, true);
  translate.setTranslation('ar', ar, true);
}

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Portal redirects here after successful OAuth2 login.
  // This component re-loads /api/me and then navigates into the app.
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./core/auth-callback.component').then(m => m.AuthCallbackComponent),
  },

  {
    path: '',
    component: HrShellComponent,
    canActivate: [authGuard],
    providers: [
      provideState('rh', rhProfilesReducer),
      provideEffects([ProfilesEffects]),
      // Fires when this route's environment injector is created — in both
      // standalone mode (supplements the InlineTranslateLoader from appConfig)
      // and federated mode (injects RH translations into the shell's singleton
      // TranslateService, which never ran appConfig).
      provideEnvironmentInitializer(() => registerTranslations()),
    ],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./modules/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
      },
      {
        path: 'profiles',
        loadChildren: () =>
          import('./modules/profiles/profiles.routes').then(m => m.PROFILES_ROUTES),
      },
      {
        path: 'candidates',
        loadChildren: () =>
          import('./modules/candidates/candidates.routes').then(m => m.candidatesRoutes),
      },
      {
        path: 'recrutement',
        loadChildren: () =>
          import('./modules/pipeline/pipeline.routes').then(m => m.pipelineRoutes),
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
        path: 'admin',
        loadChildren: () =>
          import('./modules/admin/admin.routes').then(m => m.ADMIN_ROUTES),
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
