import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PipelineStats {
  totalCandidats: number;
  enEntretien: number;
  scoreMoyen: number;
  recrutementsClos: number;
  delaiMoyenJours: number;
  urgents: number;
}

export interface KanbanCandidate {
  id: number;
  fullName: string;
  initials?: string;
  photoUrl?: string;
  gender?: string;
  poste: string;
  fitScore: number;
  badge: string;
  badgeType: 'urgent' | 'top' | 'new' | 'in_progress' | 'offer' | 'hired' | 'rejected';
  experience?: string;
  location?: string;
  skills: string[];
  note?: string;
  nextEvent?: string;
  salary?: string;
  isUrgent: boolean;
  stage: string;
  stageLabel?: string;
  applicationDate?: string;
  email?: string;
  status?: string;
  contractType?: string;
  /** Workflow progress (%) for the current phase: IT provisioning (OFFRE) or HR onboarding. */
  progressPercent?: number | null;
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
  search?: string;
}

export interface PipelineActivity {
  id: number;
  candidateId: number;
  candidateName: string;
  action: string;
  actionLabel: string;
  stage: string;
  timestamp: string;
  performedBy: string;
}

export interface PipelineObjective {
  month: string;
  monthLabel: string;
  target: number;
  actual: number;
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
    if (params.size  !== undefined) httpParams = httpParams.set('size',  params.size);
    if (params.stage)  httpParams = httpParams.set('stage',  params.stage);
    if (params.search) httpParams = httpParams.set('search', params.search);
    return this.http.get<CandidatesPage>(`${this.base}/candidates`, { params: httpParams });
  }

  moveToStage(id: number, stage: string): Observable<KanbanCandidate> {
    return this.http.put<KanbanCandidate>(`${this.base}/candidates/${id}/stage`, stage);
  }

  getActivity(): Observable<PipelineActivity[]> {
    return this.http.get<PipelineActivity[]>(`${this.base}/activity`);
  }

  getObjectives(): Observable<PipelineObjective[]> {
    return this.http.get<PipelineObjective[]>(`${this.base}/objectives`);
  }
}
