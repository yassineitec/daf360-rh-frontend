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
  tasks?:                   OffboardingTask[];
  /** PENDING V46 — handover / access / Kit RH items, all three groups in one list. */
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

// ── PENDING BACKEND (see OFFBOARDING-BACKEND-CHANGES.md) ─────────────────────
// Every field the redesigned page shows that no endpoint returns yet.
// They are declared here, optional, and merged into the interfaces above so the
// stage components can bind them today and render a placeholder. When the V46
// migration and the DTO changes land, nothing in the templates has to move —
// grep `PENDING V46` for the spots that will simply stop showing an em dash.

/** Stage 1 (Déclaration) + 2 (Validation) + 4 (IT) + 6 (Paie) instance fields. */
export interface OffboardingPendingFields {
  // Stage 1 — Déclaration
  justificationDocumentName?: string | null;
  justificationDocumentUrl?:  string | null;
  noticePeriodLabel?:         string | null;   // "3 mois"
  noticeWaiverRequested?:     boolean | null;
  theoreticalExitDate?:       string | null;   // ≠ lastWorkingDay (the negotiated one)
  // Stage 2 — Validation (today's single validatedBy/At cannot express manager → RH)
  managerValidatedAt?:        string | null;
  managerValidatedByName?:    string | null;
  managerComment?:            string | null;
  hrValidatedAt?:             string | null;
  noticePaidNotWorked?:       boolean | null;
  // Stage 3 — Passation
  handoverMinutesUrl?:        string | null;   // PV de passation
  // Stage 4 — IT & Matériel
  accountDeactivationAt?:     string | null;   // date + time in the design
  dischargeDocumentUrl?:      string | null;   // "Générer la décharge"
  // Stage 6 — Paie & STC
  settlementExecutionDate?:   string | null;
  settlementPaymentMode?:     string | null;   // joined from employee_profiles bank fields
  settlement?:                OffboardingSettlement | null;
}

/** Solde de tout compte. `null` until the settlement engine exists — the stage
 *  then renders its locked state, which is what the design shows anyway. */
export interface OffboardingSettlement {
  lines:    { label: string; amount: number }[];
  totalNet: number;
  currency?: string | null;
}

/** Handover checklist · access revocation · Kit RH — one shape, three groups. */
export type ChecklistGroup = 'HANDOVER' | 'ACCESS' | 'KIT';

export interface OffboardingChecklistItem {
  id?:          number;
  group:        ChecklistGroup;
  code:         string;
  label:        string;
  isDone:       boolean;
  documentUrl?: string | null;
}

/** Asset fields the design shows but `offboarding_asset_returns` lacks. */
export interface AssetPendingFields {
  serialNumber?: string | null;   // today smuggled into assetDescription
  isUrgent?:     boolean | null;  // or derived: expectedReturnDate < today
}

/** The design's exit interview is *schedulable*, not just present/absent. */
export type ExitInterviewStatus = 'PENDING' | 'SCHEDULED' | 'DONE';

export interface ExitInterviewPendingFields {
  status?:      ExitInterviewStatus | null;
  scheduledAt?: string | null;
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
