/**
 * How a role's country (pays) visibility is resolved — mirrors the backend
 * PaysScopeMode enum and the CK_Roles_PaysScopeMode check constraint (V74).
 *
 * OWN  — each holder sees only their own country. Correct for a role shared across
 *        countries, e.g. "Responsable GC" held by Tunisian AND Egyptian users.
 * LIST — every holder sees the same `paysScope` countries, whatever their own.
 * ALL  — no country filter at all.
 */
export type PaysScopeMode = 'OWN' | 'LIST' | 'ALL';

export interface RoleListItem {
  id: number;
  frenchName: string;
  parentRoleId: number | null;
  parentRoleName: string | null;
  /** Legacy flag, kept in sync server-side with paysScopeMode === 'ALL'. */
  showAll: boolean;
  paysScopeMode: PaysScopeMode;
  /** Country ids. Only meaningful when paysScopeMode is 'LIST'. */
  paysScope: number[];
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
  paysScopeMode?: PaysScopeMode;
  paysScope?: number[];
  permissions?: string[];
}

export interface UpdateRoleRequest {
  frenchName?: string;
  parentRoleId?: number | null;
  showAll?: boolean;
  paysScopeMode?: PaysScopeMode;
  /** Omit to leave the country list untouched; [] clears it. */
  paysScope?: number[];
  /** Required by the backend to rename a role that still has users assigned. */
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

/** Subset of GET /api/hr/ref/pays used for the country picker. */
export interface PaysOption {
  id: number;
  isoCode: string | null;
  frenchLabel: string | null;
}
