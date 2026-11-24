import { KanbanCandidate } from './services/pipeline.service';

/**
 * The candidature board's columns are the recruitment STEPS (the same ones the candidate
 * page's « Étape actuelle » card walks through), in order:
 *
 *   1. PRESELECTION — PENDING, no live interview yet: the CV is being screened, the first
 *                     interview is still to plan.
 *   2. INTERVIEWS   — PENDING, at least one live interview: the PVs are being filed, then RH
 *                     gives each one its verdict (PASS / FAIL). There is no separate « Validation
 *                     RH » step any more — the verdicts belong to the interviews, and the
 *                     candidature leaves this column when RH accepts it (status leaves PENDING).
 *   3. OFFER        — ACCEPTED / OFFER_SENT: the salary negotiation, round after round.
 *   4. HIRED        — the offer is agreed and onboarding is still running: HR_IN_PROGRESS
 *                     (with the legacy IT_IN_PROGRESS / EMAIL_RECEIVED codes), or HIRED with
 *                     the IT file still open.
 *
 * Once the RH file is submitted (HIRED) AND the IT file is closed, onboarding is over and the
 * card leaves the board. Rejected and archived candidatures are not a column — they are closed.
 */
export type BoardStageKey = 'PRESELECTION' | 'INTERVIEWS' | 'OFFER' | 'HIRED';

/**
 * Which offer action a card emitted. Both now route to the candidate's Offre tab
 * (see `PipelineComponent.openOfferModal`), but the two emitters stay distinct on
 * the card so the buttons keep their own labels and permissions.
 */
export type OfferMode = 'send' | 'renegotiate';

/** Static stage definition; `label` is resolved through i18n at render time. */
export interface BoardStageDef {
  key: BoardStageKey;
  labelKey: string;
  /** Material Symbol of the step — the same as the rail's. */
  icon: string;
  /** Solid stage colour — the column dot, the minimap tile and the avatar fallback. */
  accent: string;
  /** Tinted stage colour behind the minimap tile. */
  badgeBg: string;
}

export interface BoardColumn extends Omit<BoardStageDef, 'labelKey'> {
  label: string;
  /** Current fit-score sort direction for this column. */
  sortDir: 'asc' | 'desc';
  candidates: KanbanCandidate[];
}

/** Labels are the rail's own (CANDIDATES.RAIL.*): a column and the rail name a step alike. */
export const BOARD_STAGES: BoardStageDef[] = [
  { key: 'PRESELECTION', labelKey: 'CANDIDATES.RAIL.PRESELECTION', icon: 'filter_alt',        accent: '#64748b', badgeBg: 'rgba(100,116,139,0.12)' },
  { key: 'INTERVIEWS',   labelKey: 'CANDIDATES.RAIL.INTERVIEWS',   icon: 'record_voice_over', accent: '#3755c3', badgeBg: 'rgba(55,85,195,0.12)'   },
  { key: 'OFFER',        labelKey: 'CANDIDATES.RAIL.OFFER',        icon: 'handshake',         accent: '#d97706', badgeBg: 'rgba(217,119,6,0.12)'   },
  { key: 'HIRED',        labelKey: 'CANDIDATES.RAIL.HIRED',        icon: 'how_to_reg',        accent: '#16a34a', badgeBg: 'rgba(22,163,74,0.12)'   },
];

/** Statuses of an agreed offer whose RH file is not submitted yet (legacy IT / e-mail codes included). */
const ONBOARDING_STATUSES = ['HR_IN_PROGRESS', 'IT_IN_PROGRESS', 'EMAIL_RECEIVED'];

/**
 * The hire is still being onboarded: the RH file is open, or — once it is submitted (HIRED,
 * the employee profile exists) — the IT file is not closed yet. When both are done the
 * candidature leaves the board.
 */
function onboardingOpen(c: KanbanCandidate): boolean {
  const status = c.status ?? '';
  if (ONBOARDING_STATUSES.includes(status)) return true;
  return status === 'HIRED' && !!c.itStatus && c.itStatus !== 'COMPLETED';
}

/** Every live interview has its PV (status DONE) — the rail's « Entretiens » done rule. */
function interviewsFiled(c: KanbanCandidate): boolean {
  const total = c.interviewsTotal ?? 0;
  return total > 0 && (c.interviewsFiled ?? 0) >= total;
}

