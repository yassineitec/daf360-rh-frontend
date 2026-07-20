import {
  Component, OnInit, inject, signal,
} from '@angular/core';

import { RoleListComponent }        from './role-list.component';
import { RoleEditorComponent }      from './role-editor/role-editor.component';
import { CreateRoleModalComponent } from './create-role-modal/create-role-modal.component';
import { ModalComponent }           from '../../../shared/modal.component';
import { RoleManagementService }    from './role-management.service';
import { RoleListItem }             from './role.model';
import { TranslateService }         from '@ngx-translate/core';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [RoleListComponent, RoleEditorComponent, CreateRoleModalComponent, ModalComponent],
  templateUrl: './role-management.component.html',
  styleUrl: './role-management.component.scss',
})
export class RoleManagementComponent implements OnInit {
  private svc = inject(RoleManagementService);
  private translate = inject(TranslateService);

  roles         = signal<RoleListItem[]>([]);
  selectedRole  = signal<RoleListItem | null>(null);
  loading       = signal(true);
  showCreateModal = signal(false);
  error         = signal<string | null>(null);

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading.set(true);
    this.svc.getRoles().subscribe({
      next:  (r) => { this.roles.set(r); this.loading.set(false); },
      error: ()  => { this.loading.set(false); this.error.set(this.translate.instant('ADMIN.roles.management.LOAD_ERROR')); },
    });
  }

  onRoleSelected(role: RoleListItem): void { this.selectedRole.set(role); }

  onRoleUpdated(updated: RoleListItem): void {
    this.roles.update(rs => rs.map(r => r.id === updated.id ? updated : r));
    this.selectedRole.set(updated);
  }

  onRoleDeleted(id: number): void {
    this.roles.update(rs => rs.filter(r => r.id !== id));
    this.selectedRole.set(null);
  }

  onRoleCreated(role: RoleListItem): void {
    this.roles.update(rs => [...rs, role].sort((a, b) => a.frenchName.localeCompare(b.frenchName)));
    this.selectedRole.set(role);
  }
}
