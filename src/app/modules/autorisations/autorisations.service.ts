import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AutorisationCounts, AutorisationCreate, AutorisationFilter, AutorisationPage,
  AutorisationQuota, AutorisationRow,
} from './models/autorisation.model';

/**
 * Autorisations, against rh-service's /api/hr/autorisations.
 *
 * A sibling of CongesService, not a branch of it: the two share a workflow and no model —
 * an autorisation counts minutes against a quota, a congé counts days against a balance.
 */
@Injectable({ providedIn: 'root' })
export class AutorisationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/autorisations`;

  /** The caps in force for the caller, and what is left this month. */
  quota(): Observable<AutorisationQuota> {
    return this.http.get<AutorisationQuota>(`${this.base}/quota`);
  }

  create(body: AutorisationCreate, lang = 'fr'): Observable<AutorisationRow> {
    return this.http.post<AutorisationRow>(this.base, body, {
      params: new HttpParams().set('lang', lang),
    });
  }

  update(id: number, body: AutorisationCreate, lang = 'fr'): Observable<AutorisationRow> {
    return this.http.put<AutorisationRow>(`${this.base}/${id}`, body, {
      params: new HttpParams().set('lang', lang),
    });
  }

  withdraw(id: number, motif: string, lang = 'fr'): Observable<AutorisationRow> {
    return this.http.put<AutorisationRow>(`${this.base}/${id}/withdraw`, { motif }, {
      params: new HttpParams().set('lang', lang),
    });
  }

  decide(id: number, approved: boolean, motifRefus?: string, lang = 'fr'): Observable<AutorisationRow> {
    return this.http.put<AutorisationRow>(`${this.base}/${id}/decision`,
      { approved, motifRefus: motifRefus ?? null },
      { params: new HttpParams().set('lang', lang) });
  }

  archive(id: number, lang = 'fr'): Observable<AutorisationRow> {
    return this.http.put<AutorisationRow>(`${this.base}/${id}/archive`, {}, {
      params: new HttpParams().set('lang', lang),
    });
  }

  /** HR records an absence that already happened — filed already approved. */
  settle(collaborateurId: number, body: AutorisationCreate, lang = 'fr'): Observable<AutorisationRow> {
    return this.http.post<AutorisationRow>(`${this.base}/settle/${collaborateurId}`, body, {
      params: new HttpParams().set('lang', lang),
    });
  }

  // ── The four queues ────────────────────────────────────────────────────────

  mine(f: AutorisationFilter = {}, lang = 'fr'): Observable<AutorisationPage> {
    return this.http.get<AutorisationPage>(`${this.base}/mine`, { params: this.params(f, lang) });
  }

  queue(f: AutorisationFilter = {}, lang = 'fr'): Observable<AutorisationPage> {
    return this.http.get<AutorisationPage>(`${this.base}/queue`, { params: this.params(f, lang) });
  }

  team(f: AutorisationFilter = {}, lang = 'fr'): Observable<AutorisationPage> {
    return this.http.get<AutorisationPage>(`${this.base}/team`, { params: this.params(f, lang) });
  }

  global(f: AutorisationFilter = {}, lang = 'fr'): Observable<AutorisationPage> {
    return this.http.get<AutorisationPage>(`${this.base}/global`, { params: this.params(f, lang) });
  }

  /** The global list with the same filters, as an Excel file (rh-service /global/export). */
  exportGlobal(f: AutorisationFilter = {}, lang = 'fr'): Observable<Blob> {
    return this.http.get(`${this.base}/global/export`, { params: this.params(f, lang), responseType: 'blob' });
  }

  counts(scope: 'mine' | 'manager' | 'global' = 'mine'): Observable<AutorisationCounts> {
    return this.http.get<AutorisationCounts>(`${this.base}/counts`, {
      params: new HttpParams().set('scope', scope),
    });
  }

  /** Only keys with a value are sent — an empty param means "filter on blank" server-side. */
  private params(f: AutorisationFilter, lang: string): HttpParams {
    let p = new HttpParams().set('lang', lang);
    if (f.etat) p = p.set('etat', f.etat);
    if (f.from) p = p.set('from', f.from);
    if (f.to) p = p.set('to', f.to);
    if (f.page != null) p = p.set('page', String(f.page));
    if (f.size != null) p = p.set('size', String(f.size));
    if (f.sort) p = p.set('sort', f.sort);
    if (f.dir) p = p.set('dir', f.dir);
    return p;
  }
}
