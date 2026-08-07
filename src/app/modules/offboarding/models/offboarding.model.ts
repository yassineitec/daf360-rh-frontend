// ── Status & enum types ───────────────────────────────────────────────────────

export type OffboardingStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'VALIDATED' | 'CANCELLED' | 'ARCHIVED';
export type TaskStatus        = 'PENDING' | 'IN_PROGRESS' | 'DONE'    | 'BLOCKED'   | 'SKIPPED';
export type AssetType         = 'IT'      | 'BADGE'       | 'VEHICLE' | 'OTHER';

export const DEPARTURE_REASONS = [
  'RESIGNATION', 'FIN_CONTRAT', 'LICENCIEMENT', 'RETRAITE', 'FIN_STAGE', 'FIN_MISSION', 'AUTRE',
] as const;
export type DepartureReason = typeof DEPARTURE_REASONS[number];

// Enum value lists — human-readable labels live in i18n under OFFBOARDING.* and are
// resolved at render time (e.g. 'OFFBOARDING.STATUS.' + value | translate). Keep raw
// enum strings out of the UI: always normalise through these translation keys.
export const OFFBOARDING_STATUSES: readonly OffboardingStatus[] = [
  'PENDING', 'IN_PROGRESS', 'BLOCKED', 'VALIDATED', 'CANCELLED', 'ARCHIVED',
];

export const ASSET_TYPES: readonly AssetType[] = ['IT', 'BADGE', 'VEHICLE', 'OTHER'];

// ── Core domain interfaces ────────────────────────────────────────────────────

export interface OffboardingWorkflowInstance extends OffboardingPendingFields {
  id:                       number;
  paysId:                   number;
  employeeProfileId:        number;
  employeeFullName:         string | null;
  /** Canonical GENDER value_code — drives the male/female avatar. */
  employeeGender:           string | null;
  /** Set when a photo is on file; the real photo then wins over the avatar. */
  employeePhotoUrl:         string | null;
  contractId:               number | null;
  triggerDate:              string;
  lastWorkingDay:           string | null;
  departureReason:          DepartureReason;
  departureNotes:           string | null;
  status:                   OffboardingStatus;
  initiatedBy:              number | null;
  validatedBy:              number | null;
  validatedAt:              string | null;
  cancelledBy:              number | null;
  cancelledAt:              string | null;
  cancellationReason:       string | null;
  slaBreachFlag:            boolean;
  completionDate:           string | null;
  createdAt:                string;
  updatedAt:                string | null;
  handoverManagerProfileId: number | null;
  handoverManagerName:      string | null;
  /** Portal USER id — stage 2's manager panel compares it against the signed-in user. */
  handoverManagerUserId:    number | null;
  tasks?:                   OffboardingTask[];
  /** LIVE since V60 — handover / access / Kit RH items, all three groups in one list. */
  checklistItems?:          OffboardingChecklistItem[];
}

export interface OffboardingTask {
  id:                  number;
  workflowInstanceId:  number;
  taskCode:            string;
  taskLabel:           string;
  ownerRole:           string;
  ownerUserId:         number | null;
  isMandatory:         boolean;
  isBlocking:          boolean;
  dueDate:             string | null;
  status:              TaskStatus;
  completedBy:         number | null;
  completedAt:         string | null;
  skippedBy:           number | null;
  skipReason:          string | null;
  comments:            string | null;
  attachedDocumentUrl: string | null;
  slaBreachDate:       string | null;
  createdAt:           string;
}

export interface ExitInterview extends ExitInterviewPendingFields {
  id:                 number;
  workflowInstanceId: number;
  conductedBy:        number | null;
  conductedDate:      string | null;
  departureReasons:   string;
  feedbackText:       string | null;
  isAnonymised:       boolean;
  anonymisedAt:       string | null;
  visibleToRoles:     string | null;
  createdAt:          string;
  updatedAt:          string | null;
}

export interface ExitInterviewRequest {
  conductedDate:    string;
  departureReasons: string[];
  feedbackText:     string | null;
}

export interface OffboardingAssetReturn extends AssetPendingFields {
  id:                 number;
  workflowInstanceId: number;
  taskId:             number | null;
  assetDescription:   string;
  assetType:          AssetType;
  expectedReturnDate: string | null;
  actualReturnDate:   string | null;
  conditionOnReturn:  string | null;
  confirmedBy:        number | null;
  confirmedAt:        string | null;
  isWrittenOff:       boolean;
  writeOffApprovedBy: number | null;
  writeOffReason:     string | null;
  createdAt:          string;
}

