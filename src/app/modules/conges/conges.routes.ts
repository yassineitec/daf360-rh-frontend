import { Routes } from '@angular/router';
import { permissionGuard } from '@khalilrebhiitec/daf360';

/**
 * Congés, inside the RH module.
 *
 * Each route demands the permission its API enforces, so a link can never reach a page whose
 * every call would 403. `permissionGuard` defaults to mode 'any' — a route listing two codes
 * needs one of them.
 *
 * The employee's OWN request is not here: it lives on the shell's self-service page, which is
 * where an employee looks for things they do rather than things they administer.
 */
export const CONGES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'inbox',
  },
  {
    /** Where a submitted request lands. Anyone who may read congés sees their own queue. */
    path: 'inbox',
    canActivate: [permissionGuard],
    data: { permissions: ['GET_LEAVES', 'RESPONSE_LEAVE'] },
    loadComponent: () =>
      import('./conge-inbox.component').then(m => m.CongeInboxComponent),
  },
  {
    /**
     * Régularisations — filing a congé on someone else's behalf, and the record of those
     * already filed. SETTLE_LEAVES, the same code the two endpoints enforce.
     */
    path: 'settle',
    canActivate: [permissionGuard],
    data: { permissions: ['SETTLE_LEAVES'] },
    loadComponent: () =>
      import('./conge-settle.component').then(m => m.CongeSettleComponent),
  },
  {
    /** A manager's team, resolved down the role hierarchy. */
    path: 'team',
    canActivate: [permissionGuard],
    data: { permissions: ['GET_EMPLOYEES_LEAVES'], scope: 'team' },
    loadComponent: () =>
      import('./conge-history.component').then(m => m.CongeHistoryComponent),
  },
  // Administering the catalogue is NOT here. It is an Administration tab
  // (`/rh/admin?tab=absence-types`), with the holidays, the request types and the other
  // configurable lists — the screen answers "what is a congé", not "who is off next week",
  // and that is a different question from the three above.
  //
  // The redirect keeps any link written while it briefly lived at this path working.
  { path: 'types', redirectTo: '/admin?tab=absence-types' },
  {
    /** Country-wide. The one screen that also filters by leave type. */
    path: 'global',
    canActivate: [permissionGuard],
    data: { permissions: ['GET_GLOBAL_LEAVES'], scope: 'global' },
    loadComponent: () =>
      import('./conge-history.component').then(m => m.CongeHistoryComponent),
  },
];
