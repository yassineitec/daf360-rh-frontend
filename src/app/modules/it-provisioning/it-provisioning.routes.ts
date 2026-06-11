import { Routes } from '@angular/router';

export const IT_PROVISIONING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./it-provisioning-list.component').then(m => m.ItProvisioningListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./it-provisioning-form.component').then(m => m.ItProvisioningFormComponent),
  },
];
