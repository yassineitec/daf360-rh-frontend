import { Routes } from '@angular/router';

export const pipelineRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pipeline.component').then(m => m.PipelineComponent),
  },
];
