export interface WorkingTimeRegime {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string;
  descriptionFr?: string;
  hoursPerWeek: number;
  daysPerWeek: number;
  startTime?: string;
  endTime?: string;
  isFlexible: boolean;
  isDefault: boolean;
  isActive: boolean;
  breakDurationMin?: number;
  overtimeAllowed?: boolean;
  maxHoursPerDay?: number;
  paysId: number;
}

export interface RegimeDetail extends WorkingTimeRegime {
  employeeCount: number;
  roleCount: number;
}

export interface RegimeRoleAssignmentResponse {
  id: number;
  regimeId: number;
  regimeLabelFr: string;
  roleId: number;
  roleName: string;
  paysId: number;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
  assignedBy?: number;
  assignedAt: string;
}

export interface ResolvedRegimeDto {
  regimeId: number;
  regimeCode: string;
  regimeLabelFr: string;
  regimeLabelEn: string;
  hoursPerWeek: number;
  daysPerWeek: number;
  startTime?: string;
  endTime?: string;
  isFlexible: boolean;
  breakDurationMin?: number;
  overtimeAllowed?: boolean;
  maxHoursPerDay?: number;
  assignmentLevel: 'EMPLOYEE_OVERRIDE' | 'ROLE_ASSIGNMENT' | 'DEFAULT';
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface CreateRegimeRequest {
  code: string;
  labelFr: string;
  labelEn: string;
  descriptionFr?: string;
  hoursPerWeek: number;
  daysPerWeek: number;
  startTime?: string;
  endTime?: string;
  isFlexible: boolean;
  isDefault: boolean;
  breakDurationMin?: number;
  overtimeAllowed?: boolean;
  maxHoursPerDay?: number;
  paysId: number;
}

export interface UpdateRegimeRequest extends Partial<CreateRegimeRequest> {}

export interface AssignRegimeToRoleRequest {
  regimeId: number;
  roleId: number;
  paysId: number;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
}

export interface RoleRow {
  roleId: number;
  roleName: string;
  assignment: RegimeRoleAssignmentResponse | null;
}

export interface RegimeOverviewStats {
  totalRegimes: number;
  employeeOverrideCount: number;
  roleAssignmentCount: number;
  defaultCount: number;
  unconfiguredCount: number;
}

export interface EmployeeRegimeOverview {
  employeeProfileId: number;
  userId: number;
  fullName: string;
  roleName: string | null;
  resolvedRegimeId: number | null;
  resolvedRegimeLabelFr: string | null;
  assignmentLevel: 'EMPLOYEE_OVERRIDE' | 'ROLE_ASSIGNMENT' | 'DEFAULT' | null;
  hoursPerWeek?: number;
  daysPerWeek?: number;
}

export interface AssignEmployeeOverrideRequest {
  regimeId: number;
  effectiveFrom: string;
  effectiveTo?: string;
  reason: string;
}
