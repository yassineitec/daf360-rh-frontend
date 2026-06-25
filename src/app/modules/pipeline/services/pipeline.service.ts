import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PipelineStats {
  totalCandidats: number;
  delaiMoyenJours: number;
  postesUrgents: number;
  urgents?: number;
}

export interface KanbanCandidate {
  id: number;
  fullName: string;
  photoUrl?: string;
  gender?: string;
  poste: string;
  fitScore: number;
  badge: string;
  badgeType: 'urgent' | 'top' | 'new' | 'in_progress' | 'offer' | 'hired';
  experience?: string;
  location?: string;
  skills: string[];
  note?: string;
  nextEvent?: string;
  salary?: string;
  isUrgent: boolean;
  stage: string;
  initials?: string;
  stageLabel?: string;
  applicationDate?: string;
  email?: string;
  status?: string;
  contractType?: string;
}

export interface KanbanColumn {
  stage: string;
  stageLabel: string;
  count: number;
  candidates: KanbanCandidate[];
}

export interface CandidatesPage {
  content: KanbanCandidate[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export interface CandidateParams {
  page?: number;
  size?: number;
  stage?: string;
}

@Injectable({ providedIn: 'root' })
export class PipelineService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/pipeline`;

  getStats(): Observable<PipelineStats> {
    return this.http.get<PipelineStats>(`${this.base}/stats`);
  }

  getKanban(): Observable<KanbanColumn[]> {
    return this.http.get<KanbanColumn[]>(`${this.base}/kanban`);
  }

  getCandidates(params: CandidateParams = {}): Observable<CandidatesPage> {
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page);
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size);
    if (params.stage) httpParams = httpParams.set('stage', params.stage);
    return this.http.get<CandidatesPage>(`${this.base}/candidates`, { params: httpParams });
  }

  moveToStage(id: number, stage: string): Observable<KanbanCandidate> {
    return this.http.put<KanbanCandidate>(`${this.base}/candidates/${id}/stage`, stage);
  }
}
