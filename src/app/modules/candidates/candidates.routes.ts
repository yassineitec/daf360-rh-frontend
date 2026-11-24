import { Routes } from '@angular/router';
import { permissionGuard } from '@khalilrebhiitec/daf360';
import { candidateDetailGuard } from './candidate-detail.guard';

/** What the parent `candidates` route used to require — now set on each list page. */
const CANDIDATE_PERMISSIONS = ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'];

export const candidatesRoutes: Routes = [
  {
    // The « Candidats » page: title, « Nouveau candidat », KPIs and the tab strip are drawn
    // once by the shell; a tab click only swaps the child below. Same URLs as before. The
    // child paths come before ':id' (an empty-path parent whose children do not match falls
    // through to the siblings), so « historique » / « archives » are never read as an id.
    path: '',
    canActivate: [permissionGuard],
    data: { permissions: CANDIDATE_PERMISSIONS },
    loadComponent: () =>
      import('../pipeline/candidates-page.component').then(m => m.CandidatesPageComponent),
    children: [
      {
        // Kanban — the candidature board, fed by /api/hr/pipeline/kanban.
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('../pipeline/pipeline.component').then(m => m.PipelineComponent),
      },
      {
        path: 'historique',
        loadComponent: () =>
          import('../pipeline/candidates-history.component').then(m => m.CandidatesHistoryComponent),
      },
      {
        // « Archivés » tab (V137).
        path: 'archives',
        loadComponent: () =>
          import('../pipeline/candidates-archived.component').then(m => m.CandidatesArchivedComponent),
      },
    ],
  },
  {
    path: 'list',
    canActivate: [permissionGuard],
    data: { permissions: CANDIDATE_PERMISSIONS },
    loadComponent: () =>
      import('./candidate-list.component').then(m => m.CandidateListComponent),
  },
  {
    path: 'new',
    canActivate: [permissionGuard],
    data: { permissions: CANDIDATE_PERMISSIONS },
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
    // The permissions above, OR a member of one of this candidate's interview panels (V132).
    path: ':id',
    canActivate: [candidateDetailGuard],
    loadComponent: () =>
      import('./candidate-detail.component').then(m => m.CandidateDetailComponent),
  },
];
