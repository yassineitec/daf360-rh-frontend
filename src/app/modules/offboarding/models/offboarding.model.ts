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

export interface OffboardingWorkflowInstance {
  id:                       number;
  paysId:                   number;
  employeeProfileId:        number;
  employeeFullName:         string | null;
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

export interface ExitInterview {
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

export interface OffboardingAssetReturn {
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
