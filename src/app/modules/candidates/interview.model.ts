export interface InterviewType {
  id: number;
  paysId: number;
  name: string;
  description: string | null;
  orderIndex: number;
  isActive: boolean;
}

export interface CreateInterviewTypeRequest {
  paysId: number;
  name: string;
  description?: string;
  orderIndex?: number;
}

export interface UpdateInterviewTypeRequest {
  name?: string;
  description?: string;
  orderIndex?: number;
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
  scheduledAt: string;
  location: string | null;
  interviewerNotes: string | null;
  interviewerUserId: number | null;
  interviewerName: string | null;
  status: InterviewStatus;
  result: InterviewResult | null;
  sequenceNumber: number;
  createdAt: string;
}

export interface CreateInterviewRequest {
  interviewTypeId: number;
  scheduledAt: string;
  location?: string;
  interviewerNotes?: string;
  interviewerUserId?: number;
}

export interface UpdateInterviewRequest {
  scheduledAt?: string;
  location?: string;
  interviewerNotes?: string;
  interviewerUserId?: number;
  status?: string;
  result?: string;
}
