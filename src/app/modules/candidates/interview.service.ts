import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AssignedInterview,
  SubmitInterviewReportRequest,
  ValidateInterviewRequest,
  CandidateInterview,
  CreateInterviewRequest,
  CreateInterviewTypeRequest,
  InterviewQuestion,
  InterviewType,
  SaveInterviewQuestionRequest,
  UpdateInterviewRequest,
  UpdateInterviewTypeRequest,
  UserPickerItem,
} from './interview.model';

@Injectable({ providedIn: 'root' })
export class InterviewService {
  private http          = inject(HttpClient);
  private typesBase     = `${environment.hrApiUrl}/api/hr/interview-types`;
  private candidatesBase = `${environment.hrApiUrl}/api/hr/candidates`;

  // ── Interview Types ─────────────────────────────────────────────────────────

  /** `paysId` = pays choisi dans l'admin ; absent, le backend garde l'ancienne portée. */
  getTypes(paysId?: number | null): Observable<InterviewType[]> {
    const params = paysId != null ? new HttpParams().set('paysId', paysId) : undefined;
    return this.http.get<InterviewType[]>(this.typesBase, { params });
  }

  getActiveTypes(paysId: number): Observable<InterviewType[]> {
    const params = new HttpParams().set('paysId', paysId);
    return this.http.get<InterviewType[]>(`${this.typesBase}/active`, { params });
  }

  createType(dto: CreateInterviewTypeRequest): Observable<InterviewType> {
    return this.http.post<InterviewType>(this.typesBase, dto);
  }

  updateType(id: number, dto: UpdateInterviewTypeRequest): Observable<InterviewType> {
    return this.http.put<InterviewType>(`${this.typesBase}/${id}`, dto);
  }

  deactivateType(id: number): Observable<InterviewType> {
    return this.http.patch<InterviewType>(`${this.typesBase}/${id}/deactivate`, {});
  }

  activateType(id: number): Observable<InterviewType> {
    return this.http.patch<InterviewType>(`${this.typesBase}/${id}/activate`, {});
  }

  // ── Questionnaire per type (V135, RH_ADMIN_INTERVIEW_TYPES) ─────────────────

  /** typeId → active question count, for the types table. */
  getQuestionCounts(paysId: number): Observable<Record<number, number>> {
    const params = new HttpParams().set('paysId', paysId);
    return this.http.get<Record<number, number>>(`${this.typesBase}/question-counts`, { params });
  }

  /** Every question of the type, archived ones included. */
  getQuestions(typeId: number): Observable<InterviewQuestion[]> {
    return this.http.get<InterviewQuestion[]>(`${this.typesBase}/${typeId}/questions`);
  }

  createQuestion(typeId: number, dto: SaveInterviewQuestionRequest): Observable<InterviewQuestion> {
    return this.http.post<InterviewQuestion>(`${this.typesBase}/${typeId}/questions`, dto);
  }

  updateQuestion(questionId: number, dto: SaveInterviewQuestionRequest): Observable<InterviewQuestion> {
    return this.http.put<InterviewQuestion>(`${this.typesBase}/questions/${questionId}`, dto);
  }

  reorderQuestions(typeId: number, questionIds: number[]): Observable<InterviewQuestion[]> {
    return this.http.put<InterviewQuestion[]>(`${this.typesBase}/${typeId}/questions/order`, { questionIds });
  }

  archiveQuestion(questionId: number): Observable<InterviewQuestion> {
    return this.http.patch<InterviewQuestion>(`${this.typesBase}/questions/${questionId}/archive`, {});
  }

  restoreQuestion(questionId: number): Observable<InterviewQuestion> {
    return this.http.patch<InterviewQuestion>(`${this.typesBase}/questions/${questionId}/restore`, {});
  }

  deleteQuestion(questionId: number): Observable<void> {
    return this.http.delete<void>(`${this.typesBase}/questions/${questionId}`);
  }

  // ── User Picker ─────────────────────────────────────────────────────────────

  getInterviewUsers(paysId: number): Observable<UserPickerItem[]> {
    const params = new HttpParams().set('paysId', paysId);
    return this.http.get<UserPickerItem[]>(`${environment.hrApiUrl}/api/hr/interviews/users`, { params });
  }

  // ── Candidate Interviews ────────────────────────────────────────────────────

  listByCandidate(candidateId: number): Observable<CandidateInterview[]> {
    return this.http.get<CandidateInterview[]>(
      `${this.candidatesBase}/${candidateId}/interviews`,
    );
  }

  createInterview(
    candidateId: number,
    dto: CreateInterviewRequest,
  ): Observable<CandidateInterview> {
    return this.http.post<CandidateInterview>(
      `${this.candidatesBase}/${candidateId}/interviews`,
      dto,
    );
  }

  // ── PV & validation (V132) ──────────────────────────────────────────────────

  /** File or rewrite the caller's own PV — any panel member, no permission. */
  submitReport(candidateId: number, interviewId: number, dto: SubmitInterviewReportRequest): Observable<CandidateInterview> {
    return this.http.put<CandidateInterview>(
      `${this.candidatesBase}/${candidateId}/interviews/${interviewId}/report`, dto);
  }

  /** The questionnaire of this interview's type — what the PV asks (V135). */
  getQuestionnaire(candidateId: number, interviewId: number): Observable<InterviewQuestion[]> {
    return this.http.get<InterviewQuestion[]>(
      `${this.candidatesBase}/${candidateId}/interviews/${interviewId}/questions`);
  }

  /** RH decides PASS / FAIL after reading the PVs (RH_VALIDATE_INTERVIEW). */
  validateInterview(candidateId: number, interviewId: number, dto: ValidateInterviewRequest): Observable<CandidateInterview> {
    return this.http.post<CandidateInterview>(
      `${this.candidatesBase}/${candidateId}/interviews/${interviewId}/validate`, dto);
  }

  /** Every interview the caller sits on — « Mes entretiens ». */
  listAssigned(): Observable<AssignedInterview[]> {
    return this.http.get<AssignedInterview[]>(`${environment.hrApiUrl}/api/hr/interviews/assigned`);
  }

  updateInterview(
    candidateId: number,
    interviewId: number,
    dto: UpdateInterviewRequest,
  ): Observable<CandidateInterview> {
    return this.http.put<CandidateInterview>(
      `${this.candidatesBase}/${candidateId}/interviews/${interviewId}`,
      dto,
    );
  }
}
