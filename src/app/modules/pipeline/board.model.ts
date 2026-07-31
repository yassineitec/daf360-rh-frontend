import { KanbanCandidate } from './services/pipeline.service';

/** The four board stages, in workflow order. REJETE is intentionally not a column. */
export type BoardStageKey = 'SCREENING' | 'ENTRETIEN' | 'OFFRE' | 'RECRUTE';

/** Static stage definition; `label` is resolved through i18n at render time. */
export interface BoardStageDef {
  key: BoardStageKey;
  labelKey: string;
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

export const BOARD_STAGES: BoardStageDef[] = [
  { key: 'SCREENING', labelKey: 'PIPELINE.STAGE.SCREENING', accent: '#3755c3', badgeBg: 'rgba(55,85,195,0.12)'   },
  { key: 'ENTRETIEN', labelKey: 'PIPELINE.STAGE.ENTRETIEN', accent: '#0d9488', badgeBg: 'rgba(13,148,136,0.12)'  },
  { key: 'OFFRE',     labelKey: 'PIPELINE.STAGE.OFFRE',     accent: '#d97706', badgeBg: 'rgba(217,119,6,0.12)'   },
  { key: 'RECRUTE',   labelKey: 'PIPELINE.STAGE.RECRUTE',   accent: '#047857', badgeBg: 'rgba(4,120,87,0.12)'    },
];

/**
 * Offboarding is a separate HR workflow, not a candidate stage — it gets a
 * neutral slate accent so it never reads as part of the recruitment funnel.
 */
export const OFFBOARDING_KEY    = 'OFFBOARDING';
export const OFFBOARDING_ACCENT = '#64748b';

/** Highest fit score first; candidates without a score sink to the bottom. */
export function byFitScoreDesc(a: KanbanCandidate, b: KanbanCandidate): number {
  return (b.fitScore ?? -1) - (a.fitScore ?? -1);
}

/** An offer is awaiting the candidate's answer. */
export function isOfferPending(c: KanbanCandidate): boolean {
  return c.status === 'OFFER_SENT' || (c.offerStatus ?? '') === 'SENT';
}

/** Only an accepted candidate can be sent an offer. */
export function canSendOffer(c: KanbanCandidate): boolean {
  return c.status === 'ACCEPTED';
}
