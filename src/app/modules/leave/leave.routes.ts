import { Routes } from '@angular/router';
export const LEAVE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./leave.component').then(m => m.LeaveComponent) },
];
