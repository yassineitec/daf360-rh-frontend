// ─────────────────────────────────────────────────────────────────────────────
// Contract Lifecycle Engine — TypeScript types (mirrors D3-95 backend DTOs)
// ─────────────────────────────────────────────────────────────────────────────

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

export type ContractTypeCode = 'CDI' | 'CDD' | 'CIVP' | 'STAGE' | 'DETACHEMENT' | 'PORTAGE';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export interface ContractListDto {
  id:                   number;
  employeeProfileId:    number;
  contractTypeCode:     ContractTypeCode;
  currentStatusCode:    ContractStatus;
  dateDebut:            string;
  dateFinPrevue:        string | null;
  dateFinPeriodeEssai:  string | null;
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
  currentStatusCode:          ContractStatus;
  dateDebut:                  string;
  dateFinPrevue:              string | null;
  dateFinReelle:              string | null;
  dateFinPeriodeEssai:        string | null;
  periodeEssaiRenouvelee:     boolean | null;
  dateFinPeRenouvellement:    string | null;
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
  contractTypeCode:           ContractTypeCode;
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
  label: string;
  bg:    string;
  color: string;
}

export const STATUS_CONFIG: Record<ContractStatus, StatusConfig> = {
  DRAFT:          { label: 'Brouillon',        bg: '#f1f5f9', color: '#475569' },
  ACTIF:          { label: 'Actif',             bg: '#d1fae5', color: '#065f46' },
  PERIODE_ESSAI:  { label: "Période d'essai",   bg: '#fef9c3', color: '#713f12' },
  ACTIF_CONFIRME: { label: 'Confirmé',          bg: '#d1fae5', color: '#065f46' },
  EXPIRE:         { label: 'Expiré',            bg: '#fee2e2', color: '#991b1b' },
  RESILIE:        { label: 'Résilié',           bg: '#fee2e2', color: '#991b1b' },
  CONVERTI:       { label: 'Converti en CDI',   bg: '#e0e7ff', color: '#3730a3' },
  RENOUVELE:      { label: 'Renouvelé',         bg: '#dbeafe', color: '#1e40af' },
  INACTIF:        { label: 'Inactif',           bg: '#f1f5f9', color: '#94a3b8' },
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
  PORTAGE:     { label: 'Portage',      needsEndDate: false, hasTrial: false },
};
