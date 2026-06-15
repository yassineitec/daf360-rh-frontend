import { Routes } from '@angular/router';

export const candidatesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./candidates.component').then(m => m.CandidatesComponent),
  },
];
