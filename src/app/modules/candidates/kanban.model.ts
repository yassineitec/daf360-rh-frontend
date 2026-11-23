import { CandidateListItem, CandidateStatus } from './candidate.model';

/** A kanban column groups one or more candidate statuses into a workflow stage. */
export interface KanbanColumn {
  key: string;
  label: string;
  /**
   * The global status a card of this column carries (« En recrutement », « En onboarding »,
   * « Embauché », « Clôturé ») — singular, where `label` names the column.
   */
  globalLabel: string;
  statuses: CandidateStatus[];
  /** Solid accent (dot, status-badge text, avatar fallback). */
  accent: string;
  /** Tinted background for the card status badge. */
  badgeBg: string;
  /** Current fit-score sort direction for this column. */
  sortDir: 'asc' | 'desc';
  candidates: CandidateListItem[];
}

/** Static column definition; `label` is resolved via i18n at render time. */
export interface KanbanColumnDef extends Omit<KanbanColumn, 'candidates' | 'label' | 'globalLabel' | 'sortDir'> {
  labelKey: string;
  globalLabelKey: string;
}

/** Key of the column after which the board draws the read-only Offboarding column. */
export const OFFBOARDING_AFTER_KEY = 'hired';

/**
 * « Pipeline RH » is the LIFECYCLE board: one column per global status, each card saying
 * which global status it is in and, under it, its detailed candidate status.
 *
 *   En recrutement — the candidature (interviews, RH validation, offer):
 *                    PENDING / ACCEPTED / OFFER_SENT. Its steps are the columns of the
 *                    « Candidats » board.
 *   Onboarding     — offer agreed: onboarding and IT provisioning run in parallel
 *                    (HR_IN_PROGRESS; IT_IN_PROGRESS / EMAIL_RECEIVED are the legacy codes
 *                    of the same phase).
 *   Embauchés      — HIRED, an employee now.
 *   [Offboarding]  — read-only column of the departures in progress, drawn after Embauchés.
 *   Clôturés       — REJECTED / ARCHIVED.
 */
export const KANBAN_COLUMN_DEFS: KanbanColumnDef[] = [
  { key: 'recruiting', labelKey: 'CANDIDATES.KANBAN.COL_RECRUITING', globalLabelKey: 'CANDIDATES.KANBAN.GLOBAL_RECRUITING',
    statuses: ['PENDING', 'ACCEPTED', 'OFFER_SENT'],                  accent: '#3755c3', badgeBg: 'rgba(55,85,195,0.12)'  },
  { key: 'onboarding', labelKey: 'CANDIDATES.KANBAN.COL_ONBOARDING', globalLabelKey: 'CANDIDATES.KANBAN.GLOBAL_ONBOARDING',
    statuses: ['HR_IN_PROGRESS', 'IT_IN_PROGRESS', 'EMAIL_RECEIVED'], accent: '#d97706', badgeBg: 'rgba(217,119,6,0.12)'  },
  { key: 'hired',      labelKey: 'CANDIDATES.KANBAN.COL_HIRED',      globalLabelKey: 'CANDIDATES.KANBAN.GLOBAL_HIRED',
    statuses: ['HIRED'],                                              accent: '#047857', badgeBg: 'rgba(4,120,87,0.12)'   },
  { key: 'closed',     labelKey: 'CANDIDATES.KANBAN.COL_CLOSED',     globalLabelKey: 'CANDIDATES.KANBAN.GLOBAL_CLOSED',
    statuses: ['REJECTED', 'ARCHIVED'],                               accent: '#ba1a1a', badgeBg: 'rgba(186,26,26,0.12)'  },
];

/** Highest fit score first; candidates without a score sink to the bottom. */
export function byFitScoreDesc(a: CandidateListItem, b: CandidateListItem): number {
  return (b.fitScore ?? -1) - (a.fitScore ?? -1);
}
