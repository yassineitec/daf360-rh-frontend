import { Routes } from '@angular/router';
import { permissionGuard } from '@khalilrebhiitec/daf360';

/**
 * Télétravail, inside the RH module — the same four queues as the autorisations.
 *
 * Each route demands the permission its API enforces. The codes are the CONGÉ codes,
 * unchanged: the timesheet gated télétravail on exactly the same set, so nobody needs a
 * grant and nobody gains a right.
 *
 * The employee's own REQUEST FORM is not here: it lives on the shell's self-service page.
 */
export const TELETRAVAIL_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'queue' },
  {
    path: 'queue',
    canActivate: [permissionGuard],
    data: { permissions: ['GET_LEAVES', 'RESPONSE_LEAVE'], scope: 'queue' },
    loadComponent: () => import('./teletravail-list.component').then(m => m.TeletravailListComponent),
  },
  {
    path: 'mine',
    canActivate: [permissionGuard],
    data: { permissions: ['ADD_LEAVE', 'GET_LEAVES'], scope: 'mine' },
    loadComponent: () => import('./teletravail-list.component').then(m => m.TeletravailListComponent),
  },
  {
    path: 'team',
    canActivate: [permissionGuard],
    data: { permissions: ['GET_EMPLOYEES_LEAVES'], scope: 'team' },
    loadComponent: () => import('./teletravail-list.component').then(m => m.TeletravailListComponent),
  },
  {
    path: 'global',
    canActivate: [permissionGuard],
    data: { permissions: ['GET_GLOBAL_LEAVES'], scope: 'global' },
    loadComponent: () => import('./teletravail-list.component').then(m => m.TeletravailListComponent),
  },
];
