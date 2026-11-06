/**
 * Autorisations — short paid absences, measured in MINUTES.
 *
 * Deliberately not reusing the congé model: an autorisation has no type catalogue, no
 * category, no day count and no balance. What it shares is the workflow states, which is why
 * `etatDemande` carries the same four values.
 */

/** The same DemandeEtat the congés use — one vocabulary across both desks. */
export type AutorisationEtat = 'EN_ATTENTE' | 'VALIDE' | 'REFUSE' | 'ARCHIVE';

export interface AutorisationRow {
  id: number;

  collaborateurId: number;
  collaborateurNom: string | null;
  collaborateurAvatarUrl: string | null;
  responsableId: number | null;
  responsableNom: string | null;
  paysId: number | null;

  dateAutorisation: string;
  /** 'HH:mm:ss' as the server sends it. */
  startTime: string;
  endTime: string;
  /** Minutes. The UI formats "1 h 30" from this rather than storing a rendered string. */
  dureeMinutes: number;

  etatDemande: AutorisationEtat;
  etatLabel: string;
  reason: string | null;
  motifRefus: string | null;
  motifAnnulation: string | null;

  dateValidation: string | null;
  decidedBy: number | null;
  decidedByNom: string | null;
  createdBy: number | null;
  createdByNom: string | null;
  /** Filed by somebody other than the employee — a régularisation. */
  settled: boolean;

  createdAt: string | null;
}

export interface AutorisationPage {
  content: AutorisationRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * The caps in force, and what is left of the monthly one.
 *
 * A null cap means NO LIMIT for that entity, not zero — the gauge is hidden rather than
 * drawn empty.
 */
export interface AutorisationQuota {
  dailyCapMinutes: number | null;
  monthlyCapMinutes: number | null;
  maxPerDay: number | null;
  noticeDays: number | null;
  requiresJustification: boolean;
  monthlyUsedMinutes: number;
  monthlyRemainingMinutes: number | null;
}

/** `dureeMinutes` is absent on purpose — the server computes it from start and end. */
export interface AutorisationCreate {
  dateAutorisation: string;
  startTime: string;
  endTime: string;
  responsableId?: number | null;
  responsableAdjointId?: number | null;
  reason?: string | null;
}

export interface AutorisationFilter {
  etat?: AutorisationEtat | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  size?: number;
  sort?: string | null;
  dir?: 'asc' | 'desc' | null;
}

export type AutorisationCounts = Record<string, number>;
