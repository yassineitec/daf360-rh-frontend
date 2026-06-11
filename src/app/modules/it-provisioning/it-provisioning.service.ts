import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProvisioningListItem, ProvisioningDetail, UpdateProvisioningRequest } from './it-provisioning.model';

@Injectable({ providedIn: 'root' })
export class ItProvisioningService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/it-provisioning`;

  /** GET /api/hr/it-provisioning/pending */
  getPendingList(): Observable<ProvisioningListItem[]> {
    return this.http.get<ProvisioningListItem[]>(`${this.base}/pending`);
  }

  /** GET /api/hr/it-provisioning/{id} */
  getProvisioning(id: number): Observable<ProvisioningDetail> {
    return this.http.get<ProvisioningDetail>(`${this.base}/${id}`);
  }

  /** PATCH /api/hr/it-provisioning/{id} */
  updateProvisioning(id: number, dto: UpdateProvisioningRequest): Observable<ProvisioningDetail> {
    return this.http.patch<ProvisioningDetail>(`${this.base}/${id}`, dto);
  }

  /** POST /api/hr/it-provisioning/{id}/submit-email */
  submitEmail(id: number, email: string): Observable<ProvisioningDetail> {
    return this.http.post<ProvisioningDetail>(`${this.base}/${id}/submit-email`, { ms365Email: email });
  }

  /** POST /api/hr/it-provisioning/{id}/complete */
  completeProvisioning(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/complete`, {});
  }
}