/**
 * The step a candidature is at, or null when it is closed without a hire (rejected,
 * archived).
 */
export function candidatureStage(c: KanbanCandidate): BoardStageKey | null {
  const status = c.status ?? '';
  if (status === 'PENDING') {
    return (c.interviewsTotal ?? 0) === 0 ? 'PRESELECTION' : 'INTERVIEWS';
  }
  if (status === 'ACCEPTED' || status === 'OFFER_SENT') return 'OFFER';
  if (onboardingOpen(c)) return 'HIRED';
  return null;
}

/**
 * Where the candidature stands INSIDE its step, as a translation key + params — the rail's
 * subtitle, word for word (CANDIDATES.RAIL.*), so the card and the candidate page agree.
 * Null when there is nothing more precise to say.
 */
export function stepDetail(c: KanbanCandidate): { key: string; params?: Record<string, unknown> } | null {
  const total = c.interviewsTotal ?? 0;
  switch (candidatureStage(c)) {
    case 'PRESELECTION':
      return { key: 'CANDIDATES.RAIL.PRESELECTION_TODO' };
    case 'HIRED':
      // RH file submitted, the IT file is what is left.
      if (c.status === 'HIRED') return { key: 'CANDIDATES.RAIL.HIRED_IT_PENDING' };
      return c.progressPercent != null
        ? { key: 'CANDIDATES.RAIL.HIRED_ONBOARDING_PCT', params: { pct: c.progressPercent } }
        : { key: 'CANDIDATES.RAIL.HIRED_ONBOARDING' };
    case 'INTERVIEWS': {
      if (total === 0) return { key: 'CANDIDATES.RAIL.INTERVIEWS_NONE' };
      // PVs still being filed → how many are in; all in → how many verdicts RH has given.
      if (!interviewsFiled(c)) {
        return { key: 'CANDIDATES.RAIL.INTERVIEWS_PV', params: { filed: c.interviewsFiled ?? 0, total } };
      }
      const validated = c.interviewsValidated ?? 0;
      return validated >= total
        ? { key: 'CANDIDATES.RAIL.INTERVIEWS_VERDICTS_DONE' }
        : { key: 'CANDIDATES.RAIL.INTERVIEWS_VERDICTS', params: { validated, total } };
    }
    case 'OFFER': {
      const round = c.offerRound ?? 1;
      if (!c.offerStatus)                                              return { key: 'CANDIDATES.RAIL.OFFER_NONE' };
      if (c.offerStatus === 'DRAFT' && c.offerProposedBy === 'CANDIDATE') return { key: 'CANDIDATES.RAIL.OFFER_CANDIDATE_COUNTER', params: { round } };
      if (c.offerStatus === 'DRAFT' && c.offerProposedBy === 'DAF')       return { key: 'CANDIDATES.RAIL.OFFER_DAF_TO_SEND', params: { round } };
      if (c.offerStatus === 'DRAFT')                                    return { key: 'CANDIDATES.RAIL.OFFER_DAF', params: { round } };
      if (c.offerStatus === 'SENT')                                     return { key: 'CANDIDATES.RAIL.OFFER_CANDIDATE', params: { round } };
      return null;
    }
    default:
      return null;
  }
}

/**
 * Days left before a candidature on a filled demand is archived (V137): 0 = today, negative
 * never (the server archives it at its next check, so « today » covers the overdue few
 * minutes). Null when no archive is planned — a post is still open.
 */
export function archiveDaysLeft(c: KanbanCandidate, today: Date = new Date()): number | null {
  if (!c.archiveDueDate) return null;
  const [y, m, d] = c.archiveDueDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const due   = Date.UTC(y, m - 1, d);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((due - start) / 86_400_000));
}

/** Highest fit score first; candidates without a score sink to the bottom. */
export function byFitScoreDesc(a: KanbanCandidate, b: KanbanCandidate): number {
  return (b.fitScore ?? -1) - (a.fitScore ?? -1);
}

/** An offer round is with the candidate, awaiting their answer. */
export function isOfferPending(c: KanbanCandidate): boolean {
  return c.status === 'OFFER_SENT' && (c.offerStatus ?? 'SENT') === 'SENT';
}

/** Only an accepted candidate can be sent an offer. */
export function canSendOffer(c: KanbanCandidate): boolean {
  return c.status === 'ACCEPTED';
}
