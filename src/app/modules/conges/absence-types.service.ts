import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AbsenceTypeRow, AbsenceTypeUpsert } from './models/absence-type.model';

/** A role, for the approver picker. From the existing /api/hr/admin/roles endpoint. */
export interface RoleOption {
  id: number;
  frenchName: string;
}

/**
 * The leave-type catalogue, administered.
 *
 * Separate base path from the request endpoints: `/leave/admin/types` is gated on
 * CREATE_ABSENCE_TYPE, while `/leave/types` is the read-only list every employee's request
 * form uses. Two audiences, two permissions.
 */
@Injectable({ providedIn: 'root' })
export class AbsenceTypesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/leave/admin/types`;

  list(): Observable<AbsenceTypeRow[]> {
    return this.http.get<AbsenceTypeRow[]>(this.base);
  }

  create(dto: AbsenceTypeUpsert): Observable<AbsenceTypeRow> {
    return this.http.post<AbsenceTypeRow>(this.base, dto);
  }

  update(id: number, dto: AbsenceTypeUpsert): Observable<AbsenceTypeRow> {
    return this.http.put<AbsenceTypeRow>(`${this.base}/${id}`, dto);
  }

  /** Withdraw from new requests without touching the ones already filed. Reversible. */
  setActive(id: number, value: boolean): Observable<AbsenceTypeRow> {
    return this.http.put<AbsenceTypeRow>(`${this.base}/${id}/active`, null, { params: { value } });
  }

  /** How many requests use this type — asked before offering to retire it. */
  usage(id: number): Observable<{ code: string; requests: number }> {
    return this.http.get<{ code: string; requests: number }>(`${this.base}/${id}/usage`);
  }

  /** Soft delete. The history filed under the code keeps resolving. */
  retire(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Roles for the approver picker — the endpoint the role admin screen already uses. */
  roles(): Observable<RoleOption[]> {
    return this.http.get<RoleOption[]>(`${environment.hrApiUrl}/api/hr/admin/roles`);
  }
}
