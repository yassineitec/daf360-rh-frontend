import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TabItem, TabsComponent } from '@khalilrebhiitec/daf360';
import { RoleListItem } from '../role.model';
import { RoleInfoTabComponent } from '../role-info-tab/role-info-tab.component';
import { RolePermissionsTabComponent } from '../role-permissions-tab/role-permissions-tab.component';
import { RoleUsersTabComponent } from '../role-users-tab/role-users-tab.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

type RoleEditorTab = 'info' | 'permissions' | 'users';

@Component({
  selector: 'app-role-editor',
  standalone: true,
  imports: [RoleInfoTabComponent, RolePermissionsTabComponent, RoleUsersTabComponent, TabsComponent, TranslatePipe],
  templateUrl: './role-editor.component.html',
  styleUrl: './role-editor.component.scss',
})
export class RoleEditorComponent {
  private translate = inject(TranslateService);

  role     = input.required<RoleListItem>();
  allRoles = input<RoleListItem[]>([]);
  activeTab = signal<RoleEditorTab>('info');

  onRoleUpdated = output<RoleListItem>();
  onRoleDeleted = output<number>();

  // Only tracks the role ID — changes to permissions/userCount on the SAME role
  // do NOT trigger this computed, so the tab never resets mid-edit.
  private readonly _roleId = computed(() => this.role().id);

  readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    return [
      { id: 'info',        label: this.translate.instant('ADMIN.roles.editor.TAB_INFO') },
      { id: 'permissions', label: this.translate.instant('ADMIN.roles.editor.TAB_PERMISSIONS') },
      { id: 'users',       label: this.translate.instant('ADMIN.roles.editor.TAB_USERS'), count: this.role().userCount },
    ];
  });

  constructor() {
    effect(() => {
      this._roleId(); // react only to role ID changes
      untracked(() => this.activeTab.set('info'));
    });
  }

  onTabChange(id: string): void {
    this.activeTab.set(id as RoleEditorTab);
  }

  onUsersChanged(count: number): void {
    // Propagate updated userCount to parent without full reload
    this.onRoleUpdated.emit({ ...this.role(), userCount: count });
  }
}
