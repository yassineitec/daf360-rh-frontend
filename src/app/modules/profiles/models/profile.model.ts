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

/**
 * Mirror of `LifecycleStatus.canTransitionTo` in rh-service — the server rejects anything
 * this map allows by mistake, and hides anything it forgets. Keep the two in step.
 *
 * `OFFBOARDING → ACTIVE` is the cancellation path (a departure called off returns the
 * employee to duty); `ON_LEAVE|ON_MISSION → OFFBOARDING` because resigning while on leave
 * or on mission is ordinary; `TERMINATED → OFFBOARDING` is the reopen path.
 */
export const LIFECYCLE_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  PRE_ONBOARDING: ['ACTIVE'],
  ACTIVE: ['ON_LEAVE', 'ON_MISSION', 'OFFBOARDING'],
  ON_LEAVE: ['ACTIVE', 'OFFBOARDING'],
  ON_MISSION: ['ACTIVE', 'OFFBOARDING'],
  OFFBOARDING: ['TERMINATED', 'ACTIVE'],
  TERMINATED: ['ARCHIVED', 'OFFBOARDING'],
  ARCHIVED: [],
};

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  PRE_ONBOARDING: 'Pré-onboarding',
  ACTIVE: 'Actif',
  ON_LEAVE: 'En congé',
  ON_MISSION: 'En mission',
  OFFBOARDING: 'Offboarding',
  TERMINATED: 'Terminé',
  ARCHIVED: 'Archivé',
};

// ─────────────────────────────────────────────────────────────────────────────
// DTOs (mirror backend EmployeeProfileResponseDto / SummaryDto)
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfileSummary {
  id: number;
  userId: number;
  paysId: number;
  lifecycleStatus: LifecycleStatus;
  department: string | null;
  grade: string | null;
  contractType: string | null;
  hireDate: string | null;
  photoUrl: string | null;
  // Enriched by backend or secondary call
  employeeId?: string | null;
  fullName?: string | null;
  paysLabel?: string | null;
}

export interface EmployeeProfile {
  id: number;
  userId: number;
  paysId: number;
  paysLabel: string;
  lifecycleStatus: LifecycleStatus;

  // ── Depuis Users (enrichi par le service) ────────────────────────────────
  matricule: string | null; // format [NOM3][PRE3][userId] ex: DUPPIE125
  fullName: string | null; // Users.fullName

  // ── Employment ──────────────────────────────────────────────
  hireDate: string | null;
  contractType: string | null;
  contractEndDate: string | null;
  probationEndDate: string | null;
  isOnProbation: boolean;

  // ── Personal ────────────────────────────────────────────────
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null; // text label from response DTO
  nationalityId: number | null; // FK ID for dimension table
  nationalId: string | null;
  passportNumber: string | null;
  photoUrl: string | null;
  personalEmail: string | null;
  phone: string | null;
  homeAddress: string | null;

  // ── Emergency contact ────────────────────────────────────────
  emergencyContactName: string | null;
  emergencyContactRelation: string | null;
  emergencyContactPhone: string | null;

  // ── Position ─────────────────────────────────────────────────
  department: string | null;
  grade: string | null;
  discipline: string | null;
  nogLevel: string | null;
  // FK IDs for dimension tables (null when not yet linked)
  departmentId: number | null;
  gradeId: number | null;
  disciplineId: number | null;
  nogLevelId: number | null;

  // ── Regime ───────────────────────────────────────────────────
  regimeTemplateId: number | null;
  regimeStartDate: string | null;
  regimeEndDate: string | null;
  regimeReason: string | null;

  // ── Onboarding & administratif ───────────────────────────────────────────
  cnssNumber: string | null;
  cnssAffiliationDate: string | null;
  maritalStatus: string | null;
  numberOfChildren: number | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;

  // ── Salaires proposés ────────────────────────────────────────────────────
  salaireNetCandidat: number | null; // Prétention nette du candidat
  salaireNetRh: number | null; // Salaire net proposé par RH

  // ── Recruitment link ──────────────────────────────────────────────────────
  candidateId: number | null;
  personalAddress: string | null; // V2 column personal_address (same data as homeAddress)

  // ── Sensitive — null when caller lacks HR_MANAGER / FINANCE_OFFICER ─────
  bankName: string | null; // text label from response DTO
  bankId: number | null; // FK ID for dimension table
  iban: string | null;
  bankAccountNumber: string | null;
  rib: string | null;
  socialSecurityNumber: string | null;
  taxId: string | null;

