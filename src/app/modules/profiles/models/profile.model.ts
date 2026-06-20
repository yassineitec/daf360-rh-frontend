// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle state machine (mirrors backend LifecycleStatus enum)
// ─────────────────────────────────────────────────────────────────────────────
export type LifecycleStatus =
  | 'PRE_ONBOARDING'
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'ON_MISSION'
  | 'OFFBOARDING'
  | 'TERMINATED'
  | 'ARCHIVED';

export const LIFECYCLE_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  PRE_ONBOARDING: ['ACTIVE'],
  ACTIVE:         ['ON_LEAVE', 'ON_MISSION', 'OFFBOARDING'],
  ON_LEAVE:       ['ACTIVE'],
  ON_MISSION:     ['ACTIVE'],
  OFFBOARDING:    ['TERMINATED'],
  TERMINATED:     ['ARCHIVED'],
  ARCHIVED:       [],
};

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  PRE_ONBOARDING: 'Pré-onboarding',
  ACTIVE:         'Actif',
  ON_LEAVE:       'En congé',
  ON_MISSION:     'En mission',
  OFFBOARDING:    'Offboarding',
  TERMINATED:     'Terminé',
  ARCHIVED:       'Archivé',
};

// ─────────────────────────────────────────────────────────────────────────────
// DTOs (mirror backend EmployeeProfileResponseDto / SummaryDto)
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfileSummary {
  id:              number;
  userId:          number;
  paysId:          number;
  lifecycleStatus: LifecycleStatus;
  department:      string | null;
  grade:           string | null;
  contractType:    string | null;
  hireDate:        string | null;
  photoUrl:        string | null;
  // Enriched by backend or secondary call
  employeeId?:     string | null;
  fullName?:       string | null;
  paysLabel?:      string | null;
}

export interface EmployeeProfile {
  id:              number;
  userId:          number;
  paysId:          number;
  lifecycleStatus: LifecycleStatus;

  // ── Depuis Users (enrichi par le service) ────────────────────────────────
  matricule:       string | null;   // format [NOM3][PRE3][userId] ex: DUPPIE125
  fullName:        string | null;   // Users.fullName

  // ── Employment ──────────────────────────────────────────────
  hireDate:          string | null;
  contractType:      string | null;
  contractEndDate:   string | null;
  probationEndDate:  string | null;
  isOnProbation:     boolean;

  // ── Personal ────────────────────────────────────────────────
  dateOfBirth:       string | null;
  gender:            string | null;
  nationality:       string | null;   // text label from response DTO
  nationalityId:     number | null;   // FK ID for dimension table
  nationalId:        string | null;
  passportNumber:    string | null;
  photoUrl:          string | null;
  personalEmail:     string | null;
  phone:             string | null;
  personalAddress:   string | null;

  // ── Emergency contact ────────────────────────────────────────
  emergencyContactName:     string | null;
  emergencyContactRelation: string | null;
  emergencyContactPhone:    string | null;

  // ── Position ─────────────────────────────────────────────────
  department:    string | null;
  grade:         string | null;
  discipline:    string | null;
  nogLevel:      string | null;
  // FK IDs for dimension tables (null when not yet linked)
  departmentId:  number | null;
  gradeId:       number | null;
  disciplineId:  number | null;
  nogLevelId:    number | null;

  // ── Regime ───────────────────────────────────────────────────
  regimeTemplateId: number | null;
  regimeStartDate:  string | null;
  regimeEndDate:    string | null;
  regimeReason:     string | null;

  // ── Onboarding & administratif ───────────────────────────────────────────
  cnssNumber:            string | null;
  cnssAffiliationDate:   string | null;
  maritalStatus:         string | null;
  numberOfChildren:      number | null;
  onboardingCompleted:   boolean;
  onboardingCompletedAt: string | null;

  // ── Salaires proposés ────────────────────────────────────────────────────
  salaireNetCandidat: number | null;   // Prétention nette du candidat
  salaireNetRh:       number | null;   // Salaire net proposé par RH

  // ── Recruitment link ──────────────────────────────────────────────────────
  candidateId:      number | null;

