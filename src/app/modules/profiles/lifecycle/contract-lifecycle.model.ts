// ─────────────────────────────────────────────────────────────────────────────
// Contract Lifecycle Engine — TypeScript types (mirrors D3-95 backend DTOs)
// ─────────────────────────────────────────────────────────────────────────────

import type { BadgeOptions } from '@khalilrebhiitec/daf360';

export type ContractStatus =
  | 'DRAFT'
  | 'ACTIF'
  | 'PERIODE_ESSAI'
  | 'ACTIF_CONFIRME'
  | 'EXPIRE'
  | 'RESILIE'
  | 'CONVERTI'
  | 'RENOUVELE'
  | 'INACTIF';

/**
 * Lifecycle nature of a contract — the backend's ContractTypeRefs.NATURES (FREELANCE), plus
 * the legacy PORTAGE. A CONTRACT_TYPE list value (« contrat »…) maps to one through its
 * `lifecycleNature`; the contract itself stores the list value's id.
 */
export type ContractTypeCode = 'CDI' | 'CDD' | 'CIVP' | 'STAGE' | 'DETACHEMENT' | 'FREELANCE' | 'PORTAGE';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export interface ContractListDto {
  id:                   number;
  employeeProfileId:    number;
  contractTypeCode:     ContractTypeCode;
  /** configurable_list_values.id of the CONTRACT_TYPE value the contract stores. */
  contractTypeId?:      number | null;
  /** That value's label (« contrat », « CDI — Durée indéterminée »…). */
  contractTypeLabel?:   string | null;
  currentStatusCode:    ContractStatus;
  dateDebut:            string;
  dateFinPrevue:        string | null;
  dateFinPeriodeEssai:  string | null;
  /** Trial renewed (decision RENEW_TRIAL) — it then ends on `dateFinPeRenouvellement`. */
  periodeEssaiRenouvelee?:  boolean | null;
  dateFinPeRenouvellement?: string | null;
  /** Times the trial was renewed. */
  trialRenewalCount?:       number | null;
  /** Resolved « Décider » rules: the type's own, else its nature's (backend ContractRules). */
  trialRenewable?:          boolean | null;
  trialMaxRenewals?:        number | null;
  /** No préavis frozen on the contract: the grade's default, shown as a hint. */
  defaultNoticeDays?:       number | null;
  dateFinReelle?:           string | null;
  /** Préavis frozen on this contract; null on contracts created before V69. */
  noticePeriodDays:     number | null;
  /** GRADE_DEFAULT | NEGOTIATED | MANUAL — explains the figure rather than just showing it. */
  noticePeriodSource:   string | null;
  isActive:             boolean;
  dossierLocked:        boolean;
  referenceContrat:     string | null;
  createdAt:            string;
}

export interface ContractDetailDto {
  id:                         number;
  employeeProfileId:          number;
  paysId:                     number;
  contractTypeCode:           ContractTypeCode;
  contractTypeId?:            number | null;
  contractTypeLabel?:         string | null;
  currentStatusCode:          ContractStatus;
  dateDebut:                  string;
  dateFinPrevue:              string | null;
  dateFinReelle:              string | null;
  dateFinPeriodeEssai:        string | null;
  periodeEssaiRenouvelee:     boolean | null;
  dateFinPeRenouvellement:    string | null;
  /** Préavis frozen on this contract (V69); null on contracts created before it existed. */
  noticePeriodDays:           number | null;
  /** GRADE_DEFAULT | NEGOTIATED | MANUAL */
  noticePeriodSource:         string | null;
  endReasonCode:              string | null;
  endNotes:                   string | null;
  referenceContrat:           string | null;
  // CIVP
  civpAnetiReference:         string | null;
  civpConventionDate:         string | null;
  // STAGE
  stageEcole:                 string | null;
  stageTuteurId:              number | null;
  stageConventionSignee:      boolean | null;
  // FREELANCE / PORTAGE
  freelanceTjm:               number | null;
  freelanceDevise:            string | null;
  freelanceSociete:           string | null;
  // DETACHEMENT
  detachementEntiteOrigineId: number | null;
  detachementEntiteAccueilId: number | null;
  detachementRetourPrevu:     string | null;
  // CDD
  cddRenouvellementCount:     number | null;
  cddContratParentId:         number | null;
  avenantParentId:            number | null;
  isActive:                   boolean;
  isArchived:                 boolean;
  dossierLocked:              boolean;
  createdBy:                  number | null;
  createdAt:                  string;
  updatedAt:                  string | null;
}

export interface ContractTransitionHistoryDto {
  id:                 number;
  contractId:         number;
  employeeProfileId:  number;
  statutAvant:        string;
  statutApres:        string;
  actionCode:         string;
  triggeredByUserId:  number | null;
  triggeredAt:        string;
  commentaire:        string | null;
  documentReference:  string | null;
  /** Users.fullName of who triggered it. */
  triggeredByName?:   string | null;
  /** Date moves (renewal, extension): end date before → after. */
  previousDate?:      string | null;
  newDate?:           string | null;
}

