export type RecruitmentDemandStatus =
  'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE' | 'ANNULEE' | 'CLOTUREE';

export type RecruitmentReason = 'CREATION_POSTE' | 'REMPLACEMENT' | 'ACCROISSEMENT';

export interface RecruitmentReasonOption {
  value: RecruitmentReason;
  label: string;
  description: string;
  icon: string;
}

export const RECRUITMENT_REASONS: RecruitmentReasonOption[] = [
  {
    value: 'CREATION_POSTE',
    label: 'Création de poste',
    description: 'Nouveau poste créé pour répondre à un besoin organisationnel',
    icon: '✦',
  },
  {
    value: 'REMPLACEMENT',
    label: 'Remplacement',
    description: 'Remplacement d\'un collaborateur partant ou absent',
    icon: '↺',
  },
  {
    value: 'ACCROISSEMENT',
    label: 'Accroissement d\'activité',
    description: 'Renforcement des équipes lié à la croissance de l\'activité',
    icon: '↑',
  },
];

export const TECHNICAL_SKILLS_SUGGESTIONS: string[] = [
  'AutoCAD', 'Revit', 'BIM', 'Robot Structural Analysis', 'SAP2000',
  'ETABS', 'Civil 3D', 'Navisworks', 'Primavera P6', 'MS Project',
  'Excel avancé', 'Python', 'SQL', 'Java', 'Spring Boot',
  'Angular', 'React', 'Node.js', 'Power BI', 'MATLAB',
  'Solidworks', 'CATIA', 'Revit MEP',
];

export const SOFT_SKILLS_SUGGESTIONS: string[] = [
  'Leadership', 'Communication', 'Travail en équipe', 'Rigueur',
  'Organisation', 'Autonomie', 'Adaptabilité', 'Gestion du stress',
  'Esprit d\'analyse', 'Créativité', 'Sens des responsabilités',
  'Orientation résultats', 'Sens du client', 'Prise d\'initiative',
];

export interface RecruitmentDemandSummary {
  id: number;
  jobTitle: string;
  jobExactTitle: string | null;
  department: string | null;
  statut: RecruitmentDemandStatus;
  urgencyLevelLabel: string | null;
  headcount: number;
  candidateCount: number;
  submittedAt: string;
  createdByUserId: number;
  recruitmentReason: string | null;
  recruitmentReasonLabel: string | null;
}

export interface RecruitmentDemandDetail {
  id: number;
  createdByUserId: number;
  paysId: number;
  jobTitle: string;
  jobExactTitle: string | null;
  department: string | null;
  requiredProfile: string;
  scopeOfWork: string;
  needDescription: string | null;
  urgencyLevelId: number;
  urgencyLevelLabel: string | null;
  recruitmentReason: string | null;
  recruitmentReasonLabel: string | null;
  cspCategoryId: number | null;
  cspCategoryLabel: string | null;
  experienceLevelId: number | null;
  experienceLevelLabel: string | null;
  educationLevelId: number | null;
  educationLevelLabel: string | null;
  technicalSkills: string[];
  softSkills: string[];
  targetStartDate: string | null;
  headcount: number;
  budgetRange: string | null;
  additionalNotes: string | null;
  statut: RecruitmentDemandStatus;
  submittedAt: string;
  reviewedByUserId: number | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  candidateCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateRecruitmentDemandRequest {
  paysId: number;
  jobTitle: string;
  jobExactTitle?: string | null;
  department?: string | null;
  recruitmentReason?: RecruitmentReason | null;
  needDescription?: string | null;
  requiredProfile?: string;
  scopeOfWork?: string;
  urgencyLevelId: number;
  cspCategoryId?: number | null;
  experienceLevelId?: number | null;
  educationLevelId?: number | null;
  technicalSkills?: string[];
  softSkills?: string[];
  targetStartDate?: string | null;
  headcount: number;
  budgetRange?: string | null;
  additionalNotes?: string | null;
}

export interface UpdateRecruitmentDemandRequest extends CreateRecruitmentDemandRequest {}

export interface ReviewRecruitmentDemandRequest {
  approved: boolean;
  comment?: string | null;
}

export interface ApprovedDemandOption {
  id: number;
  label: string;
  department?: string | null;
}

export const DEMAND_STATUS_LABELS: Record<RecruitmentDemandStatus, string> = {
  EN_ATTENTE: 'En attente',
  APPROUVEE:  'Approuvée',
  REJETEE:    'Rejetée',
  ANNULEE:    'Annulée',
  CLOTUREE:   'Clôturée',
};

export const DEMAND_STATUS_BADGE: Record<RecruitmentDemandStatus, string> = {
  EN_ATTENTE: 'badge-warning',
  APPROUVEE:  'badge-success',
  REJETEE:    'badge-danger',
  ANNULEE:    'badge-neutral',
  CLOTUREE:   'badge-info',
};
