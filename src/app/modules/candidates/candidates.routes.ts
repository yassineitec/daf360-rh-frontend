import { Routes } from '@angular/router';

export const candidatesRoutes: Routes = [
  {
    // Landing = the design Kanban board (Screening/Entretien/Offre/Recruté),
    // fed by /api/hr/pipeline/kanban. Lives in the pipeline module; the current
    // status-kanban (CandidatesComponent) now serves the "Pipeline RH" route.
    path: '',
    loadComponent: () =>
      import('../pipeline/pipeline.component').then(m => m.PipelineComponent),
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