export interface LifecycleAlertDto {
  id:               number;
  contractId:       number;
  employeeProfileId: number;
  alertType:        string;
  alertDate:        string;
  targetDate:       string;
  recipients:       string;
  isSent:           boolean;
  sentAt:           string | null;
  isAcknowledged:   boolean;
  acknowledgedBy:   number | null;
  acknowledgedAt:   string | null;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface CreateContractRequest {
  employeeProfileId:          number;
  paysId:                     number;
  /** A CONTRACT_TYPE list value id (as text) or a code (CDI…) — the backend stores the id. */
  contractTypeCode:           string;
  dateDebut:                  string;
  dateFinPrevue?:             string | null;
  referenceContrat?:          string | null;
  managerProfile?:            boolean;
  civpAnetiReference?:        string | null;
  civpConventionDate?:        string | null;
  stageEcole?:                string | null;
  stageTuteurId?:             number | null;
  stageConventionSignee?:     boolean | null;
  freelanceTjm?:              number | null;
  freelanceDevise?:           string | null;
  freelanceSociete?:          string | null;
  detachementEntiteOrigineId?: number | null;
  detachementEntiteAccueilId?: number | null;
  detachementRetourPrevu?:    string | null;
  cddContratParentId?:        number | null;
  /**
   * Préavis in calendar days, frozen onto the contract (V69). Omit/null to let the backend
   * resolve it from the candidate's accepted offer, then the employee's grade default.
   * 0 is a real value — "aucun préavis dû" — and is sent as such.
   */
  noticePeriodDays?:          number | null;
}

export interface TransitionRequest {
  newStatus:         ContractStatus;
  actionCode:        string;
  commentaire?:      string | null;
  documentReference?: string | null;
  endReasonCode?:    string | null;
}

export interface ValidateTrialRequest {
  approved:     boolean;
  commentaire?: string | null;
}

/**
 * What a decision does — fixed by the backend (ContractDecisionAction). The admin names the
 * choices (list CONTRACT_DECISION) and picks which ones each contract type offers.
 */
export type ContractDecisionAction =
  | 'CONFIRM_TRIAL' | 'RENEW_TRIAL' | 'BREAK_TRIAL'
  | 'RENEW_CDD' | 'EXTEND' | 'END_CONTRACT';

export const TRIAL_DECISION_ACTIONS: ContractDecisionAction[] = ['CONFIRM_TRIAL', 'RENEW_TRIAL', 'BREAK_TRIAL'];
export const END_DECISION_ACTIONS:   ContractDecisionAction[] = ['RENEW_CDD', 'EXTEND', 'END_CONTRACT'];

export interface ContractDecisionOption {
  /** CONTRACT_DECISION list value id — what /decide takes. */
  id:            number;
  action:        ContractDecisionAction;
  labelFr:       string;
  labelEn:       string;
  requiresDate:  boolean;
  /** Why it cannot be taken now; null = available. */
  blockedReason: string | null;
}

/** GET /api/hr/contracts/{id}/decisions. `moment` null = nothing to decide. */
export interface ContractDecisionOptions {
  moment:   'TRIAL_END' | 'CONTRACT_END' | null;
  deadline: string | null;
  options:  ContractDecisionOption[];
}

export interface ContractDecisionRequest {
  decisionId:   number;
  newDate?:     string | null;
  commentaire?: string | null;
}

export interface RenewCDDRequest {
  newDateFin:   string;
  commentaire?: string | null;
}

export interface ConvertToCDIRequest {
  cdiStartDate: string;
  commentaire?: string | null;
}

// ── UI Config ─────────────────────────────────────────────────────────────────

export interface StatusConfig {
  label:   string;
  variant: BadgeOptions['variant'];
}

export const STATUS_CONFIG: Record<ContractStatus, StatusConfig> = {
  DRAFT:          { label: 'Brouillon',        variant: 'neutral' },
  ACTIF:          { label: 'Actif',            variant: 'success' },
  PERIODE_ESSAI:  { label: "Période d'essai",  variant: 'warning' },
  ACTIF_CONFIRME: { label: 'Confirmé',         variant: 'success' },
  EXPIRE:         { label: 'Expiré',           variant: 'danger'  },
  RESILIE:        { label: 'Résilié',          variant: 'danger'  },
  CONVERTI:       { label: 'Converti en CDI',  variant: 'info'    },
  RENOUVELE:      { label: 'Renouvelé',        variant: 'info'    },
  INACTIF:        { label: 'Inactif',          variant: 'neutral' },
};

export interface ContractTypeConfig {
  label:        string;
  needsEndDate: boolean;
  hasTrial:     boolean;
}

export const CONTRACT_TYPE_CONFIG: Record<ContractTypeCode, ContractTypeConfig> = {
  CDI:         { label: 'CDI',          needsEndDate: false, hasTrial: true  },
  CDD:         { label: 'CDD',          needsEndDate: true,  hasTrial: false },
  CIVP:        { label: 'CIVP',         needsEndDate: true,  hasTrial: false },
  STAGE:       { label: 'Stage',        needsEndDate: true,  hasTrial: false },
  DETACHEMENT: { label: 'Détachement',  needsEndDate: true,  hasTrial: false },
  FREELANCE:   { label: 'Freelance',    needsEndDate: false, hasTrial: false },
  PORTAGE:     { label: 'Portage',      needsEndDate: false, hasTrial: false },
};

/** The nature of a CONTRACT_TYPE list value — mirrors ContractTypeRefs.natureOf (backend). */
export function contractNatureOf(v: { lifecycleNature?: string | null; valueCode: string } | null | undefined): ContractTypeCode {
  const known = (c: string | null | undefined) => {
    const u = (c ?? '').trim().toUpperCase();
    return u && u !== 'PORTAGE' && u in CONTRACT_TYPE_CONFIG ? u as ContractTypeCode : null;
  };
  return known(v?.lifecycleNature) ?? known(v?.valueCode)
    ?? ((v?.valueCode ?? '').trim().toUpperCase() === 'PORTAGE' ? 'FREELANCE' : 'CDI');
}