// ── Per-stage instance fields ────────────────────────────────────────────────
//
// These began as UI-first placeholders for fields no endpoint returned, which is why they are
// all optional and merged into the interfaces above rather than declared inline. All seven
// stages are now backed — V57 (Déclaration), V59 (Validation), V60 (Passation), V61 (IT),
// V62 (Kit RH), V63 (Paie) — and the per-field comments say which migration.
//
// They stay OPTIONAL on purpose: the same interface serves the list endpoint, whose DTO does
// not populate every stage's fields for every row.

/**
 * Stage 3 — the passation window, broken down (V65). Exported so the page can type its
 * `updateHandover` patches. Derived server-side, never stored:
 * `workingDays` excludes days on validated leave and `leaveDays` counts exactly those, so the
 * two add up to `totalDays`. Null until both ends of the window exist.
 */
export interface OffboardingHandoverDuration {
  startDate?:   string | null;
  endDate?:     string | null;
  workingDays:  number;
  leaveDays:    number;
  totalDays:    number;
}

/** Stage 1 (Déclaration) + 2 (Validation) + 3 (Passation) + 4 (IT) + 6 (Paie) fields. */
export interface OffboardingPendingFields {
  // Stage 1 — Déclaration. LIVE since V57: written by
  // `PATCH /api/hr/offboarding/{id}/declaration`, returned by the instance DTO.
  justificationDocumentName?: string | null;
  justificationDocumentUrl?:  string | null;
  // Both DERIVED server-side from the préavis frozen on the employee's contract (V69,
  // négocié at hiring; grade default as fallback for pre-V69 contracts) — read-only here,
  // and no longer part of the declaration form.
  noticePeriodLabel?:         string | null;   // "3 mois"
  noticePeriodDays?:          number | null;   // the raw agreed figure
  noticeWaiverRequested?:     boolean | null;
  theoreticalExitDate?:       string | null;   // triggerDate + préavis, ≠ the negotiated day
  // Stage 2 — Validation Manager & RH. LIVE since V59: two stamps, separate from the
  // file-level `validatedBy/At` which belongs to stage 7.
  managerValidatedBy?:        number | null;
  managerValidatedAt?:        string | null;
  managerValidatedByName?:    string | null;
  managerComment?:            string | null;
  hrValidatedBy?:             number | null;
  hrValidatedAt?:             string | null;
  hrValidatedByName?:         string | null;
  noticePaidNotWorked?:       boolean | null;
  /**
   * V66 — may the SIGNED-IN user give the RH validation of this file? Answered by the server
   * because the rule is a role designated per pays, which no permission on the client encodes.
   */
  canValidateAsHr?:           boolean | null;
  // Stage 3 — Passation. LIVE since V60.
  handoverMinutesUrl?:        string | null;   // PV de passation
  handoverMinutesName?:       string | null;
  // V65 — the PV can be written instead of (or beside) the uploaded file, and the window has
  // a manager-set start. `handoverDuration` is computed server-side on every read.
  handoverMinutesText?:       string | null;
  handoverStartedAt?:         string | null;
  handoverDuration?:          OffboardingHandoverDuration | null;
  // Stage 4 — IT & Matériel. LIVE since V61.
  accountDeactivationAt?:     string | null;   // a moment, not a day
  dischargeDocumentUrl?:      string | null;   // "Générer la décharge"
  dischargeDocumentName?:     string | null;
  // Stage 6 — Paie & STC
  settlementExecutionDate?:   string | null;
  settlementPaymentMode?:     string | null;   // joined from employee_profiles bank fields
  settlement?:                OffboardingSettlement | null;
}

/**
 * Solde de tout compte — LIVE since V63. `null` while the file has no line, so stage 6
 * renders its "add the first line" state rather than a total of zero.
 *
 * The amounts are stored, not computed: two of the three usual lines have no source in
 * rh-service (no leave-balance table for congés payés, no per-pays convention scale for
 * l'indemnité de rupture). Only the prorata 13ᵉ mois is derivable, and `isSuggested` marks
 * it as the system's proposal until someone overrides it.
 */
export interface OffboardingSettlement {
  lines:    SettlementLine[];
  totalNet: number;
  currency?: string | null;
}

export interface SettlementLine {
  id?:          number;
  label:        string;
  /** Signed — a STC carries deductions as well as payments. */
  amount:       number;
  isSuggested?: boolean;
  orderIndex?:  number;
}

export interface SaveSettlementLineRequest {
  label:  string;
  amount: number;
}

export interface UpdateSettlementRequest {
  settlementExecutionDate?: string | null;
}

/** Books the exit interview — the design's **Planifier**. A moment, not a day. */
export interface ScheduleExitInterviewRequest {
  scheduledAt: string;
}

/** One line of the real audit trail, from `GET /{id}/audit`. */
export interface OffboardingAuditEntry {
  timestamp:  string;
  action:     string;
  entityType: string;
  entityId:   string;
  actorName:  string;
  oldValue:   string | null;
  newValue:   string | null;
}

