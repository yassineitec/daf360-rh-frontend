import { CandidateListItem, CandidateStatus } from './candidate.model';

/** A kanban column groups one or more candidate statuses into a workflow stage. */
export interface KanbanColumn {
  key: string;
  label: string;
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
export interface KanbanColumnDef extends Omit<KanbanColumn, 'candidates' | 'label' | 'sortDir'> {
  labelKey: string;
}

/**
 * Kanban stages mirror the coded candidate workflow (PENDING → … → HIRED / REJECTED).
 * Each column owns a colour used for its dot and the card status badge.
 */
export const KANBAN_COLUMN_DEFS: KanbanColumnDef[] = [
  { key: 'pending',  labelKey: 'CANDIDATES.KANBAN.COL_PENDING',  statuses: ['PENDING'],                                            accent: '#d97706', badgeBg: 'rgba(217,119,6,0.12)'  },
  { key: 'accepted', labelKey: 'CANDIDATES.KANBAN.COL_ACCEPTED', statuses: ['ACCEPTED', 'OFFER_SENT'],                             accent: '#0d9488', badgeBg: 'rgba(13,148,136,0.12)' },
  { key: 'progress', labelKey: 'CANDIDATES.KANBAN.COL_PROGRESS', statuses: ['IT_IN_PROGRESS', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS'], accent: '#1e40af', badgeBg: 'rgba(30,64,175,0.12)'  },
  { key: 'hired',    labelKey: 'CANDIDATES.KANBAN.COL_HIRED',    statuses: ['HIRED'],                                              accent: '#047857', badgeBg: 'rgba(4,120,87,0.12)'   },
  { key: 'rejected', labelKey: 'CANDIDATES.KANBAN.COL_REJECTED', statuses: ['REJECTED', 'ARCHIVED'],                               accent: '#ba1a1a', badgeBg: 'rgba(186,26,26,0.12)'  },
];

/** Highest fit score first; candidates without a score sink to the bottom. */
export function byFitScoreDesc(a: CandidateListItem, b: CandidateListItem): number {
  return (b.fitScore ?? -1) - (a.fitScore ?? -1);
}
