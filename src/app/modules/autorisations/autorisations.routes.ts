import { Routes } from '@angular/router';
import { permissionGuard } from '@khalilrebhiitec/daf360';

/**
 * Autorisations, inside the RH module.
 *
 * Each route demands the permission its API enforces, so a link can never reach a page whose
 * every call would 403. The codes are the CONGÉ codes, unchanged — the timesheet gated this
 * module on exactly the same set, so nobody needs a grant and nobody gains a right.
 *
 * The employee's own REQUEST FORM is not here: it lives on the shell's self-service page,
 * which is where an employee looks for things they do rather than things they administer.
 * `mine` here is the read-only history for someone working inside the RH module.
 */
export const AUTORISATIONS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'queue',
  },
  {
    /** Where a submitted request lands — the only screen that decides. */
    path: 'queue',
    canActivate: [permissionGuard],
    data: { permissions: ['GET_LEAVES', 'RESPONSE_LEAVE'], scope: 'queue' },
    loadComponent: () =>
      import('./autorisation-list.component').then(m => m.AutorisationListComponent),
  },
  {
    /** The caller's own, whatever their role. */
    path: 'mine',
    canActivate: [permissionGuard],
    data: { permissions: ['ADD_LEAVE', 'GET_LEAVES'], scope: 'mine' },
    loadComponent: () =>
      import('./autorisation-list.component').then(m => m.AutorisationListComponent),
  },
  {
    /** A manager's team, resolved down the role hierarchy. */
    path: 'team',
    canActivate: [permissionGuard],
    data: { permissions: ['GET_EMPLOYEES_LEAVES'], scope: 'team' },
    loadComponent: () =>
      import('./autorisation-list.component').then(m => m.AutorisationListComponent),
  },
  {
    /** Country-wide, bounded by the caller's role pays scope. The one that may archive. */
    path: 'global',
    canActivate: [permissionGuard],
    data: { permissions: ['GET_GLOBAL_LEAVES'], scope: 'global' },
    loadComponent: () =>
      import('./autorisation-list.component').then(m => m.AutorisationListComponent),
  },
];
