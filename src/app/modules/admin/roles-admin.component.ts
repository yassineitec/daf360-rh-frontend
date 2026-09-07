import { Component, output } from '@angular/core';
import { RoleManagementComponent } from './roles/role-management.component';

@Component({
  selector: 'app-roles-admin',
  standalone: true,
  imports: [RoleManagementComponent],
  template: '<app-role-management (backToAdmin)="backToAdmin.emit()" (roleDetailOpen)="roleDetailOpen.emit($event)" />',
})
export class RolesAdminComponent {
  backToAdmin = output<void>();
  roleDetailOpen = output<boolean>();
}
