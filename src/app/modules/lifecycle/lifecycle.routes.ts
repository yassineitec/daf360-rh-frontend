import { Routes } from '@angular/router';

export const LIFECYCLE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lifecycle-dashboard.component').then(m => m.LifecycleDashboardComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./workflow-detail.component').then(m => m.WorkflowDetailComponent),
  },
];
