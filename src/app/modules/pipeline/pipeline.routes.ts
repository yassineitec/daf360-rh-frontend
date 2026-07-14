import { Routes } from '@angular/router';

export const pipelineRoutes: Routes = [
  {
    // "Pipeline RH" page = the current candidate status-kanban (5 columns,
    // native drag-drop, /api/hr/candidates). Component lives in the candidates
    // module; the design Kanban (PipelineComponent) now serves the /candidates route.
    path: '',
    loadComponent: () =>
      import('../candidates/candidates.component').then(m => m.CandidatesComponent),
  },
];
