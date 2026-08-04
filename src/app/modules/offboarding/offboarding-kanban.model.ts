import { OffboardingStatus, OffboardingWorkflowInstance } from './models/offboarding.model';

/**
 * Kanban columns for `/rh/offboarding`, mirroring the candidates board (same shape,
 * same column geometry, same minimap) but keyed on the offboarding workflow's own
 * statuses instead of candidate stages.
 */
export interface OffboardingKanbanColumn {
  key: string;
  label: string;
  statuses: OffboardingStatus[];
  /** Solid accent — column dot, minimap tile, card avatar fallback. */
  accent: string;
  /** Tinted accent behind the minimap tile. */
  badgeBg: string;
  /** Current sort direction for this column (by last working day). */
  sortDir: 'asc' | 'desc';
  items: OffboardingWorkflowInstance[];
}

/** Static column definition; `label` is resolved through i18n at render time. */
export interface OffboardingKanbanColumnDef
  extends Omit<OffboardingKanbanColumn, 'items' | 'label' | 'sortDir'> {
  labelKey: string;
}

/**
 * One column per workflow status, in lifecycle order. CANCELLED and ARCHIVED share a
 * terminal column: both are closed files that nobody works on, and giving each its own
 * column would push the active work off-screen.
 *
 * Colours follow the candidates board's semantics — amber = waiting, blue = in flight,
 * red = blocked, green = done, slate = closed — so the two boards read alike.
 */
export const OFFBOARDING_KANBAN_COLUMN_DEFS: OffboardingKanbanColumnDef[] = [
  { key: 'pending',   labelKey: 'OFFBOARDING.KANBAN.COL_PENDING',   statuses: ['PENDING'],                 accent: '#d97706', badgeBg: 'rgba(217,119,6,0.12)'  },
  { key: 'progress',  labelKey: 'OFFBOARDING.KANBAN.COL_PROGRESS',  statuses: ['IN_PROGRESS'],             accent: '#1e40af', badgeBg: 'rgba(30,64,175,0.12)'  },
  { key: 'blocked',   labelKey: 'OFFBOARDING.KANBAN.COL_BLOCKED',   statuses: ['BLOCKED'],                 accent: '#ba1a1a', badgeBg: 'rgba(186,26,26,0.12)'  },
  { key: 'validated', labelKey: 'OFFBOARDING.KANBAN.COL_VALIDATED', statuses: ['VALIDATED'],               accent: '#047857', badgeBg: 'rgba(4,120,87,0.12)'   },
  { key: 'closed',    labelKey: 'OFFBOARDING.KANBAN.COL_CLOSED',    statuses: ['CANCELLED', 'ARCHIVED'],   accent: '#64748b', badgeBg: 'rgba(100,116,139,0.12)' },
];

/**
 * Soonest last-working-day first — the files needing attention next. Instances with no
 * date sink to the bottom rather than sorting as epoch-zero.
 */
export function byLastWorkingDayAsc(
  a: OffboardingWorkflowInstance,
  b: OffboardingWorkflowInstance,
): number {
  const av = a.lastWorkingDay ?? '';
  const bv = b.lastWorkingDay ?? '';
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av.localeCompare(bv);
}
