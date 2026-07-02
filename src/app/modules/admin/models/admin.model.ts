// ─────────────────────────────────────────────────────────────────────────────
// Role & permissions
// ─────────────────────────────────────────────────────────────────────────────
export interface Role {
  id:           number;
  frenchName:   string;
  englishName:  string;
  parentRoleId: number | null;
  showAll:      boolean | null;
  permissions:  string[];
}

/**
 * The 46 allowed permission values from CK_RolePermissions_Permission.
 * Grouped for UI display. Must stay in sync with the DB constraint.
 */
export const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  { label: 'Événements',        permissions: ['MANAGE_EVENTS'] },
  { label: 'Utilisateurs',      permissions: ['CREATE_USER','GET_USERS','UPDATE_USER','DELETE_USER'] },
  { label: 'Pays',              permissions: ['GET_PAYS','CREATE_PAYS','UPDATE_PAYS','DELETE_PAYS'] },
  { label: 'Jours fériés',      permissions: ['GET_HOLIDAYS','CREATE_HOLIDAY','UPDATE_HOLIDAY','DELETE_HOLIDAY'] },
  { label: 'Rôles & Permissions',permissions: ['GET_PERMISSIONS','GET_ROLES','CREATE_ROLE','UPDATE_ROLE','DELETE_ROLE'] },
  { label: 'Congés',            permissions: ['GET_LEAVES','ADD_LEAVE','RESPONSE_LEAVE','GET_GLOBAL_LEAVES','SETTLE_LEAVES'] },
  { label: 'Catégories',        permissions: ['GET_CATEGORIES','CREATE_CATEGORY','UPDATE_CATEGORY','DELETE_CATEGORY'] },
  { label: 'Timesheets',        permissions: ['GET_TSR','CREATE_TSR','RESPOND_TSR','GET_GLOBAL_TSR'] },
  { label: 'Dashboard',         permissions: ['VIEW_DASHBOARD'] },
  { label: 'Consultation',      permissions: ['VIEW_CANDIDATES','VIEW_WORKFLOW','VIEW_NOTIFICATIONS'] },
  { label: 'Module RH',         permissions: ['HR_CREATE_PROFILE','HR_UPDATE_PROFILE','HR_ARCHIVE_PROFILE','HR_ONBOARDING','CREATE_CANDIDATE','EDIT_CANDIDATE','ACCEPT_REJECT_CANDIDATE'] },
  { label: 'Module IT',         permissions: ['IT_PROVISIONING'] },
  { label: 'Administration',    permissions: ['HR_ADMIN_ROLES','ADMIN_EVENTS','ADMIN_LISTS','ADMIN_NOTIFICATIONS','ADMIN_ROLES','ADMIN_REGIMES','ADMIN_BREAKS'] },
];

export const ALL_PERMISSIONS: string[] =
  PERMISSION_GROUPS.flatMap(g => g.permissions);

// ─────────────────────────────────────────────────────────────────────────────
// Permission checklist store — pure class, no Angular deps → fully unit-testable
// ─────────────────────────────────────────────────────────────────────────────
export class PermissionChecklistStore {
  private _selected: Set<string>;

  constructor(initial: string[] = []) {
    this._selected = new Set(initial);
  }

  init(perms: string[]): void      { this._selected = new Set(perms); }
  toggle(p: string): void          { this._selected.has(p) ? this._selected.delete(p) : this._selected.add(p); }
  selectAll(perms: string[]): void { perms.forEach(p => this._selected.add(p)); }
  clearAll(): void                 { this._selected.clear(); }
  isSelected(p: string): boolean   { return this._selected.has(p); }
  getSelected(): string[]          { return Array.from(this._selected).sort(); }
  count(): number                  { return this._selected.size; }

  isDirty(original: string[]): boolean {
    const orig = new Set(original);
    if (orig.size !== this._selected.size) return true;
    for (const p of this._selected) if (!orig.has(p)) return true;
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parameter sets
// ─────────────────────────────────────────────────────────────────────────────
export interface ParameterSet {
  id:          number;
  paysId:      number;
  cle:         string;
  valeur:      string;
  description: string | null;
  updatedAt:   string;
}

export interface ParameterDto {
  paysId:      number;
  cle:         string;
  valeur:      string;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Holidays
// ─────────────────────────────────────────────────────────────────────────────
export interface Holiday {
  id:           number;
  paysId:       number;
  dateHoliday:  string;
  frenchLabel:  string;
  englishLabel: string;
  isRecurring:  boolean;
}

export interface HolidayDto {
  paysId:       number;
  dateHoliday:  string;
  frenchLabel:  string;
  englishLabel: string;
  isRecurring?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request type catalog
// ─────────────────────────────────────────────────────────────────────────────
export interface RequestTypeCatalog {
  id:                  number;
  paysId:              number;
  typeCode:            string;
  displayNameFr:       string;
  displayNameEn:       string;
  description:         string | null;
  category:            string;
  approvalLevel:       'L1' | 'L2';
  defaultSlaDays:      number;
  documentTemplateUrl: string | null;
  isActive:            boolean;
}

export interface RequestTypeDto {
  paysId:       number;
  typeCode:     string;
  displayNameFr: string;
  displayNameEn: string;
  description?:  string;
  category:     string;
  approvalLevel: 'L1' | 'L2';
  defaultSlaDays: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Working time regime
// ─────────────────────────────────────────────────────────────────────────────
export interface WorkingTimeRegime {
  id:           number;
  paysId:       number;
  code:         string;
  labelFr:      string;
  labelEn:      string;
  hoursPerWeek: number;
  daysPerWeek:  number;
  startTime:    string | null;
  endTime:      string | null;
  isFlexible:   boolean;
  isDefault:    boolean;
  isActive:     boolean;
}

export interface RegimeDto {
  paysId:       number;
  code:         string;
  labelFr:      string;
  labelEn:      string;
  hoursPerWeek: number;
  daysPerWeek:  number;
  startTime?:   string;
  endTime?:     string;
  isFlexible?:  boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin tabs
// ─────────────────────────────────────────────────────────────────────────────
export type AdminTab = 'roles' | 'parameters' | 'holidays' | 'request-types' | 'regimes' | 'lists' | 'notifications' | 'breaks' | 'ref-data' | 'overtime' | 'interview-types';
