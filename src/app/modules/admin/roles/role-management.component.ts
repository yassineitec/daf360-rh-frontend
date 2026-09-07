import {
  Component, OnInit, effect, inject, output, signal,
} from '@angular/core';
import { PageComponent, PageHeaderComponent, BreadcrumbItem } from '@khalilrebhiitec/daf360';

import { RoleListComponent }        from './role-list.component';
import { RoleEditorComponent }      from './role-editor/role-editor.component';
import { CreateRoleModalComponent } from './create-role-modal/create-role-modal.component';
import { RoleManagementService }    from './role-management.service';
import { RoleListItem }             from './role.model';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [RoleListComponent, RoleEditorComponent, CreateRoleModalComponent, PageComponent, PageHeaderComponent, TranslatePipe],
  templateUrl: './role-management.component.html',
  styleUrl: './role-management.component.scss',
})
export class RoleManagementComponent implements OnInit {
  private svc = inject(RoleManagementService);
  private translate = inject(TranslateService);

  // Lets the admin shell's own "Administration" breadcrumb crumb jump back to its module grid.
  backToAdmin = output<void>();

  // Tells the admin shell to hide its own "Administration › Rôles et permissions" breadcrumb
  // while a role is open — our own 3-level breadcrumb already includes both those crumbs.
  roleDetailOpen = output<boolean>();

  roles         = signal<RoleListItem[]>([]);
  selectedRole  = signal<RoleListItem | null>(null);
  loading       = signal(true);
  error         = signal<string | null>(null);

  constructor() {
    effect(() => this.roleDetailOpen.emit(!!this.selectedRole()));
  }

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

  /** The "Rôles et permissions" crumb goes back to the list; "Administration" goes up to the module grid. */
  onBreadcrumbNavigate(crumb: BreadcrumbItem): void {
    if (crumb.label === this.translate.instant('ADMIN.shell.tabs.roles')) {
      this.selectedRole.set(null);
    } else {
      this.backToAdmin.emit();
    }
  }

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
