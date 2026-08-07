
// FILE: onboarding.model.ts  (import from '../onboarding.model' inside steps/)

export type CandidateOnboardingStatus = 'EMAIL_RECEIVED' | 'HR_IN_PROGRESS';

export interface OnboardingListItem {
  candidateId: number;
  candidateFullName: string;
  appliedPosition: string | null;
  paysId: number;
  paysLabel: string | null;
  expectedStartDate: string | null;
  candidateStatus: CandidateOnboardingStatus;
  ms365Email: string;
  itProvisioningStatus: string;
  ms365EmailCreatedAt: string | null;
  itProvisioningId: number;
  hasDraft: boolean;
  draftSavedAt: string | null;
  /** Canonical GENDER value_code (MALE/FEMALE/OTHER/…) — drives the avatar tile. */
  gender: string | null;
}

export interface RegimeSummary {
  id: number;
  code: string;
  labelFr: string;
  hoursPerWeek: number;
  isDefault: boolean;
}

export interface OnboardingKpiStats {
  pendingCount: number;
  profilesCreatedToday: number;
  incompleteProfiles: number;
  avgCreationMinutes: number;
}

export interface OnboardingFormData {
  // Identity
  candidateId:       number;
  paysId:            number;
  firstName:         string;
  lastName:          string;
  emailPersonal:     string;
  phone:             string | null;
  dateOfBirth:       string | null;
  nationality:       string | null;
  nationalityId:     number | null;
  nationalId:        string | null;
  gender:            string | null;
  passportNumber:    string | null;
  ms365Email:        string;
  /**
   * The vacancy this hire fills, carried from the candidature. Null for a spontaneous
   * application — shown as such so "which opening does this close" is answerable at the
   * last step of recruitment, not just the first.
   */
  recruitmentDemandId?:       number | null;
  recruitmentDemandJobTitle?: string | null;
  // Employment
  appliedPosition:   string | null;
  appliedGrade:      string | null;
  appliedDiscipline: string | null;
  department:        string | null;
  contractType:      string | null;
  expectedStartDate: string | null;
  hireDate:          string | null;
  contractEndDate:   string | null;
  probationEndDate:  string | null;
  isOnProbation:     boolean | null;
  // Dimension FK IDs (for dropdowns)
  gradeId:           number | null;
  disciplineId:      number | null;
  nogLevelId:        number | null;
  departmentId:      number | null;
  // Regime
  availableRegimes:  RegimeSummary[];
  selectedRegimeId:  number | null;
  // Personal & Social
  cnssNumber:        string | null;
  cnssAffiliationDate: string | null;
  maritalStatus:     string | null;
  numberOfChildren:  number | null;
  personalAddress:   string | null;
  // Bank
  bankId:            number | null;
  bankName:          string | null;
  bankAccountNumber: string | null;
  rib:               string | null;
  iban:              string | null;
  socialSecurityNumber: string | null;
  taxId:             string | null;
  // Emergency
  emergencyContactName:     string | null;
  emergencyContactRelation: string | null;
  emergencyContactPhone:    string | null;
  // IT Provisioning (extended — backend fields may be null if not yet implemented)
  matricule?:              string | null;
  itDeviceName?:           string | null;
  ms365LicenseType?:       string | null;
  itProvisioningStatus?:   string | null;
  // Workflow timeline dates (for process tracker)
  requestValidatedAt?:     string | null;
  itAccountCreatedAt?:     string | null;
  equipmentAssignedAt?:    string | null;
  // Contrat (step 3) — read-only recruitment evidence + the prefilled agreed terms
  recruitment?:          OnboardingRecruitment | null;
  noticePeriodDays?:     number | null;
  agreedNetSalary?:      number | null;
  contractDocumentUrl?:  string | null;
  contractDocumentName?: string | null;
  // Meta
  candidateStatus: string;
  hasDraft:        boolean;
  draftSavedAt:    string | null;
}

/**
 * What recruitment already decided, for the Contrat step to display. READ-ONLY — RH confirms
 * these figures in the editable fields beside them rather than retyping them from memory.
 */
