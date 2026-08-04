import { AccordionState, BadgeVariant } from '@khalilrebhiitec/daf360';

import {
  ChecklistGroup, OffboardingChecklistItem, OffboardingStatus, OffboardingTask,
  OffboardingWorkflowInstance, computeProgress, findNextDueTask, isTerminal,
} from './models/offboarding.model';

/**
 * Display helpers shared by the `/rh/offboarding` page, its card section and its
 * table section, so the three can never disagree on progress, lateness or the
 * badge variant of a status.
 */

const STATUS_VARIANTS: Record<OffboardingStatus, BadgeVariant> = {
  PENDING:     'neutral',
  IN_PROGRESS: 'teal',
  BLOCKED:     'danger',
  VALIDATED:   'success',
  CANCELLED:   'neutral',
  ARCHIVED:    'neutral',
};

export function statusVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status as OffboardingStatus] ?? 'neutral';
}

/**
 * `daf-entity-card`'s status slot has only three looks (§6): grey `inactive`,
 * warning `pending`, green for anything else. Six offboarding statuses collapse
 * onto them and the precision lives in the label.
 */
export function cardStatus(status: OffboardingStatus): 'active' | 'inactive' | 'pending' {
  if (status === 'VALIDATED') return 'active';
  if (status === 'CANCELLED' || status === 'ARCHIVED') return 'inactive';
  return 'pending';
}

export function initialsOf(fullName: string | null): string {
  const parts = (fullName ?? '').trim().split(/\s+/);
  const from = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return from ? from.toUpperCase() : '—';
}

/** Task completion of the workflow, 0–100. Files with no tasks read 0. */
export function progressPct(item: OffboardingWorkflowInstance): number {
  return computeProgress(item.tasks ?? []);
}

export function hasTasks(item: OffboardingWorkflowInstance): boolean {
  return (item.tasks?.length ?? 0) > 0;
}

/** The next task is past its due date — a softer signal than `slaBreachFlag`. */
export function isOverdue(item: OffboardingWorkflowInstance): boolean {
  const next = findNextDueTask(item.tasks ?? []);
  return !!(next?.dueDate && new Date(next.dueDate) < new Date());
}

/** Still running: neither validated, cancelled nor archived. */
export function isActive(item: OffboardingWorkflowInstance): boolean {
  return !isTerminal(item.status);
}

