import { Routes } from '@angular/router';
import { provideEnvironmentInitializer, inject } from '@angular/core';
import { HrShellComponent } from './layout/hr-shell.component';
import { authGuard } from './core/auth.guard';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { rhProfilesReducer } from './store/profiles.reducer';
import { ProfilesEffects } from './store/profiles.effects';
import { TranslateService, TranslateLoader, provideChildTranslateService } from '@ngx-translate/core';
import { permissionGuard, provideDafAccess } from '@khalilrebhiitec/daf360';
import { InlineTranslateLoader } from './core/inline-translate.loader';
import { environment } from '../environments/environment';

import en from '@public/assets/i18n/en.json';
import fr from '@public/assets/i18n/fr.json';
import ar from '@public/assets/i18n/ar.json';

// Eagerly populate the RH translate store so translate.instant() works before the
// first use() completes. Because the shell route provides an *isolated* child
// TranslateService (see providers below), this writes to RH's OWN store — it no
// longer merges into (and clobbers) the shell host's singleton store.
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
      // Isolated TranslateService for the whole RH subtree. It keeps its own
      // translation store (so RH keys never overwrite the shell host's), while
      // use()/currentLang delegate to the root — so RH still follows the shell's
      // active language and language switches. Works in both standalone and
      // federated (mounted-in-shell) modes.
      ...provideChildTranslateService({
        loader: { provide: TranslateLoader, useClass: InlineTranslateLoader },
      }),
      // Populate the isolated store up-front (see registerTranslations above).
      provideEnvironmentInitializer(() => registerTranslations()),
      // Feeds the lib permission guard: unauthenticated → shell login; a permission
      // denial → the shell's /forbidden page (federation shares one Router).
      ...provideDafAccess({
        loginRedirect: () => { window.location.href = environment.shellUrl || '/'; },
        forbiddenRoute: '/forbidden',
      }),
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
        canActivate: [permissionGuard],
        data: { permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'] },
        loadChildren: () =>
          import('./modules/candidates/candidates.routes').then(m => m.candidatesRoutes),
      },
      {
        path: 'recrutement',
        canActivate: [permissionGuard],
        data: { permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE'] },
        loadChildren: () =>
          import('./modules/pipeline/pipeline.routes').then(m => m.pipelineRoutes),
      },
      {
        path: 'it-provisioning',
        canActivate: [permissionGuard],
        data: { permissions: ['IT_PROVISIONING'] },
        loadChildren: () =>
          import('./modules/it-provisioning/it-provisioning.routes').then(m => m.IT_PROVISIONING_ROUTES),
      },
      {
        path: 'onboarding',
        canActivate: [permissionGuard],
        data: { permissions: ['HR_ONBOARDING'] },
        loadChildren: () =>
          import('./modules/onboarding/onboarding.routes').then(m => m.ONBOARDING_ROUTES),
      },
      {
        path: 'leave',
        canActivate: [permissionGuard],
        data: { permissions: ['GET_LEAVES', 'ADD_LEAVE', 'RESPONSE_LEAVE'] },
        loadChildren: () =>
          import('./modules/leave/leave.routes').then(m => m.LEAVE_ROUTES),
      },
      {
        path: 'lifecycle',
        canActivate: [permissionGuard],
        data: { permissions: ['RH_VIEW_CONTRACTS', 'RH_MANAGE_LIFECYCLE'] },
        loadChildren: () =>
          import('./modules/lifecycle/lifecycle.routes').then(m => m.LIFECYCLE_ROUTES),
      },
      {
        path: 'requests',
        canActivate: [permissionGuard],
        data: { permissions: ['HR_UPDATE_PROFILE', 'HR_ADMIN_ROLES'] },
        loadChildren: () =>
          import('./modules/requests/requests.routes').then(m => m.REQUESTS_ROUTES),
      },
      {
        path: 'recruitment-demands',
        canActivate: [permissionGuard],
        data: { permissions: ['RH_VIEW_RECRUITMENT_DEMAND', 'RH_CREATE_RECRUITMENT_DEMAND', 'RH_APPROVE_RECRUITMENT_DEMAND'] },
        loadChildren: () =>
          import('./modules/recruitment-demands/recruitment-demands.routes').then(m => m.RECRUITMENT_DEMANDS_ROUTES),
      },
      {
        path: 'admin',
        canActivate: [permissionGuard],
        data: { permissions: ['ADMIN_ROLES', 'HR_ADMIN_ROLES', 'GET_ROLES', 'ADMIN_LISTS', 'ADMIN_REGIMES', 'ADMIN_BREAKS', 'ADMIN_NOTIFICATIONS'] },
        loadChildren: () =>
          import('./modules/admin/admin.routes').then(m => m.ADMIN_ROUTES),
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
