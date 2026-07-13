import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  CandidateFilter, CandidateListItem, CandidateDetail,
  CreateCandidateRequest, UpdateCandidateRequest,
  CandidateStats, CandidateDashboardStats, CandidateHistoryItem, PageResponse,
  HireCandidateRequest,
  HireCandidateResponse,
} from './candidate.model';

@Injectable({ providedIn: 'root' })
export class CandidateService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/candidates`;

  list(filter: CandidateFilter = {}): Observable<CandidateListItem[]> {
    let params = new HttpParams();
    if (filter.paysId)  params = params.set('paysId',  filter.paysId);
    if (filter.status)  params = params.set('status',  filter.status);
    if (filter.search)  params = params.set('search',  filter.search);
    return this.http.get<CandidateListItem[]>(this.base, { params });
  }

  getById(id: number): Observable<CandidateDetail> {
    return this.http.get<CandidateDetail>(`${this.base}/${id}`);
  }

  create(dto: CreateCandidateRequest): Observable<CandidateDetail> {
    return this.http.post<CandidateDetail>(this.base, dto);
  }

  update(id: number, dto: UpdateCandidateRequest): Observable<CandidateDetail> {
    return this.http.put<CandidateDetail>(`${this.base}/${id}`, dto);
  }

  accept(id: number): Observable<CandidateDetail> {
    return this.http.post<CandidateDetail>(`${this.base}/${id}/accept`, {});
  }

  reject(id: number, reason: string): Observable<CandidateDetail> {
    return this.http.post<CandidateDetail>(
      `${this.base}/${id}/reject`,
      { rejectionReason: reason }
    );
  }

  /** Upload a CV file (PDF/DOC/DOCX, max 10 MB). */
  uploadCv(id: number, file: File): Observable<CandidateDetail> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<CandidateDetail>(`${this.base}/${id}/cv`, form);
  }

  /** Returns the URL to download the CV — used as href or in window.open(). */
  cvDownloadUrl(id: number): string {
    return `${this.base}/${id}/cv`;
  }

  getCandidates(filter: { paysId?: number; status?: string; search?: string; page?: number; size?: number }): Observable<PageResponse<CandidateListItem>> {
    const params: Record<string, string | number> = {};
    if (filter.paysId)          params['paysId']  = filter.paysId;
    if (filter.status)          params['status']  = filter.status;
    if (filter.search)          params['search']  = filter.search;
    if (filter.page != null)    params['page']    = filter.page;
    if (filter.size != null)    params['size']    = filter.size;
    return this.http.get<PageResponse<CandidateListItem>>(this.base, { params });
  }

  /**
   * Candidate funnel counts. Each is a `totalElements`-only page probe against
   * the paginated list endpoint (which supports `status` + tenant scoping).
   * The old `from`/`to` "this month" probe was dropped — the backend list
   * endpoint (CandidateController#list) does not accept date params, so it was
   * silently ignored and returned the all-time HIRED count anyway.
   */
  getStats(paysId?: number): Observable<CandidateStats> {
    const count = (status?: string) => {
      let params = new HttpParams().set('page', 0).set('size', 1);
      if (status) params = params.set('status', status);
      if (paysId) params = params.set('paysId', paysId);
      return this.http.get<PageResponse<CandidateListItem>>(this.base, { params })
        .pipe(map(r => r.totalElements ?? 0), catchError(() => of(0)));
    };
    return forkJoin({
      total:    count(),
      pending:  count('PENDING'),
      accepted: count('ACCEPTED'),
      hired:    count('HIRED'),
    }).pipe(catchError(() => of({ total: 0, pending: 0, accepted: 0, hired: 0 })));
  }

  /** KPI-row metrics for the /candidates dashboard (total/growth, avg delay, urgent positions). */
  getDashboardStats(): Observable<CandidateDashboardStats> {
    return this.http.get<CandidateDashboardStats>(`${this.base}/stats/dashboard`).pipe(
      catchError(() => of({
        totalCandidates: 0, monthGrowthPct: null,
        avgRecruitmentDays: null, avgRecruitmentDaysDelta: null, urgentPositions: 0,
      } as CandidateDashboardStats)),
    );
  }

  getHistory(candidateId: number): Observable<CandidateHistoryItem[]> {
    return this.http.get<CandidateHistoryItem[]>(this.base + '/' + candidateId + '/history').pipe(catchError(() => of([])));
  }

  hireCandidate(id: number, dto: HireCandidateRequest): Observable<HireCandidateResponse> {
    return this.http.post<HireCandidateResponse>(`${this.base}/${id}/hire`, dto);
  }
}
