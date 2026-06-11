import { Routes } from '@angular/router';

export const ONBOARDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./onboarding-list.component').then(m => m.OnboardingListComponent),
  },
  {
    path: 'success',
    loadComponent: () =>
      import('./onboarding-success.component').then(m => m.OnboardingSuccessComponent),
  },
  {
    path: ':candidateId',
    loadComponent: () =>
      import('./onboarding-form.component').then(m => m.OnboardingFormComponent),
  },
];
