import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EmployeeDocument,
  EmployeeListItem,
  EmployeeProfile,
  LifecycleTransitionDto,
  PageResponse,
  ProfileCreateDto,
  ProfileFilter,
  ProfileSummary,
  ProfileUpdateDto,
  RegimeAssignmentDto,
  WorkingTimeRegime,
} from './models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private http = inject(HttpClient);
  private base  = `${environment.hrApiUrl}/api/hr`;

  // ── Profile CRUD ─────────────────────────────────────────────────────────

  list(filter: ProfileFilter = {}): Observable<PageResponse<ProfileSummary>> {
    let params = new HttpParams();
    if (filter.pays)      params = params.set('pays',      filter.pays);
    if (filter.status)    params = params.set('status',    filter.status);
    if (filter.department) params = params.set('department', filter.department);
    if (filter.grade)     params = params.set('grade',     filter.grade);
    if (filter.contract)  params = params.set('contract',  filter.contract);
    if (filter.search)    params = params.set('search',    filter.search);
    if (filter.page != null) params = params.set('page',  filter.page);
    if (filter.size != null) params = params.set('size',  filter.size ?? 20);
    return this.http.get<PageResponse<ProfileSummary>>(`${this.base}/profiles`, { params });
  }

  getById(id: number): Observable<EmployeeProfile> {
    return this.http.get<EmployeeProfile>(`${this.base}/profiles/${id}`);
  }

  create(dto: ProfileCreateDto): Observable<EmployeeProfile> {
    return this.http.post<EmployeeProfile>(`${this.base}/profiles`, dto);
  }

  update(id: number, dto: ProfileUpdateDto): Observable<EmployeeProfile> {
    return this.http.patch<EmployeeProfile>(`${this.base}/profiles/${id}`, dto);
  }

  /**
   * POST /api/hr/profiles/{id}/lifecycle
   * Enforces state machine — backend returns 422 if transition is invalid.
   */
  transition(id: number, dto: LifecycleTransitionDto): Observable<EmployeeProfile> {
    return this.http.post<EmployeeProfile>(`${this.base}/profiles/${id}/lifecycle`, dto);
  }

  /** Soft-archive + pseudonymise PII. */
  archive(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/profiles/${id}`);
  }

  // ── Documents ────────────────────────────────────────────────────────────

  listDocuments(profileId: number): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${this.base}/profiles/${profileId}/documents`);
  }

  // uploadDocument(profileId: number, file: File, documentType: string): Observable<EmployeeDocument> {
  //   const fd = new FormData();
  //   fd.append('file', file);
  //   fd.append('documentType', documentType);
  //   return this.http.post<EmployeeDocument>(`${this.base}/profiles/${profileId}/documents`, fd);
  // }

  verifyDocument(profileId: number, docId: number, status: 'VERIFIED' | 'REJECTED'): Observable<EmployeeDocument> {
    return this.http.patch<EmployeeDocument>(
      `${this.base}/profiles/${profileId}/documents/${docId}/verify`,
      null,
      { params: { status } }
    );
  }

  // ── Working time regimes ─────────────────────────────────────────────────

  listRegimes(paysId: number): Observable<WorkingTimeRegime[]> {
    return this.http.get<WorkingTimeRegime[]>(`${this.base}/regimes`, {
      params: { paysId },
    });
  }

  assignRegime(profileId: number, dto: RegimeAssignmentDto): Observable<void> {
    return this.http.post<void>(`${this.base}/profiles/${profileId}/regime`, dto);
  }

  // ── All-employees list (includes users without a profile) ────────────────

  listAllEmployees(
    filter: ProfileFilter,
    page: number,
    size: number,
  ): Observable<{ content: EmployeeListItem[]; totalElements: number; totalPages: number }> {
    const params: Record<string, string | number> = { page, size };
    if (filter.search) params['search'] = filter.search;
    if (filter.pays)   params['paysId'] = filter.pays;
    if (filter.status) params['status'] = filter.status;
    return this.http.get<{ content: EmployeeListItem[]; totalElements: number; totalPages: number }>(
      `${this.base}/profiles/employees`,
      { params },
    );
  }

  /** PATCH /api/hr/profiles/users/{userId} — update lightweight user fields */
  updateUserFields(userId: number, body: Record<string, unknown>): Observable<void> {
    return this.http.patch<void>(`${this.base}/profiles/users/${userId}`, body);
  }

  /** GET /api/hr/profiles/next-employee-id?paysId=X — auto-generate next employee ID */
  nextEmployeeId(paysId: number): Observable<{ employeeId: string }> {
    return this.http.get<{ employeeId: string }>(
      `${this.base}/profiles/next-employee-id`,
      { params: { paysId: paysId.toString() } },
    );
  }

  // ── Photo ────────────────────────────────────────────────────────────────

  uploadPhoto(profileId: number, file: File): Observable<EmployeeProfile> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<EmployeeProfile>(
      `${this.base}/profiles/${profileId}/photo`, formData
    );
  }

  photoUrl(photoPath: string | null): string | null {
    if (!photoPath) return null;
    // photo_url is stored as "/api/hr/profiles/{id}/photo" — prefix with API base
    if (photoPath.startsWith('/api/')) return environment.hrApiUrl + photoPath;
    return photoPath;
  }
}
