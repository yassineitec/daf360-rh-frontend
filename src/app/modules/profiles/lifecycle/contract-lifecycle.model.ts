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
  PORTAGE:     { label: 'Portage',      needsEndDate: false, hasTrial: false },
};
