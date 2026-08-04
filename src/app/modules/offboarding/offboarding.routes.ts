import { Routes } from '@angular/router';

export const OFFBOARDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./offboarding-list.component').then(m => m.OffboardingListComponent),
  },
  /**
   * One departure reason — the sidebar's sub-entries ("Démission", and the other six
   * once they are added). The SAME list component, scoped by the route param: the
   * board, the table, the cards and the KPIs are identical, only the population differs.
   *
   * Declared BEFORE `:id` and as two segments, so it can never be swallowed by the
   * detail route. The param carries the reason CODE, not a slug, so this keeps working
   * unchanged when departure reasons become a configurable reference table.
   */
  {
    path: 'type/:reason',
    loadComponent: () =>
      import('./offboarding-list.component').then(m => m.OffboardingListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./offboarding-detail.component').then(m => m.OffboardingDetailComponent),
  },
];