export interface OnboardingRecruitment {
  offer?: {
    askedSalary?:      number | null;
    proposedSalary?:   number | null;
    salaryNote?:       string | null;
    noticePeriodDays?: number | null;
    noticePeriodNote?: string | null;
    expectedHireDate?: string | null;
    expiryDate?:       string | null;
    status?:           string | null;
    sentAt?:           string | null;
    decidedAt?:        string | null;
  } | null;
  candidateDeclaredNetSalary?: number | null;
  hrAssessedNetSalary?:        number | null;
  /** The applied grade's default préavis — null when the grade has none configured. */
  gradeNoticePeriodDays?:      number | null;
  costApprovals?: {
    status?:             string | null;
    salaireNetRh?:       number | null;
    salaireNetCandidat?: number | null;
    contrePropSalaire?:  number | null;
    approvalNotes?:      string | null;
    submittedAt?:        string | null;
    approvedAt?:         string | null;
  }[];
  interviewNotes?: {
    sequenceNumber?:   number | null;
    interviewType?:    string | null;
    result?:           string | null;
    interviewerNotes?: string | null;
    scheduledAt?:      string | null;
  }[];
}

export interface OnboardingProfileDto {
  // Step 1 — Identity
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  nationalityId?: number | null;
  nationalId?: string | null;
  passportNumber?: string | null;
  // Step 2 — Contract
  hireDate?: string;
  contractType?: string;
  contractEndDate?: string | null;
  grade?: string;
  gradeId?: number | null;
  discipline?: string;
  disciplineId?: number | null;
  nogLevel?: string | null;
  nogLevelId?: number | null;
  department?: string;
  departmentId?: number | null;
  isOnProbation?: boolean;
  probationEndDate?: string | null;
  // Step 3 — Contrat. The préavis is editable HERE and nowhere else: after completion it is
  // frozen on the contract, and changing it means creating a new contract.
  noticePeriodDays?: number | null;
  agreedNetSalary?: number | null;
  contractDocumentUrl?: string | null;
  contractDocumentName?: string | null;
  // Step 4 — Regime
  regimeTemplateId?: number | null;
  regimeStartDate?: string | null;
  // Step 4 — Personal & Social
  cnssNumber?: string;
  cnssAffiliationDate?: string | null;
  maritalStatus?: string | null;
  numberOfChildren?: number | null;
  personalAddress?: string | null;
  phone?: string | null;
  // Step 5 — Bank
  bankName?: string;
  bankId?: number | null;
  bankAccountNumber?: string | null;
  rib?: string;
  iban?: string | null;
  socialSecurityNumber?: string | null;
  taxId?: string | null;
  // Step 6 — Emergency
  emergencyContactName?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactPhone?: string | null;
}

export interface CompletionResult {
  employeeProfileId: number;
  candidateId: number;
  userId: number;
  workflowInstanceId: number;
  ms365Email: string;
  message: string;
}

export const STEPS = [
  { number: 1, label: 'Identité',     key: 'identity'   },
  { number: 2, label: 'Poste',        key: 'contract'   },
  // Sits after Poste because the grade is chosen there, and the grade is what the préavis
  // default comes from — so this step opens with a figure to confirm, not a blank.
  { number: 3, label: 'Contrat',      key: 'contractTerms' },
  { number: 4, label: 'Régime',       key: 'regime'     },
  { number: 5, label: 'Personnel',    key: 'personal'   },
  { number: 6, label: 'Banque',       key: 'bank'       },
  { number: 7, label: 'Urgence',      key: 'emergency'  },
  { number: 8, label: 'Récapitulatif',key: 'summary'    },
];

export const CONTRACT_OPTIONS  = [{ value:'',              label:'—' }, { value:'PERMANENT',   label:'CDI' }, { value:'FIXED_TERM',  label:'CDD' }, { value:'INTERN',      label:'Stage' }, { value:'CONSULTANT',  label:'Consultant' }];
export const STAFF_OPTIONS: { value: string; label: string }[] = [];
