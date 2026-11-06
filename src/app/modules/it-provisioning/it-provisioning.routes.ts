import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../shared/guards/unsaved-changes.guard';

export const IT_PROVISIONING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./it-provisioning-list.component').then(m => m.ItProvisioningListComponent),
  },
  {
    // Before ':id' — otherwise "historique" would be read as a file id.
    path: 'historique',
    loadComponent: () =>
      import('./it-provisioning-history.component').then(m => m.ItProvisioningHistoryComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./it-provisioning-form.component').then(m => m.ItProvisioningFormComponent),
    // Asks before leaving with typed values that were never saved.
    canDeactivate: [unsavedChangesGuard],
  },
];
