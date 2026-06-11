import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EmployeeRequest, GeneratedDocument, PageResponse,
  RequestFilter, RequestStatus, RequestType,
} from './models/request.model';

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private http = inject(HttpClient);
  private base  = `${environment.hrApiUrl}/api/hr`;

  // ── Catalog ───────────────────────────────────────────────────────────────
  listTypes(paysId: number): Observable<RequestType[]> {
    return this.http.get<RequestType[]>(`${this.base}/request-types`, {
      params: { pays: paysId },
    });
  }

  // ── Employee requests ─────────────────────────────────────────────────────
  listRequests(filter: RequestFilter = {}): Observable<PageResponse<EmployeeRequest>> {
    let params = new HttpParams();
    if (filter.profileId != null) params = params.set('profileId', filter.profileId);
    if (filter.status)            params = params.set('status',    filter.status);
    if (filter.typeId   != null)  params = params.set('typeId',    filter.typeId);
    if (filter.paysId   != null)  params = params.set('paysId',    filter.paysId);
    if (filter.page     != null)  params = params.set('page',      filter.page);
    if (filter.size     != null)  params = params.set('size',      filter.size ?? 20);
    return this.http.get<PageResponse<EmployeeRequest>>(`${this.base}/requests`, { params });
  }

  getRequest(id: number): Observable<EmployeeRequest> {
    return this.http.get<EmployeeRequest>(`${this.base}/requests/${id}`);
  }

  /** Submit a new request for a profile. Attachment is sent via FormData when present. */
  submitRequest(profileId: number, typeId: number, comment: string, file?: File | null): Observable<EmployeeRequest> {
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      // Backend /api/hr/requests/{profileId} expects body with typeId
      // We encode extra fields as query params to avoid multipart complexity
      const params = new HttpParams()
        .set('typeId', typeId)
        .set('comment', comment);
      return this.http.post<EmployeeRequest>(`${this.base}/requests/${profileId}`, fd, { params });
    }
    return this.http.post<EmployeeRequest>(`${this.base}/requests/${profileId}`, { typeId, comment });
  }

  cancelRequest(id: number, profileId: number): Observable<EmployeeRequest> {
    return this.http.post<EmployeeRequest>(`${this.base}/requests/${id}/cancel`, null, {
      params: { profileId },
    });
  }

  // ── Officer processing ────────────────────────────────────────────────────
  processRequest(id: number, officerId: number, decision: 'APPROVED' | 'REJECTED', comment: string): Observable<EmployeeRequest> {
    return this.http.post<EmployeeRequest>(`${this.base}/requests/${id}/process`, {
      officerId, decision, comment,
    });
  }

  /** Inbox: all pending + in-review requests for a pays. */
  listPending(paysId: number, page = 0): Observable<PageResponse<EmployeeRequest>> {
    return this.listRequests({ paysId, page, size: 30 });
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  listDocuments(requestId: number): Observable<GeneratedDocument[]> {
    return this.http.get<GeneratedDocument[]>(`${this.base}/requests/${requestId}/document`);
  }

  generateDocument(requestId: number): Observable<GeneratedDocument[]> {
    return this.http.post<GeneratedDocument[]>(`${this.base}/requests/${requestId}/generate`, null);
  }
}
