import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  WorkingTimeRegime, RegimeDetail, RegimeRoleAssignmentResponse,
  ResolvedRegimeDto, CreateRegimeRequest, UpdateRegimeRequest,
  AssignRegimeToRoleRequest, RegimeOverviewStats, EmployeeRegimeOverview,
  AssignEmployeeOverrideRequest, EmployeeRegimeAssignment, ResolvedRegimeResult,
} from './regime.model';

@Injectable({ providedIn: 'root' })
export class RegimeService {
  private http = inject(HttpClient);
  private base = environment.hrApiUrl + '/api/hr';
  private cache = new Map<string, WorkingTimeRegime[]>();

  getRegimes(paysId: number): Observable<WorkingTimeRegime[]> {
    const key = 'r_' + paysId;
    if (this.cache.has(key)) return of(this.cache.get(key)!);
    return this.http.get<WorkingTimeRegime[]>(`${this.base}/regimes?paysId=${paysId}`).pipe(
      tap(r => this.cache.set(key, r)),
      catchError(() => of([]))
    );
  }

  getRegimeDetail(id: number): Observable<RegimeDetail> {
    return this.http.get<RegimeDetail>(`${this.base}/regimes/${id}/detail`);
  }

  createRegime(dto: CreateRegimeRequest): Observable<WorkingTimeRegime> {
    return this.http.post<WorkingTimeRegime>(`${this.base}/regimes`, dto).pipe(
      tap(() => this.invalidateCache())
    );
  }

  updateRegime(id: number, dto: UpdateRegimeRequest): Observable<WorkingTimeRegime> {
    return this.http.patch<WorkingTimeRegime>(`${this.base}/regimes/${id}`, dto).pipe(
      tap(() => this.invalidateCache())
    );
  }

  deleteRegime(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/regimes/${id}/full`).pipe(
      tap(() => this.invalidateCache())
    );
  }

  getRoleAssignments(paysId: number): Observable<RegimeRoleAssignmentResponse[]> {
    return this.http.get<RegimeRoleAssignmentResponse[]>(
      `${this.base}/regimes/role-assignments?paysId=${paysId}`
    ).pipe(catchError(() => of([])));
  }

  assignToRole(dto: AssignRegimeToRoleRequest): Observable<RegimeRoleAssignmentResponse> {
    return this.http.post<RegimeRoleAssignmentResponse>(
      `${this.base}/regimes/role-assignments`, dto
    );
  }

  removeRoleAssignment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/regimes/role-assignments/${id}`);
  }

  resolveForEmployee(employeeProfileId: number): Observable<ResolvedRegimeDto | null> {
    return this.http.get<ResolvedRegimeDto>(
      `${this.base}/regimes/resolve?employeeProfileId=${employeeProfileId}`
    ).pipe(catchError(() => of(null)));
  }

  /**
   * The employee's resolved regime, telling apart "nothing configured" (204) from
   * "not allowed" (403) and a failure — the profile page used to show all three as
   * « aucun régime configuré ».
   */
  resolveProfile(employeeProfileId: number): Observable<ResolvedRegimeResult> {
    return this.http.get<ResolvedRegimeDto>(
      `${this.base}/profiles/${employeeProfileId}/regime`, { observe: 'response' }
    ).pipe(
      map((res): ResolvedRegimeResult => res.status === 204 || !res.body
        ? { status: 'none' }
        : { status: 'ok', regime: res.body }),
      catchError((err: HttpErrorResponse) => of<ResolvedRegimeResult>(
        err.status === 403 ? { status: 'forbidden' } : { status: 'error' })),
    );
  }

  /** Personal assignments in force today or scheduled. */
  getEmployeeAssignments(profileId: number): Observable<EmployeeRegimeAssignment[]> {
    return this.http.get<EmployeeRegimeAssignment[]>(
      `${this.base}/profiles/${profileId}/regime/assignments`
    ).pipe(catchError(() => of([])));
  }

  /** Ends (started) or cancels (scheduled) one personal assignment. */
  endEmployeeAssignment(profileId: number, assignmentId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/profiles/${profileId}/regime/assignments/${assignmentId}`
    );
  }

  invalidateCache(): void { this.cache.clear(); }

  getOverviewStats(paysId: number): import('rxjs').Observable<RegimeOverviewStats> {
    return this.http.get<RegimeOverviewStats>(
      this.base + '/regimes/overview/stats?paysId=' + paysId
    );
  }

  getOverviewEmployees(paysId: number): import('rxjs').Observable<EmployeeRegimeOverview[]> {
    return this.http.get<EmployeeRegimeOverview[]>(
      this.base + '/regimes/overview/employees?paysId=' + paysId
    ).pipe(catchError(() => of([])));
  }

  assignEmployeeOverride(profileId: number, dto: AssignEmployeeOverrideRequest): import('rxjs').Observable<void> {
    return this.http.post<void>(
      this.base + '/profiles/' + profileId + '/regime/override', dto
    );
  }

  removeEmployeeOverride(profileId: number): import('rxjs').Observable<void> {
    return this.http.delete<void>(
      this.base + '/profiles/' + profileId + '/regime/override'
    );
  }
}
