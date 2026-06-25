import { Routes } from '@angular/router';

export const RECRUITMENT_DEMANDS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./recruitment-demand-list.component').then(m => m.RecruitmentDemandListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./recruitment-demand-detail.component').then(m => m.RecruitmentDemandDetailComponent),
  },
];
