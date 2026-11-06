/**
 * Demandes de modification / annulation d'un congé déjà validé.
 *
 * Shapes rh-service's LeaveModificationDto. The labels are resolved server-side from the
 * caller's language, like the congé rows — duplicating the state and type wording here is how
 * the two fall out of step the first time one is reworded.
 */

/** MODIFICATION carries new dates; ANNULATION carries none. */
export type ModificationType = 'MODIFICATION' | 'ANNULATION';

/**
 * PENDING_MANAGER exists only for a MODIFICATION — an annulation is filed straight at
 * PENDING_HR, because giving days back takes nothing away from anyone.
 */
export type ModificationState =
  | 'PENDING_MANAGER'
  | 'PENDING_HR'
  | 'APPROVED'
  | 'REJECTED';

export interface CongeModificationRow {
  id: number;

  // ── The proposal ──────────────────────────────────────────────────────────
  type: ModificationType;
  typeLabel: string;
  etat: ModificationState;
  etatLabel: string;

  nouvelleDateDebut: string | null;
  nouvelleDateFin: string | null;
  nouveauTotal: number | null;

  /**
   * Proposed total minus current — negative means the employee gets days back. Computed by
   * the server so the figure an approver reads is the figure the approval applies; null when
   * the original congé could not be resolved, which is not the same as zero.
   */
  deltaJours: number | null;

  motif: string | null;
  motifRefus: string | null;

  // ── The congé it stands against ───────────────────────────────────────────
  absenceId: number;
  absenceType: string | null;
  absenceTypeLabel: string | null;
  absenceDateDebut: string | null;
  absenceDateFin: string | null;
  absenceTotalJours: number | null;

  // ── Who ───────────────────────────────────────────────────────────────────
  collaborateurId: number;
  collaborateurNom: string | null;
  collaborateurAvatarUrl: string | null;
  responsableId: number | null;
  responsableNom: string | null;

  // ── When ──────────────────────────────────────────────────────────────────
  createdAt: string | null;
  dateValidation: string | null;
}

/** The envelope every paginated rh endpoint returns. */
export interface CongeModificationPage {
  content: CongeModificationRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * The four KPI figures, counted over the whole scope rather than the page.
 *
 * `manager` is personal — what is waiting on this manager. The other three are the caller's
 * country perimeter, which is what the HR queue works over.
 */
export interface CongeModificationCounts {
  manager: number;
  hr: number;
  approved: number;
  rejected: number;
}

/** What the employee sends. `nouveauTotal` is absent on purpose — the server computes it. */
export interface CongeModificationCreate {
  absenceId: number;
  type: ModificationType;
  nouvelleDateDebut?: string | null;
  nouvelleDateFin?: string | null;
  motif?: string | null;
}

export interface CongeModificationFilter {
  page?: number;
  size?: number;
  sort?: string | null;
  dir?: 'asc' | 'desc' | null;
}
