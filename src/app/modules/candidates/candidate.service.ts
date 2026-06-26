import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  CandidateFilter, CandidateListItem, CandidateDetail,
  CreateCandidateRequest, UpdateCandidateRequest,
  CandidateStats, CandidateHistoryItem, PageResponse,
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

  getStats(): Observable<CandidateStats> {
    const now      = new Date();
    const yr       = now.getFullYear();
    const mo       = now.getMonth();
    const firstDay = new Date(yr, mo, 1).toISOString().split('T')[0];
    const lastDay  = new Date(yr, mo + 1, 0).toISOString().split('T')[0];
    return forkJoin({
      total:          this.http.get<PageResponse<CandidateListItem>>(this.base + '?page=0&size=1').pipe(map((r: any) => r.totalElements ?? 0), catchError(() => of(0))),
      pending:        this.http.get<PageResponse<CandidateListItem>>(this.base + '?page=0&size=1&status=PENDING').pipe(map((r: any) => r.totalElements ?? 0), catchError(() => of(0))),
      hiredThisMonth: this.http.get<PageResponse<CandidateListItem>>(this.base + '?page=0&size=1&status=HIRED&from=' + firstDay + '&to=' + lastDay).pipe(map((r: any) => r.totalElements ?? 0), catchError(() => of(0))),
    }).pipe(catchError(() => of({ total: 0, pending: 0, hiredThisMonth: 0 })));
  }

  getHistory(candidateId: number): Observable<CandidateHistoryItem[]> {
    return this.http.get<CandidateHistoryItem[]>(this.base + '/' + candidateId + '/history').pipe(catchError(() => of([])));
  }

  hireCandidate(id: number, dto: HireCandidateRequest): Observable<HireCandidateResponse> {
    return this.http.post<HireCandidateResponse>(`${this.base}/${id}/hire`, dto);
  }
}
