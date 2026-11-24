import { BadgeOptions } from '@khalilrebhiitec/daf360';

/**
 * One line of a module's « Historique » (rh-service HistoryEntryDto) — the shape shared by
 * Onboarding, Passage en CDI and Offboarding. The Candidats page maps its own richer lines
 * into it.
 */
export interface HistoryEntry {
  id: string;
  /** ISO instant, UTC. */
  timestamp: string;
  /** The part of the file the action touched — module-specific code. */
  category: string | null;
  /** Action code — translated by the page. */
  action: string;
  actorId: number | null;
  actorName: string | null;
  /** Outcome of the action — module-specific code; null when it has none. */
  status: string | null;
  comment: string | null;
  details: Record<string, string> | null;
  /** The file the line is about: what a row click opens. */
  subjectId: number | null;
  subjectName: string | null;
  subjectSubtitle: string | null;
  subjectProfileId?: number | null;
  subjectPhotoUrl?: string | null;
  subjectGender?: string | null;
}

/**
 * What the page tells the table about its module: the subject column's name and the labels
 * of its codes. Functions, so they translate in the current language (the table re-reads
 * them on a language change).
 */
export interface HistoryLabels {
  /** Header of the subject column (« Candidat », « Collaborateur »…). */
  subject: () => string;
  /** Filter label of the subject's second line; omitted = no such filter. */
  subtitle?: () => string;
  action: (e: HistoryEntry) => string;
  category: (code: string) => string;
  status: (code: string) => string;
  /** Second line under the subject's name, as shown (e.g. a translated departure type). */
  subtitleText?: (e: HistoryEntry) => string;
  /** Overrides the generic detail line (facts + comment). */
  detail?: (e: HistoryEntry) => string;
  /** Translation prefix for detail keys, tried before HISTORY.DETAIL.* (e.g. 'CANDIDATES.HISTORY.DETAIL.'). */
  detailPrefix?: string;
  categoryVariant?: (code: string) => BadgeOptions['variant'];
  statusVariant?: (code: string) => BadgeOptions['variant'];
}
