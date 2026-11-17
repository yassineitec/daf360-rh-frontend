export interface WorkingTimeRegime {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  hoursPerWeek: number;
  daysPerWeek: number;
  startTime?: string;
  endTime?: string;
  isFlexible: boolean;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
  breakDurationMin?: number;
  overtimeAllowed?: boolean;
  maxHoursPerDay?: number;
  /**
   * Seasonal (temporary) window, e.g. a summer "séance unique". While active this regime
   * outranks role assignments AND personal overrides for its entity — it is checked
   * first. Both null = an ordinary year-round regime.
   */
  seasonalFrom?: string | null;
  seasonalTo?:   string | null;
  /**
   * IANA timezone this regime's hours are read in. Null/empty = inherit the entity's zone,
   * which is what almost every regime should do. Set it only to run a regime on another
   * country's clock — assigned as a time-boxed personal override, that is how business
   * travel is expressed (hours and weekends stay contractual, only the clock moves).
   */
  timezone?: string | null;
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
  /** Starts after the entity's today — scheduled, not yet in force. */
  upcoming?: boolean;
}

/** One personal regime assignment (employee_regime_assignments, V127). */
export interface EmployeeRegimeAssignment {
  id: number;
  regimeId: number;
  regimeLabelFr: string;
  regimeLabelEn?: string | null;
  effectiveFrom: string;
  /** null = open-ended */
  effectiveTo?: string | null;
  reason?: string | null;
  source: 'MANUAL' | 'ONBOARDING' | 'MIGRATION';
  inForce: boolean;
  upcoming: boolean;
}

/** Outcome of reading an employee's resolved regime — 403 is not "nothing configured". */
export type ResolvedRegimeResult =
  | { status: 'ok'; regime: ResolvedRegimeDto }
  | { status: 'none' }
  | { status: 'forbidden' }
  | { status: 'error' };

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
  assignmentLevel: 'SEASONAL' | 'EMPLOYEE_OVERRIDE' | 'ROLE_ASSIGNMENT' | 'DEFAULT';
  effectiveFrom?: string;
  effectiveTo?: string;
  isSeasonal?: boolean;
  paysId?: number;
  /** Resolved zone: the regime's own override, else the entity's. */
  timezone?: string | null;
  /** Working day labels from the entity's weekend (the real days, not just a count). */
  joursOuvrables?: string[] | null;
  /** Calendar date this answer is for (today unless asked otherwise). */
  resolvedForDate?: string | null;
}

export interface CreateRegimeRequest {
  code: string;
  labelFr: string;
  labelEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
  hoursPerWeek: number;
  daysPerWeek: number;
  startTime?: string;
  endTime?: string;
  isFlexible: boolean;
  isDefault: boolean;
  breakDurationMin?: number;
  overtimeAllowed?: boolean;
  maxHoursPerDay?: number;
  /** Seasonal window — set both to make this the entity's temporary regime. */
  seasonalFrom?: string | null;
  seasonalTo?:   string | null;
  /** IANA timezone override; null/empty = inherit the entity's zone. */
  timezone?: string | null;
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
  /** The assignment in force today (else the next scheduled one when nothing is in force). */
  assignment: RegimeRoleAssignmentResponse | null;
  /** The next scheduled change, when one is planned after the current assignment. */
  upcoming: RegimeRoleAssignmentResponse | null;
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
  /** Null when the profile has no user name — shown as "Profil N" (see employeeName()). */
  fullName: string | null;
  roleName: string | null;
  /** The role's English name; null when it has none (then roleName is shown). */
  roleNameEn?: string | null;
  resolvedRegimeId: number | null;
  resolvedRegimeLabelFr: string | null;
  assignmentLevel: 'SEASONAL' | 'EMPLOYEE_OVERRIDE' | 'ROLE_ASSIGNMENT' | 'DEFAULT' | null;
  /** Personal regime in force today — set even while a seasonal regime outranks it. */
  personalRegimeId?: number | null;
  hoursPerWeek?: number;
  daysPerWeek?: number;
}

export interface AssignEmployeeOverrideRequest {
  regimeId: number;
  effectiveFrom: string;
  effectiveTo?: string;
  reason: string;
}
