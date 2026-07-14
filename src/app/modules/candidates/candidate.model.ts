// FILE: candidate.model.ts
export type CandidateStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'OFFER_SENT'
  | 'REJECTED'
  | 'IT_IN_PROGRESS'
  | 'EMAIL_RECEIVED'
  | 'HR_IN_PROGRESS'
  | 'HIRED'
  | 'ARCHIVED';

export type ItProvisioningStatus = 'PENDING' | 'IN_PROGRESS' | 'EMAIL_CREATED' | 'COMPLETED';

export interface CandidateListItem {
  id: number;
  firstName: string;
  lastName: string;
  emailPersonal: string;
  /** Canonical GENDER code (MALE/FEMALE/…) — drives the avatar shown on cards/rows. */
  gender: string | null;
  appliedPosition: string | null;
  appliedGrade: string | null;
  contractType: string | null;
  expectedStartDate: string | null;
  status: CandidateStatus;
  createdAt: string;
  // --- enriched card fields (backend V39) ---
  experienceYears: number | null;
  location: string | null;
  fitScore: number | null;
  applicationDate: string | null;
  // --- next planned interview (kanban card footer) ---
  nextInterviewAt: string | null;
  nextInterviewLocation: string | null;
}

export interface ItProvisioningSummary {
  id: number;
  status: ItProvisioningStatus;
  ms365Email: string | null;
  assetsProvided: number; // count of provided assets (V23 — replaces individual booleans)
  hardwareNotes: string | null;
  licenseOffice365: boolean;
  licenseAutocad: boolean;
  licenseRevit: boolean;
  licenseAutodesk: boolean;
  licenseKaspersky: boolean;
  licenseOther: string | null;
  adAccountCreated: boolean;
  adProfileType: string | null;
  completedBy: number | null;
  completedAt: string | null;
}

export interface CandidateDetail {
  id: number;
  paysId: number;
  firstName: string;
  lastName: string;
  emailPersonal: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  nationalityId: number | null;
  nationalId: string | null;
  appliedPosition: string | null;
  appliedGrade: string | null;
  appliedGradeId: number | null;
  appliedDiscipline: string | null;
  appliedDisciplineId: number | null;
  department: string | null;
  departmentId: number | null;
  /**
   * Contract type. The backend exposes it as an EMPLOYMENT_TYPE list value
   * (employmentTypeId + resolved employmentTypeLabel), NOT a `contractType`
   * enum. `employmentTypeLabel` is the human label to display.
   */
  employmentTypeId: number | null;
  employmentTypeLabel: string | null;
  expectedStartDate: string | null;
  status: CandidateStatus;
  rejectionReason: string | null;
  createdBy: number;
  acceptedBy: number | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  notes: string | null;
  cvPath: string | null;
  cvOriginalName: string | null;
  cvUploadedAt: string | null;
  itProvisioning: ItProvisioningSummary | null;
  recruitmentDemandId: number | null;
  recruitmentDemandJobTitle: string | null;
  experienceYears: number | null;
  location: string | null;
}

export interface CreateCandidateRequest {
  paysId: number;
  firstName: string;
  lastName: string;
  emailPersonal: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationalityId?: number | null;
  nationalId?: string | null;
  appliedPosition?: string | null;
  appliedGradeId?: number | null;
  appliedDisciplineId?: number | null;
  departmentId?: number | null;
  contractType?: string | null;
  expectedStartDate?: string | null;
  notes?: string | null;
  recruitmentDemandId?: number | null;
  employmentTypeId?: number | null;
  experienceYears?: number | null;
  location?: string | null;
}

export interface UpdateCandidateRequest {
  firstName?: string;
  lastName?: string;
  emailPersonal?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  appliedPosition?: string | null;
  appliedGradeId?: number | null;
  appliedDisciplineId?: number | null;
  departmentId?: number | null;
  nationalityId?: number | null;
  contractType?: string | null;
  expectedStartDate?: string | null;
  notes?: string | null;
  experienceYears?: number | null;
  location?: string | null;
}

export interface CandidateFilter {
  paysId?: number | null;
  status?: CandidateStatus | '';
  search?: string;
  page?: number;
  size?: number;
}

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Accepté',
  OFFER_SENT: 'Offre envoyée',
  REJECTED: 'Rejeté',
  IT_IN_PROGRESS: 'IT en cours',
  EMAIL_RECEIVED: 'Email reçu',
  HR_IN_PROGRESS: 'RH en cours',
  HIRED: 'Embauché',
  ARCHIVED: 'Archivé',
};

export const STAFF_TYPE_OPTIONS: { value: string; label: string }[] = [];

export const CONTRACT_TYPE_OPTIONS = [
  { value: '', label: 'Tous les contrats' },
  { value: 'PERMANENT', label: 'CDI' },
  { value: 'FIXED_TERM', label: 'CDD' },
  { value: 'INTERN', label: 'Stage' },
  { value: 'CONSULTANT', label: 'Consultant' },
];

export const CANDIDATE_STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'ACCEPTED', label: 'Accepté' },
  { value: 'OFFER_SENT', label: 'Offre envoyée' },
  { value: 'REJECTED', label: 'Rejeté' },
  { value: 'IT_IN_PROGRESS', label: 'IT en cours' },
  { value: 'EMAIL_RECEIVED', label: 'Email reçu' },
  { value: 'HR_IN_PROGRESS', label: 'RH en cours' },
  { value: 'HIRED', label: 'Embauché' },
  { value: 'ARCHIVED', label: 'Archivé' },
];

export interface CandidateStats {
  total: number;
  pending: number;
  accepted: number;
  hired: number;
}

/** KPI-row metrics for the /candidates dashboard (mirrors the design's 3 tiles). */
export interface CandidateDashboardStats {
  totalCandidates: number;
  /** 30-day growth vs previous 30 days, in %. null when no prior-period baseline. */
  monthGrowthPct: number | null;
  /** All-time average days from creation to acceptance. null when no accepted candidates. */
  avgRecruitmentDays: number | null;
  /** 90-day trend of the avg delay (negative = faster). null when insufficient history. */
  avgRecruitmentDaysDelta: number | null;
  /** Open positions needing HR action (pending recruitment demands). */
  urgentPositions: number;
  // ── Funnel-health KPIs (Pipeline RH page) ──
  /** Candidates still active in the pipeline (not hired/rejected/archived). */
  activeCandidates: number;
  /** Total recruited (HIRED). */
  hiredTotal: number;
  /** Offer acceptance rate (%) among decided offers; null when none decided. */
  offerAcceptanceRate: number | null;
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

export interface HireCandidateRequest {
  hireDate: string; // ISO date (YYYY-MM-DD)
  contractTypeCode?: string; // optional override; derived from employmentTypeId if omitted
  dateFinPrevue?: string; // required for CDD, CIVP, STAGE, DETACHEMENT
  managerProfile: boolean;
  notes?: string | null;
}

export interface HireCandidateResponse {
  candidateId: number;
  employeeProfileId: number;
  contractId: number;
  contractTypeCode: string;
  userId: number;
  message: string;
}
