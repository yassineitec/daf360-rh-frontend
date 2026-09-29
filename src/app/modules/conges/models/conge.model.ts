/**
 * Congés — the shapes rh-service returns from /api/hr/leave.
 *
 * Ported with the module out of the timesheet application. The four state values are the
 * timesheet's own EtatDemande, unchanged: renaming them would have meant rewriting 716 rows
 * of history for no gain.
 */

/** EN_ATTENTE -> VALIDE | REFUSE, and ARCHIVE from anywhere. Nothing is hard-deleted. */
export type DemandeEtat = 'EN_ATTENTE' | 'VALIDE' | 'REFUSE' | 'ARCHIVE';

/**
 * An `AbsenceTypes.code` — an open string, deliberately not a union.
 *
 * It was a thirteen-value union copied from an enum that no longer exists. HR administers
 * the catalogue in a table, so the valid set changes without a deployment: a closed union
 * would make the compiler reject a type the backend considers perfectly valid, and would
 * have to be edited every time someone adds one.
 *
 * Which types draw on a balance is also configuration now (`tracks_balance`), not a
 * property of the code.
 */
export type LeaveTypeCode = string;

export type LeaveCategoryCode =
  | 'MULTIPLE_DAYS' | 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON';

export interface CongeRow {
  id: number;
  collaborateurId: number;
  collaborateurName: string | null;
  /**
   * The three inputs `getAvatarUrl` needs. All null for a user with no employee profile —
   * a real case, and the reason the avatar falls back to initials rather than a broken image.
   */
  collaborateurProfileId: number | null;
  collaborateurPhotoUrl: string | null;
  collaborateurGender: string | null;
  responsableId: number | null;
  responsableName: string | null;
  paysId: number | null;
  type: LeaveTypeCode;
  /** Already in the caller's language — the server renders it for the Excel exports too. */
  typeLabel: string;
  category: LeaveCategoryCode;
  categoryLabel: string;
  dateDebut: string;
  dateFin: string;
  totalJours: number;
  justificatif: boolean | null;
  reason: string | null;
  etatDemande: DemandeEtat;
  motifRefus: string | null;
  dateValidation: string | null;
  decidedBy: number | null;
  decidedByName: string | null;
  /**
   * Who FILED it. Equal to `collaborateurId` on an ordinary request, different on a
   * régularisation — that difference is what the settle list selects on. Null on rows
   * migrated from the timesheet that V108's back-fill could not attribute.
   */
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
}

/** A {label, value} pair for a dropdown. The label arrives already in the caller's language. */
export interface LeaveOption {
  label: string;
  value: string;
}

/** Someone who may approve this employee's leave — derived from the role hierarchy. */
export interface LeaveApprover {
  userId: number;
  fullName: string;
  email: string;
  roleName: string;
}

/**
 * One selectable leave type, with the rules the form must apply before it submits.
 *
 * `eligibleApprovers` is null when the type names no approver roles, meaning "use the default
 * manager list"; it is an EMPTY ARRAY when it names roles but nobody above this employee holds
 * one — a configuration problem the form reports rather than papers over with the wrong
 * approver. Collapsing the two would file régularisations against whoever happened to be first.
 */
export interface LeaveTypeOption {
  code: string;
  label: string;
  /** Exactly one approver role is configured, so the form picks it rather than asking. */
  autoAssign: boolean;
  approverRoleCount: number;
  eligibleApprovers: LeaveApprover[] | null;
  tracksBalance: boolean;
  /** CONGE | MALADIE | TELETRAVAIL, or null when the type draws on no allowance. */
  balanceField: string | null;
  requiresJustification: boolean;
  maxDays: number | null;
}

/** A range the employee already holds, so the form can refuse to overlap it. */
export interface LeaveBlockingRange {
  id: number;
  dateDebut: string;
  dateFin: string;
  etat: string;
}

/**
 * Everything the régularisation form needs about ONE employee, in one call.
 *
 * Identical to what the self-service modal reads for its own user, and served by the same
 * service method — so a cap or an approver rule cannot apply to an employee's own request
 * while quietly not applying to HR's correction of it.
 */
export interface LeaveHeaders {
  balances: LeaveBalances;
  types: LeaveTypeOption[];
  categories: LeaveOption[];
  approvers: LeaveApprover[];
  blockingRanges: LeaveBlockingRange[];
  /** ISO date -> holiday name, for the cost preview. */
  holidays: Record<string, string>;
  /** The employee's own rest days as DayOfWeek names — Egypt is FRIDAY/SATURDAY. */
  weekendDays: string[];
}

/**
 * What the settle form posts. `collaborateurId` travels in the path, not the body.
 *
 * No `totalJours`: the server recomputes it from the dates, the category and that country's
 * weekends and holidays. The timesheet counted days in the browser and the backend debited
 * whatever number arrived.
 */
export interface SettleRequest {
  type: LeaveTypeCode;
  category: LeaveCategoryCode;
  dateDebut: string;
  dateFin: string | null;
  responsableId: number;
  responsableAdjointId?: number | null;
  justificatif: boolean;
  reason: string;
}

/** Filters for the régularisation list. `mine` defaults to true server-side. */
export interface SettleFilter extends CongeFilter {
  mine?: boolean;
}

export interface CongePage {
  content: CongeRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Outcome of approving a queue in one action.
 *
 * Partial success is the normal case: one employee's exhausted balance must not block the
 * other nineteen decisions, so the server approves what it can and reports the rest.
 */
export interface BulkApproveResult {
  approved: number;
  failed: number;
  failures: { leaveRequestId: number; employee: string | null; reason: string }[];
}

export interface CongeFilter {
  etat?: DemandeEtat | null;
  type?: LeaveTypeCode | null;
  from?: string | null;
  to?: string | null;
  collaborateurId?: number | null;
  paysId?: number | null;
  /** Matches the employee's name or the request's reason, server-side. */
  search?: string | null;
  /**
   * Server-side sort. The key must be one of `LeaveRequestController.SORTABLE` — anything
   * else is ignored by the server and falls back to that endpoint's default, rather than
   * erroring, so a stale key degrades instead of breaking the page.
   */
  sort?: string | null;
  dir?: 'asc' | 'desc' | null;
  page?: number;
  size?: number;
}

/** Counts per state, zero-filled by the server so the KPI row never loses a tile. */
export type CongeCounts = Record<DemandeEtat, number>;

export interface LeaveBalances {
  /** Nullable throughout: "not recorded" is not "none left". 135 of 260 users have no congé balance. */
  soldeConge: number | null;
  soldeMaladie: number | null;
  soldeTeletravail: number | null;
}
