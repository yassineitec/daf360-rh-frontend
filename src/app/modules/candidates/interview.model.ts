export interface InterviewType {
  id: number;
  paysId: number;
  name: string;
  /** Libellé anglais facultatif — voir `interviewTypeLabel`. */
  nameEn: string | null;
  description: string | null;
  orderIndex: number;
  isActive: boolean;
}

export interface CreateInterviewTypeRequest {
  paysId: number;
  name: string;
  nameEn?: string;
  description?: string;
  orderIndex?: number;
}

export interface UpdateInterviewTypeRequest {
  name?: string;
  nameEn?: string;
  description?: string;
  orderIndex?: number;
}

/** Libellé à afficher selon la langue : l'anglais quand il est saisi, sinon `name`. */
export function interviewTypeLabel(name: string, nameEn: string | null | undefined, lang: string | null | undefined): string {
  return lang === 'en' && nameEn ? nameEn : name;
}

export type InterviewStatus = 'PLANNED' | 'DONE' | 'CANCELLED';
export type InterviewResult = 'PASS' | 'FAIL';

export interface UserPickerItem {
  id: number;
  fullName: string;
}

export interface CandidateInterview {
  id: number;
  candidateId: number;
  interviewTypeId: number;
  interviewTypeName: string;
  interviewTypeNameEn: string | null;
  scheduledAt: string;
  location: string | null;
  interviewerNotes: string | null;
  /** Lead interviewer = first of `interviewers`; kept for older consumers. */
  interviewerUserId: number | null;
  interviewerName: string | null;
  /** Full interview panel, in the order it was saved. */
  interviewers: UserPickerItem[];
  status: InterviewStatus;
  result: InterviewResult | null;
  sequenceNumber: number;
  createdAt: string;
  /** Teams join link, present once the calendar sync has succeeded for this
   * interview (null if Graph is unconfigured, the sync hasn't run yet, or it
   * failed — never a required field to render the rest of the card). */
  graphJoinUrl: string | null;

  // ── PV & RH validation (V132) ──
  /** The PVs this user may read: all for an RH reader, only their own for a panel member. */
  reports: InterviewReport[];
  /** How many PVs exist, readable or not. */
  reportCount: number;
  /** This user sits on the panel and may file / rewrite their PV now. */
  canWriteReport: boolean;
  /** This user may decide PASS / FAIL now (RH_VALIDATE_INTERVIEW, a PV is in, not decided). */
  canValidate: boolean;
  validatedBy: number | null;
  validatedByName: string | null;
  validatedAt: string | null;
  validationComment: string | null;
}

export type InterviewOpinion = 'FAVORABLE' | 'RESERVED' | 'UNFAVORABLE';

export interface InterviewReport {
  id: number;
  authorUserId: number;
  authorName: string | null;
  summary: string;
  opinion: InterviewOpinion;
  submittedAt: string;
  updatedAt: string | null;
}

export interface SubmitInterviewReportRequest {
  summary: string;
  opinion: InterviewOpinion;
}

export interface ValidateInterviewRequest {
  decision: InterviewResult;
  comment?: string;
}

/** « Mes entretiens » row (V132). */
export interface AssignedInterview {
  id: number;
  candidateId: number;
  candidateName: string;
  appliedPosition: string | null;
  interviewTypeName: string | null;
  interviewTypeNameEn: string | null;
  scheduledAt: string;
  location: string | null;
  status: InterviewStatus;
  result: InterviewResult | null;
  myReportAt: string | null;
  graphJoinUrl: string | null;
}

export interface CreateInterviewRequest {
  interviewTypeId: number;
  scheduledAt: string;
  location?: string;
  interviewerNotes?: string;
  interviewerUserIds?: number[];
}

/** Every field optional — omitted means "leave unchanged"; `[]` clears the panel. */
export interface UpdateInterviewRequest {
  interviewTypeId?: number;
  scheduledAt?: string;
  location?: string;
  interviewerNotes?: string;
  interviewerUserIds?: number[];
  status?: string;
  result?: string;
}
