import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CandidateInterview,
  CreateInterviewRequest,
  CreateInterviewTypeRequest,
  InterviewType,
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

  getTypes(): Observable<InterviewType[]> {
    return this.http.get<InterviewType[]>(this.typesBase);
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