  // ── Sensitive — null when caller lacks HR_MANAGER / FINANCE_OFFICER ─────
  bankName:          string | null;   // text label from response DTO
  bankId:            number | null;   // FK ID for dimension table
  iban:              string | null;
  bankAccountNumber: string | null;
  rib:               string | null;
  socialSecurityNumber: string | null;
  taxId:             string | null;

  // ── Audit ────────────────────────────────────────────────────
  createdAt:  string;
  updatedAt:  string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / update DTOs
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfileCreateDto {
  userId:          number;
  paysId:          number;
  employeeId:      string;         // AUTO (généré lors du provisioning)
  hireDate:        string;         // ISO date
  contractType:    string;
  contractEndDate?: string;
  // FK IDs depuis les tables dimension (V23)
  departmentId?:   number;
  gradeId?:        number;
  disciplineId?:   number;
  nogLevelId?:     number;
  nationalityId?:  number;
  bankId?:         number;
  personalEmail?:  string;
  phone?:          string;
}

export interface ProfileUpdateDto {
  reason:            string;        // mandatory for audit log
  // Identité
  dateOfBirth?:      string;
  gender?:           string;
  nationalityId?:    number | null; // FK — replaces text nationality
  nationalId?:       string;
  passportNumber?:   string;
  // Emploi
  hireDate?:         string;
  contractType?:     string;
  contractEndDate?:  string;
  probationEndDate?: string;
  isOnProbation?:    boolean;
  // Poste — FK IDs (dimension table migration)
  departmentId?:     number | null;
  gradeId?:          number | null;
  disciplineId?:     number | null;
  nogLevelId?:       number | null;
  // Contact
  personalEmail?:    string;
  phone?:            string;
  personalAddress?:  string;
  // Contact d'urgence
  emergencyContactName?:     string;
  emergencyContactRelation?: string;
  emergencyContactPhone?:    string;
  // Bancaire — FK for bank, text for others
  bankId?:             number | null; // FK — replaces text bankName
  iban?:               string;
  bankAccountNumber?:  string;
  rib?:                string;
  socialSecurityNumber?: string;
  taxId?:              string;
  salaireNetCandidat?: number | null;
  salaireNetRh?:       number | null;
}

export interface LifecycleTransitionDto {
  newStatus: LifecycleStatus;
  reason:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────
export interface EmployeeDocument {
  id:                 number;
  employeeProfileId:  number;
  documentType:       string;
  fileName:           string | null;
  fileUrl:            string;
  fileSizeKb:         number | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  uploadedAt:         string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Working time regime
// ─────────────────────────────────────────────────────────────────────────────
export interface WorkingTimeRegime {
  id:           number;
  paysId:       number;
  code:         string;
  labelFr:      string;
  labelEn:      string;
  hoursPerWeek: number;
  daysPerWeek:  number;
  isFlexible:   boolean;
  isDefault:    boolean;
  isActive:     boolean;
}

export interface RegimeAssignmentDto {
  regimeId:  number;
  startDate: string;
  endDate?:  string;
  reason:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// List / filter
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfileFilter {
  pays?:      number;
  status?:    LifecycleStatus;
  department?: string;
  grade?:      string;
  contract?:  string;
  search?:    string;
  page?:      number;
  size?:      number;
}

export interface PageResponse<T> {
  content:       T[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  last:          boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// All-employees list (GET /api/hr/profiles/employees)
// Joins app_users + employee_profiles — hasProfile=false when no profile exists
// ─────────────────────────────────────────────────────────────────────────────
export interface EmployeeListItem {
  profileId:       number | null;    // employee_profiles.id — null means no profile yet
  userId:          number;
  fullName:        string;
  email:           string | null;
  employeeId:      string | null;
  paysId:          number | null;
  paysLabel:       string | null;
  roleId:          number | null;
  roleName:        string | null;
  lifecycleStatus: string | null;
  contractType:    string | null;
  department:      string | null;
  grade:           string | null;
  discipline:      string | null;
  nogLevel:        string | null;
  hireDate:        string | null;
  photoUrl:        string | null;
  gender:          string | null;
  hasProfile:      boolean;
}
