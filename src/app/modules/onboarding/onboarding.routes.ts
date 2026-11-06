import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../shared/guards/unsaved-changes.guard';

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
    // Asks before leaving with a draft, a photo or a certificate that were never saved.
    canDeactivate: [unsavedChangesGuard],
  },
];
