import { OffboardingWorkflowInstance } from './models/offboarding.model';
import { STAGES, StageCode } from './offboarding-display';

/**
 * Kanban columns for `/rh/offboarding`, mirroring the candidates board (same shape,
 * same column geometry, same minimap) but keyed on the workflow's **stage** — where
 * the file physically is, and therefore who is holding it up.
 *
 * It used to be keyed on the instance status (`PENDING`/`IN_PROGRESS`/`BLOCKED`/…).
 * That answered "is work happening" but never "who is it waiting on", and two of the
 * six statuses are never written (`PENDING` is a DB default the service overwrites,
 * `ARCHIVED` has no code path), so in practice the board only ever had two live
 * columns. The card was already showing its stage via `stageProgressOf`, so a file
 * read "IT & Matériel" while sitting under "En cours".
 */
export interface OffboardingKanbanColumn {
  key: StageCode;
  label: string;
  /** Material Symbol, from `STAGES` — the same glyph as the detail page's rail. */
  icon: string;
  /** Solid accent — column dot, minimap tile, card avatar fallback. */
  accent: string;
  /** Tinted accent behind the minimap tile and the card's stage pill. */
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
 * One colour per stage, left to right: slate intake → amber decision → violet
 * handover → blue IT → cyan HR → rose payroll → emerald closed. Raw hex rather
 * than Tailwind classes because these are bound through `[style.background]`, and
 * a class name assembled at runtime is not in the compiled stylesheet.
 */
const STAGE_ACCENTS: Record<StageCode, { accent: string; badgeBg: string }> = {
  DECLARATION: { accent: '#64748b', badgeBg: 'rgba(100,116,139,0.12)' },
  VALIDATION:  { accent: '#d97706', badgeBg: 'rgba(217,119,6,0.12)'   },
  HANDOVER:    { accent: '#7c3aed', badgeBg: 'rgba(124,58,237,0.12)'  },
  IT_ASSETS:   { accent: '#1e40af', badgeBg: 'rgba(30,64,175,0.12)'   },
  HR_DOCS:     { accent: '#0891b2', badgeBg: 'rgba(8,145,178,0.12)'   },
  PAYROLL:     { accent: '#be185d', badgeBg: 'rgba(190,24,93,0.12)'   },
  CLOSURE:     { accent: '#047857', badgeBg: 'rgba(4,120,87,0.12)'    },
};

/**
 * Derived from `STAGES`, not written out again: the board, the detail page's rail and
 * the card's stage pill then share one ordering and one icon set, so they cannot drift.
 * Adding a stage in `offboarding-display.ts` only needs a colour here and a label key.
 */
export const OFFBOARDING_KANBAN_COLUMN_DEFS: OffboardingKanbanColumnDef[] =
  STAGES.map(stage => ({
    key:      stage.code,
    labelKey: 'OFFBOARDING.KANBAN.COL_' + stage.code,
    icon:     stage.icon,
    ...STAGE_ACCENTS[stage.code],
  }));

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