/** Handover checklist · access revocation · Kit RH — one shape, three groups. */
export type ChecklistGroup = 'HANDOVER' | 'ACCESS' | 'KIT';

export interface OffboardingChecklistItem {
  id?:              number;
  group:            ChecklistGroup;
  code:             string;
  label:            string;
  isDone:           boolean;
  documentUrl?:     string | null;
  /** Who ticked it — cleared when the line is unticked. */
  completedByName?: string | null;
  orderIndex?:      number;
}

/** Ticks or unticks a line. Unticking is allowed: a tick is a claim, not a physical fact. */
export interface UpdateChecklistItemRequest {
  isDone?:      boolean;
  documentUrl?: string | null;
}

/** Adds a line — mainly HANDOVER, which cannot be seeded from a catalog. */
export interface CreateChecklistItemRequest {
  group: ChecklistGroup;
  label: string;
}

/** Stage 3 — the successor and the PV de passation. */
export interface UpdateHandoverRequest {
  handoverManagerProfileId?: number | null;
  handoverMinutesUrl?:       string | null;
  handoverMinutesName?:      string | null;
  /** V65. A blank `handoverMinutesText` clears it — unlike the other fields here. */
  handoverStartedAt?:        string | null;
  handoverMinutesText?:      string | null;
}

/** Asset fields added by V61 — the serial used to be smuggled into assetDescription. */
export interface AssetPendingFields {
  serialNumber?: string | null;
  /** Explicit flag; the UI still falls back to expectedReturnDate < today when false. */
  isUrgent?:     boolean | null;
}

/** Stage 4 — when the accounts go off. A moment, so the value carries a time. */
export interface UpdateItSecurityRequest {
  accountDeactivationAt?: string | null;
}

/** The exit interview is *schedulable* — LIVE since V62. */
export type ExitInterviewStatus = 'PENDING' | 'SCHEDULED' | 'DONE';

export interface ExitInterviewPendingFields {
  status?:          ExitInterviewStatus | null;
  scheduledAt?:     string | null;
  conductedByName?: string | null;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface StartOffboardingRequest {
  employeeProfileId:        number;
  contractId?:              number;
  triggerDate:              string;
  lastWorkingDay?:          string;
  departureReason:          DepartureReason;
  departureNotes?:          string;
  handoverManagerProfileId?: number;
}

export interface CompleteTaskRequest {
  comments?:            string;
  attachedDocumentUrl?: string;
}

/** Stage 2, left panel. The comment is optional — "nothing to add" is a valid decision. */
export interface ManagerValidationRequest {
  comment?: string | null;
}

/** Stage 2, right panel. Both optional: an empty body validates without adjusting. */
export interface HrValidationRequest {
  lastWorkingDay?:      string | null;
  noticePaidNotWorked?: boolean;
}

/**
 * Stage 1 of the wizard. Every field optional, and the API treats an absent field as
 * "leave alone" — it cannot clear a value, so the stage form always posts its whole
 * shape rather than a diff.
 */
export interface UpdateDeclarationRequest {
  lastWorkingDay?:            string | null;
  // No préavis fields: the API ignores them — the figure is frozen on the contract (V69).
  noticeWaiverRequested?:     boolean;
  justificationDocumentUrl?:  string | null;
  justificationDocumentName?: string | null;
  departureNotes?:            string | null;
  handoverManagerProfileId?:  number | null;
}

export interface CreateAssetReturnRequest {
  workflowInstanceId: number;
  assetDescription:   string;
  assetType:          AssetType;
  expectedReturnDate: string;
}

export interface OffboardingFilter {
  status?: OffboardingStatus;
  paysId?: number;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface HrNotification {
  id:        number;
  userId:    number;
  module:    string;
  title:     string;
  message:   string;
  isRead:    boolean;
  createdAt: string;
  readAt:    string | null;
}

// ── Generic page response ─────────────────────────────────────────────────────

export interface PageResponse<T> {
  content:       T[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  last:          boolean;
}

// ── Utility helpers ───────────────────────────────────────────────────────────

export function computeProgress(tasks: OffboardingTask[]): number {
  if (!tasks.length) return 0;
  const done = tasks.filter(t => t.status === 'DONE' || t.status === 'SKIPPED').length;
  return Math.round((done / tasks.length) * 100);
}

export function findNextDueTask(tasks: OffboardingTask[]): OffboardingTask | null {
  return tasks
    .filter(t => (t.status === 'PENDING' || t.status === 'IN_PROGRESS') && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0] ?? null;
}

export function isTerminal(status: OffboardingStatus): boolean {
  return status === 'VALIDATED' || status === 'CANCELLED' || status === 'ARCHIVED';
}
