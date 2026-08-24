import { Routes } from '@angular/router';

/** `/rh/missions` — the manager's own list. Gated on RH_CREATE_MISSION in `app.routes`. */
export const MISSIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./missions-list.component').then(m => m.MissionsListComponent),
  },
];
