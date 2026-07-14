import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Payload to extend a job offer to an ACCEPTED candidate. */
export interface CreateOfferRequest {
  askedSalary?: number | null;
  proposedSalary?: number | null;
  salaryNote?: string | null;
  expectedHireDate?: string | null; // ISO yyyy-MM-dd
  expiryDate?: string | null;       // ISO yyyy-MM-dd
}

export interface OfferResponse {
  id: number;
  candidateId: number;
  askedSalary: number | null;
  proposedSalary: number | null;
  salaryNote: string | null;
  expectedHireDate: string | null;
  expiryDate: string | null;
  sentAt: string | null;
  decidedAt: string | null;
  status: string;
  rejectionReason: string | null;
}

/**
 * Job-offer / salary-negotiation actions. These live under the candidate
 * controller (/api/hr/candidates/{id}/offer...), distinct from the pipeline base.
 */
@Injectable({ providedIn: 'root' })
export class OfferService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/candidates`;

  getOffer(candidateId: number): Observable<OfferResponse> {
    return this.http.get<OfferResponse>(`${this.base}/${candidateId}/offer`);
  }

  sendOffer(candidateId: number, body: CreateOfferRequest): Observable<OfferResponse> {
    return this.http.post<OfferResponse>(`${this.base}/${candidateId}/offer`, body);
  }

  /** Renegotiate a still-open offer (revise salary/terms, keeps it SENT). */
  renegotiateOffer(candidateId: number, body: CreateOfferRequest): Observable<OfferResponse> {
    return this.http.put<OfferResponse>(`${this.base}/${candidateId}/offer`, body);
  }

  acceptOffer(candidateId: number): Observable<OfferResponse> {
    return this.http.post<OfferResponse>(`${this.base}/${candidateId}/offer/accept`, {});
  }

  rejectOffer(candidateId: number, rejectionReason: string): Observable<OfferResponse> {
    return this.http.post<OfferResponse>(`${this.base}/${candidateId}/offer/reject`, { rejectionReason });
  }
}
