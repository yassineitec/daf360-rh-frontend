import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BulkApproveResult, CongeCounts, CongeFilter, CongePage, CongeRow, LeaveBalances,
  LeaveHeaders, SettleFilter,
} from './models/conge.model';

/**
 * Congés, against rh-service's /api/hr/leave.
 *
 * The module moved here out of the timesheet application, so this is a normal RH feature on
 * the normal RH base URL — no separate backend, no extra proxy rule.
 */
@Injectable({ providedIn: 'root' })
export class CongesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/leave`;

  /** The caller's approval queue. Matches either approver slot, since either may decide. */
  queue(filter: CongeFilter = {}, lang = 'fr'): Observable<CongePage> {
    return this.http.get<CongePage>(`${this.base}/queue`, { params: this.params(filter, lang) });
  }

  /** Everyone reporting into the caller, via the role hierarchy. */
  team(filter: CongeFilter = {}, lang = 'fr'): Observable<CongePage> {
    return this.http.get<CongePage>(`${this.base}/team`, { params: this.params(filter, lang) });
  }

  /** Country-wide history. Filters on the request's stored pays, not the employee's current one. */
  global(filter: CongeFilter = {}, lang = 'fr'): Observable<CongePage> {
    return this.http.get<CongePage>(`${this.base}/global`, { params: this.params(filter, lang) });
  }

  /**
   * The leave-type catalogue, for the filter dropdown.
   *
   * Fetched rather than hardcoded: the catalogue is a table HR administers, so a list
   * compiled into the frontend goes stale the first time someone adds a type — and the
   * filter would then silently omit it.
   */
  types(lang = 'fr'): Observable<{ label: string; value: string }[]> {
    return this.http.get<{ label: string; value: string }[]>(this.base + '/types', {
      params: new HttpParams().set('lang', lang),
    });
  }

  /**
   * The catalogue with its RULES, not just its labels — currently only which balance each
   * type draws on, so a screen can point at the allowance an approval will move.
   *
   * Read from `/admin/types`'s public sibling rather than from the admin endpoint: the rules
   * that affect what an approver sees are not administrative information, and gating this on
   * CREATE_ABSENCE_TYPE would blank the highlight for every manager.
   */
  typeRules(lang = 'fr'): Observable<{ code: string; balanceField: string | null }[]> {
    return this.http.get<{ code: string; balanceField: string | null }[]>(
      `${this.base}/type-rules`, { params: new HttpParams().set('lang', lang) });
  }

  decide(id: number, approved: boolean, motifRefus?: string, lang = 'fr'): Observable<CongeRow> {
    return this.http.put<CongeRow>(`${this.base}/${id}/decision`, { approved, motifRefus }, {
      params: new HttpParams().set('lang', lang),
    });
  }

  /**
   * Approve everything the current filters match.
   *
   * Resolves the ids server-side under the same predicate as the queue, so "approve all"
   * means exactly the rows on screen rather than whatever the client last paged through.
   */
  bulkApprove(filter: CongeFilter = {}): Observable<BulkApproveResult> {
    return this.http.put<BulkApproveResult>(`${this.base}/bulk-approve`, null, {
      params: this.params(filter, 'fr'),
    });
  }

  /** Archive. An approved request has its days refunded on the way out. */
  archive(id: number, lang = 'fr'): Observable<CongeRow> {
    return this.http.put<CongeRow>(`${this.base}/${id}/archive`, null, {
      params: new HttpParams().set('lang', lang),
    });
  }

  /** Régularisation — HR creating a congé for someone else. */
  settle(collaborateurId: number, body: unknown, lang = 'fr'): Observable<CongeRow> {
    return this.http.post<CongeRow>(`${this.base}/settle/${collaborateurId}`, body, {
      params: new HttpParams().set('lang', lang),
    });
  }

  balancesOf(collaborateurId: number): Observable<LeaveBalances> {
    return this.http.get<LeaveBalances>(`${this.base}/balances/${collaborateurId}`);
  }

  /**
   * The chosen employee's types, balances and approvers — what the régularisation form needs
   * before it can offer anything. Same payload the self-service modal reads for its own user.
   */
  headersOf(collaborateurId: number, lang = 'fr'): Observable<LeaveHeaders> {
    return this.http.get<LeaveHeaders>(`${this.base}/headers/${collaborateurId}`, {
      params: new HttpParams().set('lang', lang),
    });
  }

  /** The régularisations already filed. `mine` defaults to true on the server. */
  settled(filter: SettleFilter = {}, lang = 'fr'): Observable<CongePage> {
    let p = this.params(filter, lang);
    if (filter.mine != null) p = p.set('mine', filter.mine);
    return this.http.get<CongePage>(`${this.base}/settle`, { params: p });
  }

  // ── KPI counts ──────────────────────────────────────────────────────────
  // Separate calls from the lists on purpose: the KPIs count the WHOLE set while the list
  // returns one page, and folding the counts into the page envelope would either recount on
  // every page turn or quietly report the page's own totals as the set's.

  queueCounts(): Observable<CongeCounts> {
    return this.http.get<CongeCounts>(`${this.base}/queue/counts`);
  }

  teamCounts(): Observable<CongeCounts> {
    return this.http.get<CongeCounts>(`${this.base}/team/counts`);
  }

  globalCounts(paysId?: number | null): Observable<CongeCounts> {
    let p = new HttpParams();
    if (paysId != null) p = p.set('paysId', paysId);
    return this.http.get<CongeCounts>(`${this.base}/global/counts`, { params: p });
  }

  settledCounts(mine = true): Observable<CongeCounts> {
    return this.http.get<CongeCounts>(`${this.base}/settle/counts`, {
      params: new HttpParams().set('mine', mine),
    });
  }

  /** Only the filters that are actually set — an empty string is a filter, and not the one meant. */
  private params(f: CongeFilter, lang: string): HttpParams {
    let p = new HttpParams().set('lang', lang);
    if (f.etat)                   p = p.set('etat', f.etat);
    if (f.type)                   p = p.set('type', f.type);
    if (f.from)                   p = p.set('from', f.from);
    if (f.to)                     p = p.set('to', f.to);
    if (f.collaborateurId != null) p = p.set('collaborateurId', f.collaborateurId);
    if (f.paysId != null)         p = p.set('paysId', f.paysId);
    if (f.search)                 p = p.set('search', f.search);
    if (f.sort)                   p = p.set('sort', f.sort);
    if (f.dir)                    p = p.set('dir', f.dir);
    if (f.page != null)           p = p.set('page', f.page);
    if (f.size != null)           p = p.set('size', f.size);
    return p;
  }
}
