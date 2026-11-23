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
  /** RH profile the photo is served by; null for a user without one. */
  profileId?: number | null;
  /** Stored employee_profiles.photo_url (carries the v= cache token); null when no photo. */
  photoUrl?: string | null;
  gender?: string | null;
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
  /** Questionnaire answers (V135), in question order — empty when the type has no question. */
  answers: InterviewAnswer[];
}

export interface SubmitInterviewReportRequest {
  summary: string;
  opinion: InterviewOpinion;
  answers?: InterviewAnswerRequest[];
}

// ── Questionnaire per interview type (V135) ──────────────────────────────────

export type InterviewQuestionType = 'TEXT' | 'RATING' | 'SELECT' | 'MULTI_SELECT';

export const INTERVIEW_QUESTION_TYPES: InterviewQuestionType[] = ['TEXT', 'RATING', 'SELECT', 'MULTI_SELECT'];

export interface InterviewQuestion {
  id: number;
  interviewTypeId: number;
  label: string;
  labelEn: string | null;
  helpText: string | null;
  responseType: InterviewQuestionType;
  /** SELECT / MULTI_SELECT choices. */
  options: string[];
  ratingMin: number | null;
  ratingMax: number | null;
  ratingStep: number | null;
  ratingMinLabel: string | null;
  ratingMaxLabel: string | null;
  required: boolean;
  orderIndex: number;
  /** false = archived: no longer asked, past answers kept. */
  active: boolean;
  /** PVs that answered it — above 0 the type and scale are frozen and it can only be archived. */
  answerCount: number;
}

export interface SaveInterviewQuestionRequest {
  label: string;
  labelEn?: string;
  helpText?: string;
  responseType: InterviewQuestionType;
  options?: string[];
  ratingMin?: number;
  ratingMax?: number;
  ratingStep?: number;
  ratingMinLabel?: string;
  ratingMaxLabel?: string;
  required: boolean;
}

/** Only the field matching the question's type is read by the server. */
export interface InterviewAnswerRequest {
  questionId: number;
  text?: string;
  number?: number;
  options?: string[];
}

/** An answer as the interviewer was asked it — label and scale copied at answer time. */
export interface InterviewAnswer {
  questionId: number | null;
  label: string;
  labelEn: string | null;
  responseType: InterviewQuestionType;
  ratingMin: number | null;
  ratingMax: number | null;
  order: number;
  text: string | null;
  number: number | null;
  options: string[];
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