export function localeDate(iso: string | null, locale = 'fr-FR'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── The 7 stages of /rh/offboarding/:id ──────────────────────────────────────
// The design shows 7 stages; the V44 catalog seeds 9 task
// codes. A stage is therefore a *group of task codes*, and its state is derived
// from them — which is the whole reason this lives here and not in a template:
// the rail and the accordion cards read the same resolver, so they cannot
// disagree about which stage is in progress.

export type StageCode =
  | 'DECLARATION' | 'VALIDATION' | 'HANDOVER' | 'IT_ASSETS' | 'HR_DOCS' | 'PAYROLL' | 'CLOSURE';

export interface StageDef {
  code:      StageCode;
  /** Material Symbol — the disc in the accordion header and the stepper circle. */
  icon:      string;
  /** Ultra-short rail label ("Décl.", "Valid."); the full title is an i18n key. */
  railKey:   string;
  /** Task codes rolled up by this stage. Empty ⇒ state comes from the instance. */
  taskCodes: readonly string[];
}

export const STAGES: readonly StageDef[] = [
  { code: 'DECLARATION', icon: 'check_circle',   railKey: 'DECLARATION', taskCodes: [] },
  { code: 'VALIDATION',  icon: 'verified',       railKey: 'VALIDATION',  taskCodes: [] },
  { code: 'HANDOVER',    icon: 'handshake',      railKey: 'HANDOVER',    taskCodes: ['KNOWLEDGE_TRANSFER'] },
  { code: 'IT_ASSETS',   icon: 'inventory_2',    railKey: 'IT_ASSETS',
    taskCodes: ['ASSET_RETURN_IT', 'ASSET_RETURN_BADGE', 'IT_ACCESS_REVOKE'] },
  { code: 'HR_DOCS',     icon: 'assignment_ind', railKey: 'HR_DOCS',
    taskCodes: ['EXIT_INTERVIEW', 'WORK_CERTIFICATE', 'INTERNAL_ANNOUNCEMENT'] },
  { code: 'PAYROLL',     icon: 'payments',       railKey: 'PAYROLL',
    taskCodes: ['FINAL_SETTLEMENT', 'EXPENSE_CLOSE'] },
  { code: 'CLOSURE',     icon: 'lock',           railKey: 'CLOSURE',     taskCodes: [] },
];

/**
 * Everything a stage component needs to draw its own `rh-stage-panel` header.
 * The page computes it (it owns the data and the TranslateService); the stage
 * components stay dumb and take it as one input, so the seven headers cannot
 * drift apart on numbering, icon or pill.
 */
export interface StageView {
  code:        StageCode;
  /** 1-based — the design numbers every header ("4. Informatique & Matériel"). */
  index:       number;
  icon:        string;
  title:       string;   // translated, numbered by the stage component
  subtitle:    string;   // data-dependent one-liner, already formatted
  state:       AccordionState;
  statusLabel: string;   // translated pill text
}

export function tasksOfStage(stage: StageDef, tasks: OffboardingTask[]): OffboardingTask[] {
  return tasks.filter(t => stage.taskCodes.includes(t.taskCode));
}

export function isSettled(t: OffboardingTask): boolean {
  return t.status === 'DONE' || t.status === 'SKIPPED';
}

/**
 * State of every stage in one pass, so the rail and the cards agree.
 *
 * Rules, in order:
 * - `DECLARATION` is done as soon as the file exists (a workflow cannot be created
 *   without a reason and a trigger date).
 * - `VALIDATION` is done once the instance carries a validation stamp.
 * - a task-backed stage is `done` when every one of its tasks is DONE/SKIPPED,
 *   `blocked` when one is BLOCKED **or** a mandatory one is past due, `active` when
 *   at least one has moved, else `pending`.
 * - `CLOSURE` is `done` on VALIDATED/ARCHIVED, `locked` while any blocking task is
 *   outstanding, else `active`.
 * - finally, the first stage that is neither done nor blocked is promoted to
 *   `active`, so exactly one stage reads as "where we are".
 */
export function resolveStageStates(
  wf: OffboardingWorkflowInstance,
  tasks: OffboardingTask[],
): Record<StageCode, AccordionState> {
  const today = new Date().setHours(0, 0, 0, 0);
  const overdue = (t: OffboardingTask) =>
    !isSettled(t) && !!t.dueDate && new Date(t.dueDate).getTime() < today;

  const states = {} as Record<StageCode, AccordionState>;

  for (const stage of STAGES) {
    if (stage.code === 'DECLARATION') {
      states[stage.code] = 'done';
      continue;
    }
    if (stage.code === 'VALIDATION') {
      states[stage.code] = wf.validatedAt || wf.hrValidatedAt || wf.managerValidatedAt
        ? 'done' : 'pending';
      continue;
    }
    if (stage.code === 'CLOSURE') {
      if (wf.status === 'VALIDATED' || wf.status === 'ARCHIVED') states[stage.code] = 'done';
      else if (tasks.some(t => t.isBlocking && !isSettled(t))) states[stage.code] = 'locked';
      else states[stage.code] = 'active';
      continue;
    }

    const own = tasksOfStage(stage, tasks);
    if (!own.length)                            states[stage.code] = 'pending';
    else if (own.every(isSettled))               states[stage.code] = 'done';
    else if (own.some(t => t.status === 'BLOCKED') || own.some(t => t.isMandatory && overdue(t)))
                                                 states[stage.code] = 'blocked';
    else if (own.some(t => isSettled(t) || t.status === 'IN_PROGRESS'))
                                                 states[stage.code] = 'active';
    else                                         states[stage.code] = 'pending';
  }

  // Exactly one "you are here": the first stage that isn't finished or blocked.
  const next = STAGES.find(s => states[s.code] === 'pending');
  if (next && !STAGES.some(s => states[s.code] === 'active')) states[next.code] = 'active';

  return states;
}

/** Index for `daf-stepper [currentStep]` (0-based) — the stage in play. */
export function activeStageIndex(states: Record<StageCode, AccordionState>): number {
  const i = STAGES.findIndex(s => states[s.code] === 'active' || states[s.code] === 'blocked');
  return i < 0 ? STAGES.length - 1 : i;
}

/** i18n key suffix for the stage's status pill. */
export function stageStatusKey(state: AccordionState): string {
  switch (state) {
    case 'done':    return 'DONE';
    case 'active':  return 'IN_PROGRESS';
    case 'blocked': return 'ACTION_REQUIRED';
    case 'locked':  return 'LOCKED';
    default:        return 'PENDING';
  }
}

/** Blocking tasks still outstanding — why stage 6 and 7 are locked. */
export function outstandingBlockers(tasks: OffboardingTask[]): OffboardingTask[] {
  return tasks.filter(t => t.isBlocking && !isSettled(t));
}

export function checklistOf(
  items: OffboardingChecklistItem[] | undefined,
  group: ChecklistGroup,
): OffboardingChecklistItem[] {
  return (items ?? []).filter(i => i.group === group);
}

/** Material Symbol per asset type — the icon tile in the physical inventory. */
export function assetIcon(assetType: string): string {
  switch (assetType) {
    case 'IT':      return 'laptop_mac';
    case 'BADGE':   return 'badge';
    case 'VEHICLE': return 'directions_car';
    default:        return 'inventory_2';
  }
}

/** Grouped integer part + currency. Salaries elsewhere in the app are TND. */
export function money(value: number | null | undefined, currency = 'TND'): string {
  if (value == null) return '—';
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** `15/09/2023` — the design's readonly date fields. Em dash when absent. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
}

/** `15 octobre 2023` — the departure date in the page header. */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** `15/09 · 14:22` — audit-trail stamps. */
export function stampDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** `15/09` — the compact form used inside stage subtitles. */
export function dayMonth(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/** Whole days from today to `iso`; negative once the date is past. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso).setHours(0, 0, 0, 0);
  if (isNaN(target)) return null;
  return Math.round((target - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
}

/**
 * Where a file currently stands, for the board cards and the list.
 *
 * A workflow status (`IN_PROGRESS`, `BLOCKED`…) says whether work is happening but not
 * WHO it is waiting on. This resolves the live stage — Validation, Passation, IT &
 * Matériel, Kit RH, Paie, Clôture — from the same `resolveStageStates` the case page
 * uses, so the list and the detail page can never disagree about the current step.
 *
 * `tasks` comes off the instance itself; the list endpoint already ships them.
 */
export interface StageProgress {
  /** 1-based position of the live stage. */
  step: number;
  total: number;
  /** Stage code, e.g. IT_ASSETS. */
  code: StageCode;
  /** i18n key for the full stage name (…_TITLE). */
  titleKey: string;
  /** i18n key for the abbreviated name (…_RAIL), for tight spaces. */
  railKey: string;
  icon: string;
  /** How many stages are finished — drives the "3/7" progress read. */
  done: number;
  /** True when the live stage is blocked rather than merely in progress. */
  blocked: boolean;
}

export function stageProgressOf(wf: OffboardingWorkflowInstance): StageProgress {
  const states = resolveStageStates(wf, wf.tasks ?? []);
  const index  = activeStageIndex(states);
  const stage  = STAGES[index];
  return {
    step:     index + 1,
    total:    STAGES.length,
    code:     stage.code,
    titleKey: 'OFFBOARDING.STAGE.' + stage.railKey + '_TITLE',
    railKey:  'OFFBOARDING.STAGE.' + stage.railKey + '_RAIL',
    icon:     stage.icon,
    done:     STAGES.filter(s => states[s.code] === 'done').length,
    blocked:  states[stage.code] === 'blocked',
  };
}
