import { Routes } from '@angular/router';
export const ADMIN_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./admin.component').then(m => m.AdminComponent) },
  { path: 'lists', loadComponent: () => import('./lists/list-manager.component').then(m => m.ListManagerComponent) },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./notifications/notification-routing.component').then(m => m.NotificationRoutingComponent),
  },
];
