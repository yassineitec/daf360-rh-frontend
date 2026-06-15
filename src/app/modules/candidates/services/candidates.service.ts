import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PipelineCandidateItem {
  id: number;
  fullName: string;
  poste: string;
  stage: string;
  score: number;
  datePostulation: string;
  photoUrl?: string | null;
}

export interface PipelineStats {
  totalCandidats: number;
  enEntretien: number;
  scoreMoyen: number;
  recrutementsClos: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class CandidatesPipelineService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/pipeline`;

  getStats(): Observable<PipelineStats> {
    return this.http.get<PipelineStats>(`${this.base}/stats`);
  }

  getCandidates(params: {
    search?: string;
    stage?: string;
    page?: number;
    size?: number;
  }): Observable<PageResponse<PipelineCandidateItem>> {
    let httpParams = new HttpParams();
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.stage)  httpParams = httpParams.set('stage', params.stage);
    if (params.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params.size != null) httpParams = httpParams.set('size', String(params.size));
    return this.http.get<PageResponse<PipelineCandidateItem>>(
      `${this.base}/candidates`,
      { params: httpParams },
    );
  }
}
