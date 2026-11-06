import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  TeletravailCounts, TeletravailFilter, TeletravailPage, TeletravailRow,
} from './models/teletravail.model';

/**
 * Télétravail, against rh-service's /api/hr/teletravail.
 *
 * A sibling of AutorisationsService rather than a branch of it: the two share a workflow and
 * no model — an autorisation counts minutes against a quota, a télétravail counts days (or
 * half days) against soldeTeletravail.
 *
 * The employee's own form is on the shell's self-service page; this service carries what the
 * RH screens do — read the queues, decide, withdraw one's own, archive.
 */
@Injectable({ providedIn: 'root' })
export class TeletravailService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/teletravail`;

  withdraw(id: number, motif: string, lang = 'fr'): Observable<TeletravailRow> {
    return this.http.put<TeletravailRow>(`${this.base}/${id}/withdraw`, { motif }, {
      params: new HttpParams().set('lang', lang),
    });
  }

  decide(id: number, approved: boolean, motifRefus?: string, lang = 'fr'): Observable<TeletravailRow> {
    return this.http.put<TeletravailRow>(`${this.base}/${id}/decision`,
      { approved, motifRefus: motifRefus ?? null },
      { params: new HttpParams().set('lang', lang) });
  }

  /** Refunds the days if the request had debited them. */
  archive(id: number, lang = 'fr'): Observable<TeletravailRow> {
    return this.http.put<TeletravailRow>(`${this.base}/${id}/archive`, {}, {
      params: new HttpParams().set('lang', lang),
    });
  }

  // ── The four queues ────────────────────────────────────────────────────────

  mine(f: TeletravailFilter = {}, lang = 'fr'): Observable<TeletravailPage> {
    return this.http.get<TeletravailPage>(`${this.base}/mine`, { params: this.params(f, lang) });
  }

  queue(f: TeletravailFilter = {}, lang = 'fr'): Observable<TeletravailPage> {
    return this.http.get<TeletravailPage>(`${this.base}/queue`, { params: this.params(f, lang) });
  }

  team(f: TeletravailFilter = {}, lang = 'fr'): Observable<TeletravailPage> {
    return this.http.get<TeletravailPage>(`${this.base}/team`, { params: this.params(f, lang) });
  }

  global(f: TeletravailFilter = {}, lang = 'fr'): Observable<TeletravailPage> {
    return this.http.get<TeletravailPage>(`${this.base}/global`, { params: this.params(f, lang) });
  }

  /** The global list with the same filters, as an Excel file (rh-service /global/export). */
  exportGlobal(f: TeletravailFilter = {}, lang = 'fr'): Observable<Blob> {
    return this.http.get(`${this.base}/global/export`, { params: this.params(f, lang), responseType: 'blob' });
  }

  counts(scope: 'mine' | 'manager' | 'global' = 'mine'): Observable<TeletravailCounts> {
    return this.http.get<TeletravailCounts>(`${this.base}/counts`, {
      params: new HttpParams().set('scope', scope),
    });
  }

  /** Only keys with a value are sent — an empty param means "filter on blank" server-side. */
  private params(f: TeletravailFilter, lang: string): HttpParams {
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
