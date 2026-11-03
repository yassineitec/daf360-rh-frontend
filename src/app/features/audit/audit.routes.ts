import { Routes } from '@angular/router';

/** `/rh/audit` — merged audit_log + audit_trail timeline. Gated in app.routes. */
export const AUDIT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./audit-log.component').then(m => m.AuditLogComponent),
  },
];
