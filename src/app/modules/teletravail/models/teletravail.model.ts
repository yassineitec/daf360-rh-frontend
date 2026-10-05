/**
 * Télétravail — remote work, ONE day or HALF a day per request.
 *
 * The duration is a category shared with the congés (FULL_DAY / HALF_DAY_MORNING /
 * HALF_DAY_AFTERNOON) so both desks mean the same thing by « demi-journée ». The days a
 * request costs (1 or 0.5) are derived server-side and never sent.
 */

/** The same DemandeEtat the congés and autorisations use. */
export type TeletravailEtat = 'EN_ATTENTE' | 'VALIDE' | 'REFUSE' | 'ARCHIVE';

export type TeletravailCategory = 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON';

/** The entity rule: which durations its employees may ask for. */
export type TeletravailDurations = 'BOTH' | 'FULL_DAY' | 'HALF_DAY';

export interface TeletravailRow {
  id: number;

  collaborateurId: number;
  collaborateurNom: string | null;
  collaborateurAvatarUrl: string | null;
  responsableId: number | null;
  responsableNom: string | null;
  paysId: number | null;

  dateTeletravail: string;
  category: TeletravailCategory;
  categoryLabel: string | null;
  /** 1 or 0.5. */
  jours: number;

  etatDemande: TeletravailEtat;
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
  /** soldeTeletravail was debited for it — archiving gives the days back. */
  balanceDebited: boolean;

  createdAt: string | null;
}

export interface TeletravailPage {
  content: TeletravailRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface TeletravailFilter {
  etat?: TeletravailEtat | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  size?: number;
  sort?: string | null;
  dir?: 'asc' | 'desc' | null;
}

export type TeletravailCounts = Record<string, number>;
