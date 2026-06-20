import { Routes } from '@angular/router';

export const candidatesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./candidates.component').then(m => m.CandidatesComponent),
  },
  {
    path: 'list',
    loadComponent: () =>
      import('./candidate-list.component').then(m => m.CandidateListComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./candidate-form.component').then(m => m.CandidateFormComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./candidate-detail.component').then(m => m.CandidateDetailComponent),
  },
];
