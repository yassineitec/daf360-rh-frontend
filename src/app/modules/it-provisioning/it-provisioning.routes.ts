import { Routes } from '@angular/router';

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
  },
];
