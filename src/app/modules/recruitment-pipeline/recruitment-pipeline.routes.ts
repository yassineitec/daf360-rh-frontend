import { Routes } from '@angular/router';

export const RECRUITMENT_PIPELINE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./recruitment-pipeline.component').then(m => m.RecruitmentPipelineComponent),
  },
];
