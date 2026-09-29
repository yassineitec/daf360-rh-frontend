/** A role permitted to approve a given leave type. */
export interface ApproverRole {
  roleId: number;
  roleName: string;
}

/**
 * One configurable leave type.
 *
 * `allowedGender` and `approverResolutionStrategy` are stored and editable but enforced
 * NOWHERE — verified against the timesheet's own code. The form labels them as such rather
 * than presenting them as working rules; a field that looks like a rule and is not is worse
 * than one that is absent.
 */
export interface AbsenceTypeRow {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string;
  active: boolean;
  tracksBalance: boolean;
  balanceField: string | null;
  includedInHrStats: boolean;
  requiresJustification: boolean;
  maxDays: number | null;
  displayOrder: number;
  allowedGender: string | null;
  managerCanView: boolean;
  approverResolutionStrategy: string | null;
  approverRoles: ApproverRole[];
}

/**
 * Create/update payload.
 *
 * `code` is sent on create and ignored on update — it is the key 716 filed requests store,
 * so renaming it would orphan them.
 */
export interface AbsenceTypeUpsert {
  code: string;
  labelFr: string;
  labelEn: string;
  active: boolean;
  tracksBalance: boolean;
  balanceField: string | null;
  includedInHrStats: boolean;
  requiresJustification: boolean;
  maxDays: number | null;
  displayOrder: number;
  allowedGender: string | null;
  managerCanView: boolean;
  approverResolutionStrategy: string | null;
  /** null leaves the set alone; [] clears the restriction. Different intents. */
  approverRoleIds: number[] | null;
}

/** The balance columns that exist on Users — the only valid `balanceField` values. */
export const BALANCE_FIELDS = ['CONGE', 'MALADIE', 'TELETRAVAIL'] as const;