  // ── Audit ────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / update DTOs
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfileCreateDto {
  userId: number;
  paysId: number;
  employeeId: string; // AUTO (généré lors du provisioning)
  hireDate: string; // ISO date
  contractType: string;
  contractEndDate?: string;
  // FK IDs depuis les tables dimension (V23)
  departmentId?: number;
  gradeId?: number;
  disciplineId?: number;
  nogLevelId?: number;
  nationalityId?: number;
  bankId?: number;
  personalEmail?: string;
  phone?: string;
}

export interface ProfileUpdateDto {
  reason: string; // mandatory for audit log
  // Identité
  dateOfBirth?: string;
  gender?: string;
  nationalityId?: number | null; // FK — replaces text nationality
  nationalId?: string;
  passportNumber?: string;
  maritalStatus?: string;
  numberOfChildren?: number | null;
  // Emploi
  hireDate?: string;
  contractType?: string;
  contractEndDate?: string;
  probationEndDate?: string;
  isOnProbation?: boolean;
  // Poste — FK IDs (dimension table migration)
  departmentId?: number | null;
  gradeId?: number | null;
  disciplineId?: number | null;
  nogLevelId?: number | null;
  // Contact
  personalEmail?: string;
  phone?: string;
  personalAddress?: string;
  // Contact d'urgence
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  // Bancaire — FK for bank, text for others
  bankId?: number | null; // FK — replaces text bankName
  iban?: string;
  bankAccountNumber?: string;
  rib?: string;
  socialSecurityNumber?: string;
  taxId?: string;
  cnssNumber?: string;
  cnssAffiliationDate?: string;
  salaireNetCandidat?: number | null;
  salaireNetRh?: number | null;
}

export interface LifecycleTransitionDto {
  newStatus: LifecycleStatus;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────
export type DocumentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface EmployeeDocument {
  id: number;
  employeeProfileId: number;
  documentType: string;
  fileName: string | null;
  /**
   * Server-side storage path, NOT a link. Opening a document goes through
   * `ProfileService.downloadDocument` — nothing serves the upload directory.
   */
  fileUrl: string;
  fileSizeKb: number | null;
  verificationStatus: DocumentVerificationStatus;
  uploadedAt: string;

  /** Exposed by the backend since the Documents rebuild (columns pre-existed). */
  expirationDate: string | null;
  notes: string | null;
  uploadedBy: number | null;
  uploadedByName: string | null;

  /** LOCAL | SHAREPOINT — everything is LOCAL until SharePoint is actually integrated. */
  storageProvider: 'LOCAL' | 'SHAREPOINT';

  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: number | null;
  deletedByName: string | null;
}

export interface DocumentMetadataRequest {
  documentType?: string;
  expirationDate?: string | null;
  /** A null `expirationDate` means "leave alone" on a PATCH; this clears it. */
  clearExpirationDate?: boolean;
  notes?: string | null;
}

/**
 * Every document type the backend accepts (`EmployeeDocumentService.DOCUMENT_TYPES`).
 * Order is display order; labels come from `PROFILES.DOC_TYPES.*`.
 */
export const DOCUMENT_TYPE_CODES = [
  'CONTRACT', 'CONTRACT_SIGNED', 'AMENDMENT',
  'ID_CARD', 'PASSPORT', 'RESIDENCE_PERMIT',
  'DIPLOMA', 'CV', 'MEDICAL_CERTIFICATE',
  'RIB', 'CNSS', 'TAX_FORM',
  'PHOTO', 'RESIGNATION', 'DISCHARGE', 'OTHER',
] as const;

/**
 * One row of the Documents tab, from either source.
 *
 * `UPLOADED` rows are `employee_documents` (verifiable, editable, removable);
 * `GENERATED` rows are `generated_documents` — attestations produced by the drawer, which
 * have their own table and their own download endpoint and are read-only here.
 */
export interface ProfileDocumentRow {
  source: 'UPLOADED' | 'GENERATED';
  id: number;
  documentType: string;
  fileName: string | null;
  fileSizeKb: number | null;
  date: string;
  authorName: string | null;
  verificationStatus: DocumentVerificationStatus | null;
  expirationDate: string | null;
  notes: string | null;
  /** Generated documents only — the code printed in the PDF's verification footer. */
  verificationCode?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Working time regime
// ─────────────────────────────────────────────────────────────────────────────
export interface WorkingTimeRegime {
  id: number;
  paysId: number;
  code: string;
  labelFr: string;
  labelEn: string;
  hoursPerWeek: number;
  daysPerWeek: number;
  isFlexible: boolean;
  isDefault: boolean;
  isActive: boolean;
}

export interface RegimeAssignmentDto {
  regimeId: number;
  startDate: string;
  endDate?: string;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// List / filter
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfileFilter {
  pays?: number;
  status?: LifecycleStatus;
  department?: string;
  grade?: string;
  contract?: string;
  search?: string;
  page?: number;
  size?: number;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// All-employees list (GET /api/hr/profiles/employees)
// Joins app_users + employee_profiles — hasProfile=false when no profile exists
// ─────────────────────────────────────────────────────────────────────────────
export interface EmployeeListItem {
  profileId: number | null; // employee_profiles.id — null means no profile yet
  userId: number;
  fullName: string;
  email: string | null;
  employeeId: string | null;
  paysId: number | null;
  paysLabel: string | null;
  roleId: number | null;
  roleName: string | null;
  lifecycleStatus: string | null;
  contractType: string | null;
  department: string | null;
  grade: string | null;
  discipline: string | null;
  nogLevel: string | null;
  hireDate: string | null;
  photoUrl: string | null;
  gender: string | null;
  hasProfile: boolean;
}
