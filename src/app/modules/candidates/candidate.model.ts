
// FILE: candidate.model.ts
export type CandidateStatus =
  'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IT_IN_PROGRESS' |
  'EMAIL_RECEIVED' | 'HR_IN_PROGRESS' | 'HIRED' | 'ARCHIVED';

export type ItProvisioningStatus = 'PENDING' | 'IN_PROGRESS' | 'EMAIL_CREATED' | 'COMPLETED';

export interface CandidateListItem {
  id: number;
  firstName: string;
  lastName: string;
  emailPersonal: string;
  appliedPosition: string | null;
  appliedGrade:    string | null;
  contractType:    string | null;
  expectedStartDate: string | null;
  status: CandidateStatus;
  createdAt: string;
}

export interface ItProvisioningSummary {
  id: number;
  status: ItProvisioningStatus;
  ms365Email:       string | null;
  assetsProvided:   number;          // count of provided assets (V23 — replaces individual booleans)
  hardwareNotes:    string | null;
  licenseOffice365: boolean;
  licenseAutocad:   boolean;
  licenseRevit:     boolean;
  licenseAutodesk:  boolean;
  licenseKaspersky: boolean;
  licenseOther:     string | null;
  adAccountCreated: boolean;
  adProfileType:    string | null;
  completedBy:      number | null;
  completedAt:      string | null;
}

export interface CandidateDetail {
  id: number;
  paysId: number;
  firstName: string;
  lastName: string;
  emailPersonal: string;
  phone:          string | null;
  dateOfBirth:    string | null;
  nationality:    string | null;
  nationalityId:  number | null;
  nationalId:     string | null;
  appliedPosition:    string | null;
  appliedGrade:       string | null;
  appliedGradeId:     number | null;
  appliedDiscipline:  string | null;
  appliedDisciplineId: number | null;
  department:         string | null;
  departmentId:       number | null;
  contractType:    string | null;
  expectedStartDate: string | null;
  status: CandidateStatus;
  rejectionReason: string | null;
  createdBy:  number;
  acceptedBy: number | null;
  acceptedAt: string | null;
  createdAt:  string;
  updatedAt:  string | null;
  notes:      string | null;
  cvPath:         string | null;
  cvOriginalName: string | null;
  cvUploadedAt:   string | null;
  itProvisioning: ItProvisioningSummary | null;
}

export interface CreateCandidateRequest {
  paysId: number;
  firstName: string;
  lastName: string;
  emailPersonal: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  nationalityId?: number | null;
  nationalId?: string | null;
  appliedPosition?: string | null;
  appliedGradeId?: number | null;
  appliedDisciplineId?: number | null;
  departmentId?: number | null;
  contractType?: string | null;
  expectedStartDate?: string | null;
  notes?: string | null;
}

export interface UpdateCandidateRequest {
  firstName?: string;
  lastName?: string;
  emailPersonal?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  appliedPosition?: string | null;
  appliedGradeId?: number | null;
  appliedDisciplineId?: number | null;
  departmentId?: number | null;
  nationalityId?: number | null;
  contractType?: string | null;
  expectedStartDate?: string | null;
  notes?: string | null;
}

export interface CandidateFilter {
  paysId?: number | null;
  status?: CandidateStatus | '';
  search?: string;
  page?: number;
  size?: number;
}

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  PENDING:        'En attente',
  ACCEPTED:       'Accepté',
  REJECTED:       'Rejeté',
  IT_IN_PROGRESS: 'IT en cours',
  EMAIL_RECEIVED: 'Email reçu',
  HR_IN_PROGRESS: 'RH en cours',
  HIRED:          'Embauché',
  ARCHIVED:       'Archivé',
};

export const STAFF_TYPE_OPTIONS: { value: string; label: string }[] = [];

export const CONTRACT_TYPE_OPTIONS = [
  { value: '', label: 'Tous les contrats' },
  { value: 'PERMANENT',   label: 'CDI' },
  { value: 'FIXED_TERM',  label: 'CDD' },
  { value: 'INTERN',      label: 'Stage' },
  { value: 'CONSULTANT',  label: 'Consultant' },
];

export const CANDIDATE_STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'PENDING',        label: 'En attente' },
  { value: 'ACCEPTED',       label: 'Accepté' },
  { value: 'REJECTED',       label: 'Rejeté' },
  { value: 'IT_IN_PROGRESS', label: 'IT en cours' },
  { value: 'EMAIL_RECEIVED', label: 'Email reçu' },
  { value: 'HR_IN_PROGRESS', label: 'RH en cours' },
  { value: 'HIRED',          label: 'Embauché' },
  { value: 'ARCHIVED',       label: 'Archivé' },
];

export interface CandidateStats {
  total: number;
  pending: number;
  hiredThisMonth: number;
}

export interface CandidateHistoryItem {
  id: number;
  timestamp: string;
  action: string;
  actionLabel: string;
  performedByName: string | null;
  comment: string | null;
  resultingStatus: string | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
