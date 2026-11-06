import {
  Component, OnInit, computed, effect, inject, output, signal, viewChild,
} from '@angular/core';
import { PageComponent, PageHeaderComponent, BreadcrumbItem } from '@khalilrebhiitec/daf360';

import { RoleListComponent }        from './role-list.component';
import { RoleEditorComponent }      from './role-editor/role-editor.component';
import { CreateRoleModalComponent } from './create-role-modal/create-role-modal.component';
import { RoleManagementService }    from './role-management.service';
import { RoleListItem }             from './role.model';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { roleLabel } from '../../../shared/utils/admin-label.utils';
import { PageGuideComponent } from '../../../shared/guide/page-guide.component';
import { GuideStep } from '../../../shared/guide/page-guide.types';

/**
 * Guide of the « Rôles & Permissions » card, started from « Aide & guides ». Two sets:
 * the list, or — when a role is open — its three tabs (`tab` = a role-editor tab id).
 */
const LIST_STEPS: GuideStep[] = [
  { icon: 'admin_panel_settings', titleKey: 'ADMIN_ROLES_GUIDE.WELCOME.TITLE', textKey: 'ADMIN_ROLES_GUIDE.WELCOME.TEXT' },
  { icon: 'search', titleKey: 'ADMIN_ROLES_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_ROLES_GUIDE.TOOLBAR.TEXT', target: 'roles-toolbar' },
  { icon: 'add', titleKey: 'ADMIN_ROLES_GUIDE.NEW.TITLE', textKey: 'ADMIN_ROLES_GUIDE.NEW.TEXT', target: 'roles-new' },
  { icon: 'table_rows', titleKey: 'ADMIN_ROLES_GUIDE.TABLE.TITLE', textKey: 'ADMIN_ROLES_GUIDE.TABLE.TEXT', target: 'roles-table' },
  { icon: 'help', titleKey: 'ADMIN_ROLES_GUIDE.END.TITLE', textKey: 'ADMIN_ROLES_GUIDE.END_LIST.TEXT' },
];
const ROLE_STEPS: GuideStep[] = [
  { icon: 'admin_panel_settings', titleKey: 'ADMIN_ROLES_GUIDE.ROLE.TITLE', textKey: 'ADMIN_ROLES_GUIDE.ROLE.TEXT', target: 'role-tabs', tab: 'info' },
  { icon: 'badge', titleKey: 'ADMIN_ROLES_GUIDE.INFO.TITLE', textKey: 'ADMIN_ROLES_GUIDE.INFO.TEXT', target: 'role-panel', tab: 'info' },
  { icon: 'public', titleKey: 'ADMIN_ROLES_GUIDE.SCOPE.TITLE', textKey: 'ADMIN_ROLES_GUIDE.SCOPE.TEXT', target: 'role-panel', tab: 'info' },
  { icon: 'delete', titleKey: 'ADMIN_ROLES_GUIDE.DELETE.TITLE', textKey: 'ADMIN_ROLES_GUIDE.DELETE.TEXT', target: 'role-panel', tab: 'info' },
  { icon: 'key', titleKey: 'ADMIN_ROLES_GUIDE.PERMISSIONS.TITLE', textKey: 'ADMIN_ROLES_GUIDE.PERMISSIONS.TEXT', target: 'role-panel', tab: 'permissions' },
  { icon: 'group', titleKey: 'ADMIN_ROLES_GUIDE.USERS.TITLE', textKey: 'ADMIN_ROLES_GUIDE.USERS.TEXT', target: 'role-panel', tab: 'users' },
  { icon: 'help', titleKey: 'ADMIN_ROLES_GUIDE.END.TITLE', textKey: 'ADMIN_ROLES_GUIDE.END.TEXT' },
];

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [RoleListComponent, RoleEditorComponent, CreateRoleModalComponent, PageComponent, PageHeaderComponent, TranslatePipe, PageGuideComponent],
  templateUrl: './role-management.component.html',
  styleUrl: './role-management.component.scss',
})
export class RoleManagementComponent implements OnInit {
  private svc = inject(RoleManagementService);
  private translate = inject(TranslateService);

  /** A role's name in the UI language (title + breadcrumb). */
  roleName(r: RoleListItem): string {
    return roleLabel(r, this.translate);
  }

  // Lets the admin shell's own "Administration" breadcrumb crumb jump back to its module grid.
  backToAdmin = output<void>();

  // Tells the admin shell to hide its own "Administration › Rôles et permissions" breadcrumb
  // while a role is open — our own 3-level breadcrumb already includes both those crumbs.
  roleDetailOpen = output<boolean>();

  private readonly editor = viewChild(RoleEditorComponent);

  /** The list's guide, or the open role's (its three tabs). */
  readonly guideSteps = computed(() => (this.selectedRole() ? ROLE_STEPS : LIST_STEPS));

  /** A role step asks for its tab: the editor switches to it. */
  onGuideTab(id: string): void {
    this.editor()?.onTabChange(id);
  }

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
