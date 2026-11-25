import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ArchivedCandidate } from '../pipeline/services/pipeline.service';
import {
  ApprovedDemandOption,
  CreateRecruitmentDemandRequest,
  DemandCandidate,
  DemandHistoryEvent,
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

  /** `sort`: Spring sort param, e.g. `submittedAt,desc` — omitted = newest first (server default). */
  /** `paysId` : un pays, ou les drapeaux de la navbar (`179,64`) ; absent = tout le périmètre du rôle. */
  listByPays(paysId: number | string | undefined, statut?: RecruitmentDemandStatus | '', page = 0, size = 20, sort?: string | null): Observable<PageResponse<RecruitmentDemandSummary>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (paysId != null && paysId !== '') params = params.set('paysId', paysId);
    if (statut) params = params.set('statut', statut);
    if (sort)   params = params.set('sort', sort);
    return this.http.get<PageResponse<RecruitmentDemandSummary>>(this.base, { params, withCredentials: true });
  }

  listMine(statut?: RecruitmentDemandStatus | '', page = 0, size = 20, sort?: string | null): Observable<PageResponse<RecruitmentDemandSummary>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (statut) params = params.set('statut', statut);
    if (sort)   params = params.set('sort', sort);
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

  /** V137 — closes the demand by hand; its candidatures still in recruitment are archived. */
  close(id: number, note?: string | null): Observable<RecruitmentDemandDetail> {
    return this.http.post<RecruitmentDemandDetail>(`${this.base}/${id}/close`, { note: note ?? null }, { withCredentials: true });
  }

  /** V137 — reopens a closed demand that still has a post to fill. */
  reopen(id: number): Observable<RecruitmentDemandDetail> {
    return this.http.post<RecruitmentDemandDetail>(`${this.base}/${id}/reopen`, {}, { withCredentials: true });
  }

  /** V137 — changes the number of posts (never below the posts already filled). */
  changeHeadcount(id: number, headcount: number): Observable<RecruitmentDemandDetail> {
    return this.http.put<RecruitmentDemandDetail>(`${this.base}/${id}/headcount`, { headcount }, { withCredentials: true });
  }

  getApprovedOptions(paysId: number): Observable<ApprovedDemandOption[]> {
    const params = new HttpParams().set('paysId', paysId);
    return this.http.get<ApprovedDemandOption[]>(`${this.base}/options`, { params, withCredentials: true });
  }

  /** The demand's history, newest first — the « Historique » drawer of its detail page. */
  getHistory(demandId: number): Observable<DemandHistoryEvent[]> {
    return this.http.get<DemandHistoryEvent[]>(`${this.base}/${demandId}/history`, { withCredentials: true });
  }

  /** Every candidature of the demand, newest first — its detail page. */
  getCandidates(demandId: number): Observable<DemandCandidate[]> {
    return this.http.get<DemandCandidate[]>(`${this.base}/${demandId}/candidates`, { withCredentials: true });
  }

  /** Archived candidatures of the other demands raised for the same post (creation wizard). */
  getRelatedArchivedCandidates(demandId: number): Observable<ArchivedCandidate[]> {
    return this.http.get<ArchivedCandidate[]>(`${this.base}/${demandId}/related-archived-candidates`, { withCredentials: true });
  }

  updateDemand(id: number, dto: UpdateRecruitmentDemandRequest): Observable<RecruitmentDemandDetail> {
    return this.http.put<RecruitmentDemandDetail>(`${this.base}/${id}`, dto, { withCredentials: true });
  }
}
