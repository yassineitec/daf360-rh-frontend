import { KanbanCandidate } from './services/pipeline.service';

/**
 * The candidature board's columns are the recruitment STEPS (the same ones the candidate
 * page's « Étape actuelle » card walks through), in order:
 *
 *   1. INTERVIEWS  — PENDING, interviews still to plan or a PV still missing.
 *   2. VALIDATION  — PENDING, every live interview has its PV: RH validates them, then
 *                    validates the candidature (status leaves PENDING).
 *   3. OFFER       — ACCEPTED / OFFER_SENT: the salary negotiation, round after round.
 *
 * Nothing after the offer: once both parties agree the candidate is handed to onboarding
 * (IT provisioning included) and is followed on « Pipeline RH », not here. Rejected and
 * archived candidatures are not a column either — they are closed.
 */
export type BoardStageKey = 'INTERVIEWS' | 'VALIDATION' | 'OFFER';

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
  { key: 'INTERVIEWS', labelKey: 'CANDIDATES.RAIL.INTERVIEWS', icon: 'record_voice_over', accent: '#3755c3', badgeBg: 'rgba(55,85,195,0.12)'  },
  { key: 'VALIDATION', labelKey: 'CANDIDATES.RAIL.VALIDATION', icon: 'fact_check',        accent: '#0d9488', badgeBg: 'rgba(13,148,136,0.12)' },
  { key: 'OFFER',      labelKey: 'CANDIDATES.RAIL.OFFER',      icon: 'handshake',         accent: '#d97706', badgeBg: 'rgba(217,119,6,0.12)'  },
];

/** Every live interview has its PV (status DONE) — the rail's « Entretiens » done rule. */
function interviewsFiled(c: KanbanCandidate): boolean {
  const total = c.interviewsTotal ?? 0;
  return total > 0 && (c.interviewsFiled ?? 0) >= total;
}

/**
 * The step a candidature is at, or null when it is no candidature any more (offer agreed →
 * onboarding, hired, rejected, archived).
 */
export function candidatureStage(c: KanbanCandidate): BoardStageKey | null {
  switch (c.status) {
    case 'PENDING':    return interviewsFiled(c) ? 'VALIDATION' : 'INTERVIEWS';
    case 'ACCEPTED':
    case 'OFFER_SENT': return 'OFFER';
    default:           return null;
  }
}

/**
 * Where the candidature stands INSIDE its step, as a translation key + params — the rail's
 * subtitle, word for word (CANDIDATES.RAIL.*), so the card and the candidate page agree.
 * Null when there is nothing more precise to say.
 */
export function stepDetail(c: KanbanCandidate): { key: string; params?: Record<string, unknown> } | null {
  const total = c.interviewsTotal ?? 0;
  switch (candidatureStage(c)) {
    case 'INTERVIEWS':
      return total === 0
        ? { key: 'CANDIDATES.RAIL.INTERVIEWS_NONE' }
        : { key: 'CANDIDATES.RAIL.INTERVIEWS_PV', params: { filed: c.interviewsFiled ?? 0, total } };
    case 'VALIDATION':
      return { key: 'CANDIDATES.RAIL.VALIDATION_COUNT', params: { validated: c.interviewsValidated ?? 0, total } };
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
