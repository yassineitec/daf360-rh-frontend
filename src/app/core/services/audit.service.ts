import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditLog } from '../models/audit.model';
import { Page } from '../models/page.model';

export interface AuditActor {
  id: number;
  fullName: string | null;
  email: string | null;
}

/** Every field optional; empty = not filtered. Dates are local calendar days, yyyy-MM-dd. */
export interface AuditLogQuery {
  q?: string;
  from?: string | null;
  to?: string | null;
  source?: 'EVENT_LOG' | 'GENERIC' | '';
  actions?: string[];
  entityTypes?: string[];
  /** A logged actor, or AUDIT_SYSTEM_ACTOR for « no user ». */
  actor?: string;
  /** One entity (its rows + the company-wide ones). The server clamps it to the caller's scope. */
  paysId?: number | null;
}

export interface AuditFacets {
  entityTypes: string[];
  actors: string[];
  eventActions: string[];
}

/** Same sentinel as AuditSearchRepository.SYSTEM_ACTOR. */
export const AUDIT_SYSTEM_ACTOR = '__SYSTEM__';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private base = `${environment.hrApiUrl}/api/hr/audit`;

  constructor(private http: HttpClient) {}

  logs(page = 0, size = 30, query: AuditLogQuery = {}): Observable<Page<AuditLog>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (query.q?.trim())          params = params.set('q', query.q.trim());
    if (query.from)               params = params.set('from', query.from);
    if (query.to)                 params = params.set('to', query.to);
    if (query.source)             params = params.set('source', query.source);
    if (query.actor)              params = params.set('actor', query.actor);
    if (query.paysId != null)     params = params.set('paysId', query.paysId);
    for (const a of query.actions ?? [])     params = params.append('actions', a);
    for (const t of query.entityTypes ?? []) params = params.append('entityTypes', t);
    return this.http.get<Page<AuditLog>>(`${this.base}/logs`, { params });
  }

  facets(): Observable<AuditFacets> {
    return this.http.get<AuditFacets>(`${this.base}/logs/facets`);
  }

  /** Resolves `Users.id`s found inside a diff's own JSON (e.g. `validated_by`) to a name --
   *  a different concept from the row's own `actor` field, which is already a readable string. */
  usersByIds(ids: number[]): Observable<AuditActor[]> {
    const params = new HttpParams().set('ids', ids.join(','));
    return this.http.get<AuditActor[]>(`${this.base}/users`, { params });
  }
}
