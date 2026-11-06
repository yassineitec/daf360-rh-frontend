import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** One employee's approved days in one month (rh-service LeaveStatsService.StatRow). */
export interface LeaveStatRow {
  collaborateurId: number;
  collaborateurName: string | null;
  collaborateurProfileId: number | null;
  collaborateurPhotoUrl: string | null;
  collaborateurGender: string | null;
  month: number;
  year: number;
  totalConge: number;
  totalMaladie: number;
  total: number;
}

/** Totals over every row the filters match — not only the page. */
export interface LeaveStatsSummary {
  collaborateurs: number;
  totalConge: number;
  totalMaladie: number;
  total: number;
}

export interface LeaveStatsPage {
  content: LeaveStatRow[];
  totalElements: number;
  page: number;
  size: number;
  summary: LeaveStatsSummary;
}

/** The filter panel's choices: only what occurs in the caller's statistics. */
export interface LeaveStatsFilterOptions {
  collaborateurs: { id: number; name: string | null }[];
  months: number[];
  years: number[];
}

export interface LeaveStatsFilter {
  search?: string | null;
  collaborateurs?: string[];
  months?: string[];
  years?: string[];
  sort?: string | null;
  dir?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

/**
 * « Statistiques des absences » — rh-service /api/hr/leave/stats. List, choices and export
 * share one query string, so the file holds what the list shows. The country scope is the
 * caller's role scope, applied server-side.
 */
@Injectable({ providedIn: 'root' })
export class LeaveStatsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/leave/stats`;

  page(filter: LeaveStatsFilter): Observable<LeaveStatsPage> {
    return this.http.get<LeaveStatsPage>(this.base, { params: this.params(filter) });
  }

  filterOptions(): Observable<LeaveStatsFilterOptions> {
    return this.http.get<LeaveStatsFilterOptions>(`${this.base}/filter-options`);
  }

  export(filter: LeaveStatsFilter, lang: string): Observable<Blob> {
    const params = this.params({ ...filter, page: undefined, size: undefined }).set('lang', lang);
    return this.http.get(`${this.base}/export`, { params, responseType: 'blob' });
  }

  /** Lists go comma-joined; empty values are not sent. */
  private params(f: LeaveStatsFilter): HttpParams {
    let p = new HttpParams();
    if (f.search) p = p.set('search', f.search);
    for (const key of ['collaborateurs', 'months', 'years'] as const) {
      const values = f[key];
      if (values?.length) p = p.set(key, values.join(','));
    }
    if (f.sort) p = p.set('sort', f.sort).set('dir', f.dir ?? 'asc');
    if (f.page != null) p = p.set('page', String(f.page));
    if (f.size != null) p = p.set('size', String(f.size));
    return p;
  }
}
