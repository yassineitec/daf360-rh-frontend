import { Component } from '@angular/core';
import { RoleManagementComponent } from './roles/role-management.component';

@Component({
  selector: 'app-roles-admin',
  standalone: true,
  imports: [RoleManagementComponent],
  template: '<app-role-management />',
})
export class RolesAdminComponent {}
