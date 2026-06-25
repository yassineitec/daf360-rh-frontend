import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApprovedDemandOption,
  CreateRecruitmentDemandRequest,
  UpdateRecruitmentDemandRequest,
  RecruitmentDemandDetail,
  RecruitmentDemandSummary,
  RecruitmentDemandStatus,
  ReviewRecruitmentDemandRequest,
} from './recruitment-demand.model';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class RecruitmentDemandService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/recruitment-demands`;

  create(dto: CreateRecruitmentDemandRequest): Observable<RecruitmentDemandDetail> {
    return this.http.post<RecruitmentDemandDetail>(this.base, dto, { withCredentials: true });
  }

  listByPays(paysId: number, statut?: RecruitmentDemandStatus | '', page = 0, size = 20): Observable<PageResponse<RecruitmentDemandSummary>> {
    let params = new HttpParams().set('paysId', paysId).set('page', page).set('size', size);
    if (statut) params = params.set('statut', statut);
    return this.http.get<PageResponse<RecruitmentDemandSummary>>(this.base, { params, withCredentials: true });
  }

  listMine(statut?: RecruitmentDemandStatus | '', page = 0, size = 20): Observable<PageResponse<RecruitmentDemandSummary>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (statut) params = params.set('statut', statut);
    return this.http.get<PageResponse<RecruitmentDemandSummary>>(`${this.base}/mine`, { params, withCredentials: true });
  }

  getById(id: number): Observable<RecruitmentDemandDetail> {
    return this.http.get<RecruitmentDemandDetail>(`${this.base}/${id}`, { withCredentials: true });
  }

  review(id: number, dto: ReviewRecruitmentDemandRequest): Observable<RecruitmentDemandDetail> {
    return this.http.post<RecruitmentDemandDetail>(`${this.base}/${id}/review`, dto, { withCredentials: true });
  }

  cancel(id: number): Observable<RecruitmentDemandDetail> {
    return this.http.post<RecruitmentDemandDetail>(`${this.base}/${id}/cancel`, {}, { withCredentials: true });
  }

  getApprovedOptions(paysId: number): Observable<ApprovedDemandOption[]> {
    const params = new HttpParams().set('paysId', paysId);
    return this.http.get<ApprovedDemandOption[]>(`${this.base}/options`, { params, withCredentials: true });
  }

  updateDemand(id: number, dto: UpdateRecruitmentDemandRequest): Observable<RecruitmentDemandDetail> {
    return this.http.put<RecruitmentDemandDetail>(`${this.base}/${id}`, dto, { withCredentials: true });
  }
}
