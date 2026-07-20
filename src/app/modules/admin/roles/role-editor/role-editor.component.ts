import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { RoleListItem } from '../role.model';
import { RoleInfoTabComponent } from '../role-info-tab/role-info-tab.component';
import { RolePermissionsTabComponent } from '../role-permissions-tab/role-permissions-tab.component';
import { RoleUsersTabComponent } from '../role-users-tab/role-users-tab.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-role-editor',
  standalone: true,
  imports: [RoleInfoTabComponent, RolePermissionsTabComponent, RoleUsersTabComponent, TranslatePipe],
  templateUrl: './role-editor.component.html',
  styleUrl: './role-editor.component.scss',
})
export class RoleEditorComponent {
  role     = input.required<RoleListItem>();
  allRoles = input<RoleListItem[]>([]);
  activeTab = signal<'info' | 'permissions' | 'users'>('info');

  onRoleUpdated = output<RoleListItem>();
  onRoleDeleted = output<number>();

  // Only tracks the role ID — changes to permissions/userCount on the SAME role
  // do NOT trigger this computed, so the tab never resets mid-edit.
  private readonly _roleId = computed(() => this.role().id);

  constructor() {
    effect(() => {
      this._roleId(); // react only to role ID changes
      untracked(() => this.activeTab.set('info'));
    });
  }

  onUsersChanged(count: number): void {
    // Propagate updated userCount to parent without full reload
    this.onRoleUpdated.emit({ ...this.role(), userCount: count });
  }
}
