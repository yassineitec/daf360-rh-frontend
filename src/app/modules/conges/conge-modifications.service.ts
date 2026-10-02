import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CongeModificationCounts, CongeModificationCreate, CongeModificationFilter,
  CongeModificationPage, CongeModificationRow,
} from './models/conge-modification.model';

/**
 * Demandes de modification / annulation, against rh-service's /api/hr/leave-modifications.
 *
 * A sibling of {@link CongesService}, not a branch of it: the two share a subject but not a
 * workflow, and a modification has two approval stages where a congé has one.
 */
@Injectable({ providedIn: 'root' })
export class CongeModificationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/leave-modifications`;

  /** File a proposal against one's own validated congé. */
  create(body: CongeModificationCreate, lang = 'fr'): Observable<CongeModificationRow> {
    return this.http.post<CongeModificationRow>(this.base, body, {
      params: new HttpParams().set('lang', lang),
    });
  }

  /** The caller's own proposals, whatever their state. */
  mine(filter: CongeModificationFilter = {}, lang = 'fr'): Observable<CongeModificationPage> {
    return this.http.get<CongeModificationPage>(`${this.base}/mine`, {
      params: this.params(filter, lang),
    });
  }

  /** Stage 1 queue — PENDING_MANAGER for this manager. Annulations never appear here. */
  managerQueue(filter: CongeModificationFilter = {}, lang = 'fr'): Observable<CongeModificationPage> {
    return this.http.get<CongeModificationPage>(`${this.base}/manager-queue`, {
      params: this.params(filter, lang),
    });
  }

  /** Stage 2 queue — PENDING_HR inside the caller's country perimeter. */
  hrQueue(filter: CongeModificationFilter = {}, lang = 'fr'): Observable<CongeModificationPage> {
    return this.http.get<CongeModificationPage>(`${this.base}/hr-queue`, {
      params: this.params(filter, lang),
    });
  }

  /**
   * The manager's answer. Agreeing passes the proposal to HR and changes nothing yet — the
   * congé and the balance move only at the HR stage.
   */
  decideAsManager(id: number, decision: boolean, motifRefus?: string, lang = 'fr')
      : Observable<CongeModificationRow> {
    return this.http.put<CongeModificationRow>(
      `${this.base}/${id}/manager-decision`,
      { decision, motifRefus: motifRefus ?? null },
      { params: new HttpParams().set('lang', lang) },
    );
  }

  /** HR's answer — the only call here that changes a congé or a balance. */
  decideAsHr(id: number, decision: boolean, motifRefus?: string, lang = 'fr')
      : Observable<CongeModificationRow> {
    return this.http.put<CongeModificationRow>(
      `${this.base}/${id}/hr-decision`,
      { decision, motifRefus: motifRefus ?? null },
      { params: new HttpParams().set('lang', lang) },
    );
  }

  /** Badge counts for both queues. */
  counts(): Observable<CongeModificationCounts> {
    return this.http.get<CongeModificationCounts>(`${this.base}/counts`);
  }

  /** Every proposal filed against one congé — the history panel on its detail view. */
  forLeave(absenceId: number, lang = 'fr'): Observable<CongeModificationRow[]> {
    return this.http.get<CongeModificationRow[]>(`${this.base}/by-leave/${absenceId}`, {
      params: new HttpParams().set('lang', lang),
    });
  }

  /** Only keys with a value are sent — an empty param means "filter on blank" server-side. */
  private params(filter: CongeModificationFilter, lang: string): HttpParams {
    let p = new HttpParams().set('lang', lang);
    if (filter.page != null) p = p.set('page', String(filter.page));
    if (filter.size != null) p = p.set('size', String(filter.size));
    if (filter.sort) p = p.set('sort', filter.sort);
    if (filter.dir) p = p.set('dir', filter.dir);
    return p;
  }
}
