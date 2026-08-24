import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Mission, MissionChangeRequest, MissionEligibleEmployee,
  MissionExpensePayload, MissionPayload,
} from './mission.model';

/**
 * One service for both RH screens — Missions (manager) and Billeterie (RH). They act on
 * the same rows through the same controller, and splitting it would only duplicate the
 * base URL twice.
 */
@Injectable({ providedIn: 'root' })
export class MissionService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/missions`;

  // ── Manager ─────────────────────────────────────────────────────────────
  /** The caller's own team — the only people the backend will accept. */
  eligibleEmployees(): Observable<MissionEligibleEmployee[]> {
    return this.http.get<MissionEligibleEmployee[]>(`${this.base}/eligible-employees`);
  }

  listMine(): Observable<Mission[]> {
    return this.http.get<Mission[]>(this.base);
  }

  create(payload: MissionPayload): Observable<Mission> {
    return this.http.post<Mission>(this.base, payload);
  }

  cancel(id: number, notes: string): Observable<Mission> {
    return this.http.post<Mission>(`${this.base}/${id}/cancel`, { notes });
  }

  // ── RH — billeterie ─────────────────────────────────────────────────────
  pendingHr(): Observable<Mission[]> {
    return this.http.get<Mission[]>(`${this.base}/pending-hr`);
  }

  /** Creates the sheet on first call, updates it afterwards — one endpoint either way. */
  saveExpenses(id: number, payload: MissionExpensePayload): Observable<Mission> {
    return this.http.put<Mission>(`${this.base}/${id}/expenses`, payload);
  }

  adjust(id: number, payload: MissionPayload): Observable<Mission> {
    return this.http.put<Mission>(`${this.base}/${id}`, payload);
  }

  hrValidate(id: number, notes: string | null): Observable<Mission> {
    return this.http.post<Mission>(`${this.base}/${id}/hr-validate`, { notes });
  }

  hrReject(id: number, notes: string): Observable<Mission> {
    return this.http.post<Mission>(`${this.base}/${id}/hr-reject`, { notes });
  }

  // ── RH — the employees' asks ────────────────────────────────────────────
  pendingChangeRequests(): Observable<MissionChangeRequest[]> {
    return this.http.get<MissionChangeRequest[]>(`${this.base}/change-requests`);
  }

  resolveChangeRequest(requestId: number, accept: boolean, notes: string | null):
      Observable<MissionChangeRequest> {
    return this.http.post<MissionChangeRequest>(
      `${this.base}/change-requests/${requestId}/resolve`, { accept, notes });
  }

  // ── Shared ──────────────────────────────────────────────────────────────
  get(id: number): Observable<Mission> {
    return this.http.get<Mission>(`${this.base}/${id}`);
  }
}
