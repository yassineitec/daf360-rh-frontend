export interface RoleListItem {
  id: number;
  frenchName: string;
  englishName: string | null;
  parentRoleId: number | null;
  parentRoleName: string | null;
  showAll: boolean;
  permissions: string[];        // full permission list (from existing API response)
  permissionCount: number;
  userCount: number;
}

export interface PermissionCodeItem { code: string; label: string; }
export interface PermissionGroup    { groupName: string; permissions: PermissionCodeItem[]; }

export interface CreateRoleRequest {
  frenchName: string;
  parentRoleId?: number | null;
  showAll?: boolean;
  permissions?: string[];
}

export interface UpdateRoleRequest {
  frenchName?: string;
  parentRoleId?: number | null;
  showAll?: boolean;
  forceRename?: boolean;
}

export interface RoleUserItem {
  userId: number;
  fullName: string;
  email: string;
  paysId: number;
  paysLabel: string | null;
  currentRoleName: string | null;  // populated in search results only
}
