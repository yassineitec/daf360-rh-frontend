export type WorkflowStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'BLOCKED';
export type TaskStatus     = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'SKIPPED';

export const WORKFLOW_EVENT_TYPES = [
  'ONBOARDING', 'OFFBOARDING', 'PROMOTION', 'CONTRACT_RENEWAL',
  'PROBATION_REVIEW', 'RESIGNATION_PROCESS', 'DISCIPLINARY', 'OTHER',
] as const;

export const EVENT_TYPE_LABELS: Record<string, string> = {
  ONBOARDING:          'Onboarding',
  OFFBOARDING:         'Offboarding',
  PROMOTION:           'Promotion',
  CONTRACT_RENEWAL:    'Renouvellement contrat',
  PROBATION_REVIEW:    'Bilan période d\'essai',
  RESIGNATION_PROCESS: 'Processus de démission',
  DISCIPLINARY:        'Procédure disciplinaire',
  OTHER:               'Autre',
};

export interface WorkflowInstance {
  id:                number;
  eventType:         string;
  employeeProfileId: number;
  triggeredBy:       number | null;
  paysId:            number;
  status:            WorkflowStatus;
  startDate:         string | null;
  endDate:           string | null;
  dueDate:           string | null;
  notes:             string | null;
  createdAt:         string;
  updatedAt:         string | null;
  completedAt:       string | null;
  cancelledAt:       string | null;
  tasks?:            WorkflowTask[];
  // Computed on frontend
  progressPct?:      number;
  nextDueTask?:      WorkflowTask | null;
}

export interface WorkflowTask {
  id:                 number;
  workflowInstanceId: number;
  title:              string;
  description:        string | null;
  phase:              string | null;
  assignedTo:         number | null;
  completedBy:        number | null;
  status:             TaskStatus;
  slaHours:           number | null;
  dueDate:            string | null;
  completedAt:        string | null;
  notes:              string | null;
  createdAt:          string;
  updatedAt:          string | null;
}

export interface PhaseGroup {
  phase: string;
  tasks: WorkflowTask[];
}

export function groupTasksByPhase(tasks: WorkflowTask[]): PhaseGroup[] {
  const map = new Map<string, WorkflowTask[]>();
  for (const t of tasks) {
    const key = t.phase ?? 'Général';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([phase, phaseTasks]) => ({ phase, tasks: phaseTasks }));
}

export function computeProgress(tasks: WorkflowTask[]): number {
  if (!tasks.length) return 0;
  const done = tasks.filter(t => t.status === 'DONE' || t.status === 'SKIPPED').length;
  return Math.round((done / tasks.length) * 100);
}

export function findNextDueTask(tasks: WorkflowTask[]): WorkflowTask | null {
  return tasks
    .filter(t => (t.status === 'PENDING' || t.status === 'IN_PROGRESS') && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0] ?? null;
}

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

export interface CreateWorkflowDto {
  employeeProfileId: number;
  eventType:         string;
  startDate?:        string;
  dueDate?:          string;
  notes?:            string;
}

export interface WorkflowFilter {
  status?:    WorkflowStatus;
  eventType?: string;
  paysId?:    number;
  page?:      number;
  size?:      number;
}

export interface PageResponse<T> {
  content:       T[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  last:          boolean;
}
