import { Routes } from '@angular/router';

/**
 * `/rh/billeterie` — RH's desk. Gated on RH_MANAGE_MISSION_BILLETERIE in `app.routes`.
 */
export const BILLETERIE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./billeterie.component').then(m => m.BilleterieComponent),
  },
];
