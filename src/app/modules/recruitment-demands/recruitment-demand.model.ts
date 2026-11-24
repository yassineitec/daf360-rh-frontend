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
  /** English label of the department, display-only; `department` stays the filter value. */
  departmentLabelEn?: string | null;
  statut: RecruitmentDemandStatus;
  urgencyLevelLabel: string | null;
  headcount: number;
  candidateCount: number;
  /** Posts filled (V137): offer agreed — onboarding, IT or hired. */
  positionsFilled?: number;
  hiredCount?: number;
  /** AUTO_FILLED | MANUAL | null (V137). */
  closedReason?: DemandClosedReason | null;
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
  /** Department LABEL. `departmentId` is the real link — prefer it. */
  department: string | null;
  /**
   * Position dimensions (V72), from the same tables the employee profiles use. These are what
   * let the candidate form prefill its position step by ID instead of matching label strings.
   */
  departmentId: number | null;
  gradeId: number | null;
  gradeLabel: string | null;
  disciplineId: number | null;
  disciplineLabel: string | null;
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
  /** Stable code (DEBUTANT / JUNIOR / …) — branch on this, never on the label. */
  experienceLevelCode: string | null;
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
  // ── Posts filled (V137) ──
  positionsFilled?: number;
  hiredCount?: number;
  remainingPositions?: number;
  closedAt?: string | null;
  closedReason?: DemandClosedReason | null;
  closedByName?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** Why a demand is CLOTUREE (V137): every post filled, or closed by someone. */
export type DemandClosedReason = 'AUTO_FILLED' | 'MANUAL';

/**
 * The « Postes » cell (V137): « 2 / 3 » (filled / headcount) once the demand is a real vacancy
 * (approved or closed), the plain headcount before — nothing can be filled yet.
 */
export function demandPostsLabel(d: { statut: RecruitmentDemandStatus; headcount: number; positionsFilled?: number }): string {
  const headcount = d.headcount ?? 0;
  return d.statut === 'APPROUVEE' || d.statut === 'CLOTUREE'
    ? `${d.positionsFilled ?? 0} / ${headcount}`
    : String(headcount);
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
  /** V137 — posts of the demand and how many are filled, so the option says what is left. */
  headcount?: number;
  positionsFilled?: number;
  /**
   * Other demands raised for the same post (department + title + exact title) and the archived
   * candidatures they left — when there are some, the creation wizard offers to start from one.
   */
  earlierRequests?: number;
  archivedCandidates?: number;
}

/**
 * One candidature of a demand, as its detail page lists it (« Candidats » + KPI row). Light on
 * purpose: the page is open to the manager who raised the demand, not only to recruiters.
 */
export interface DemandCandidate {
  id: number;
  fullName: string;
  gender: string | null;
  email: string | null;
  status: string;
  /** ISO local date-time. */
  createdAt: string | null;
  archiveReason: string | null;
  archivedFromStatus: string | null;
  archivedAt: string | null;
  /** yyyy-MM-dd: every post is filled, this candidature is archived on that day. */
  archiveDueDate: string | null;
  rejectionReason: string | null;
}

/** One line of a demand's « Historique » (newest first). See DemandHistoryService. */
export type DemandHistoryType =
  | 'CREATED' | 'REQUESTED_AGAIN' | 'REQUESTED_LATER' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  | 'HEADCOUNT_CHANGED' | 'CLOSED_MANUAL' | 'CLOSED_FILLED' | 'REOPENED' | 'REOPENED_AUTO'
  | 'CANDIDATE_ADDED' | 'CANDIDATE_REUSED' | 'OFFER_ACCEPTED' | 'CANDIDATE_ARCHIVED' | 'CANDIDATE_REJECTED';

export interface DemandHistoryEvent {
  /** ISO instant (UTC). */
  at: string;
  type: DemandHistoryType;
  /** null = the system (automatic close / archive), or unknown. */
  actorName: string | null;
  candidateId: number | null;
  candidateName: string | null;
  details: Record<string, string>;
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
