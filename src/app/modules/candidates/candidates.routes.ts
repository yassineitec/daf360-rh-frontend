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
  /*
   * 'hiring-approvals' is gone. It was a second inbox over the SAME endpoints as
   * /finance/cost/approval, no navigation ever linked to it, and it was the weaker of the
   * two — it could approve or reject but never send the counter-proposal, which the finance
   * queue does. Hiring costs are decided in one place now.
   */
  {
    path: ':id',
    loadComponent: () =>
      import('./candidate-detail.component').then(m => m.CandidateDetailComponent),
  },
];
