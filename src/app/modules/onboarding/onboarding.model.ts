
// FILE: onboarding.model.ts  (import from '../onboarding.model' inside steps/)

export type CandidateOnboardingStatus = 'EMAIL_RECEIVED' | 'HR_IN_PROGRESS';

export interface OnboardingListItem {
  candidateId: number;
  candidateFullName: string;
  appliedPosition: string | null;
  paysId: number;
  expectedStartDate: string | null;
  candidateStatus: CandidateOnboardingStatus;
  ms365Email: string;
  itProvisioningStatus: string;
  ms365EmailCreatedAt: string | null;
  itProvisioningId: number;
  hasDraft: boolean;
  draftSavedAt: string | null;
}

export interface RegimeSummary {
  id: number;
  code: string;
  labelFr: string;
  hoursPerWeek: number;
  isDefault: boolean;
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
  homeAddress:       string | null;
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
  // Meta
  candidateStatus: string;
  hasDraft:        boolean;
  draftSavedAt:    string | null;
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
  // Step 3 — Regime
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
  { number: 3, label: 'Régime',       key: 'regime'     },
  { number: 4, label: 'Personnel',    key: 'personal'   },
  { number: 5, label: 'Banque',       key: 'bank'       },
  { number: 6, label: 'Urgence',      key: 'emergency'  },
  { number: 7, label: 'Récapitulatif',key: 'summary'    },
];

export const CONTRACT_OPTIONS  = [{ value:'',              label:'—' }, { value:'PERMANENT',   label:'CDI' }, { value:'FIXED_TERM',  label:'CDD' }, { value:'INTERN',      label:'Stage' }, { value:'CONSULTANT',  label:'Consultant' }];
export const STAFF_OPTIONS: { value: string; label: string }[] = [];
