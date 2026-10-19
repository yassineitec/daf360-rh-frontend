import { Routes } from '@angular/router';

/**
 * `/rh/cdi-conversions` — the CIVP → CDI requests desk. `:id` opens the same page with that
 * request's drawer, which is where the notification deep links land.
 */
export const CDI_CONVERSIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./cdi-conversions.component').then(m => m.CdiConversionsComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./cdi-conversions.component').then(m => m.CdiConversionsComponent),
  },
];
