import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/**
 * Payload to DRAFT an offer round — the first one, or a renegotiation superseding it.
 *
 * Nothing is sent to the candidate by this call: the round is created DRAFT and goes to the
 * finance approval queue. `sendOffer` extends it once finance has approved.
 */
export interface CreateOfferRequest {
  askedSalary?: number | null;
  proposedSalary?: number | null;
  salaryNote?: string | null;
  /**
   * Préavis négocié in calendar days. Omitted on a first round → the backend applies the
   * candidate's grade default; omitted on a later one → the previous round's figure carries
   * forward, so a negotiated derogation is not silently undone.
   */
  noticePeriodDays?: number | null;
  noticePeriodNote?: string | null;
  expectedHireDate?: string | null; // ISO yyyy-MM-dd
  expiryDate?: string | null;       // ISO yyyy-MM-dd

  /**
   * The payroll engine's answer for `proposedSalary`, stringified verbatim.
   * **Required** — the backend refuses a round with no costing, because the round's whole
   * purpose downstream is to be approved on its employer cost.
   */
  simulationSnapshot: string;
  /** Budget year the cost lands in. Omitted → the current year. */
  fiscalYear?: number | null;
}

/** One offer ROUND. A candidate has one per negotiation round since V98. */
export interface OfferResponse {
  id: number;
  candidateId: number;
  /** 1-based negotiation round. */
  roundNumber: number;
  /** Set once a later round replaced this one; null ⇒ this is the current offer. */
  supersededAt: string | null;
  askedSalary: number | null;
  proposedSalary: number | null;
  salaryNote: string | null;
  noticePeriodDays: number | null;
  noticePeriodNote: string | null;
  expectedHireDate: string | null;
  expiryDate: string | null;
  sentAt: string | null;
  decidedAt: string | null;
  /** DRAFT (awaiting the finance decision) | SENT | ACCEPTED | REJECTED | EXPIRED. */
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

  /** Every round, newest first — the negotiation history. */
  getRounds(candidateId: number): Observable<OfferResponse[]> {
    return this.http.get<OfferResponse[]>(`${this.base}/${candidateId}/offer/rounds`);
  }

  /**
   * Create a DRAFT round and submit its cost to the finance queue, in one call.
   *
   * Was `sendOffer`, and the rename is the behaviour change: this no longer reaches the
   * candidate. Use `sendOffer` below once the round is approved.
   */
  draftOffer(candidateId: number, body: CreateOfferRequest): Observable<OfferResponse> {
    return this.http.post<OfferResponse>(`${this.base}/${candidateId}/offer`, body);
  }

  /** Renegotiate — the same thing as drafting, since a revision IS a new round. */
  renegotiateOffer(candidateId: number, body: CreateOfferRequest): Observable<OfferResponse> {
    return this.http.put<OfferResponse>(`${this.base}/${candidateId}/offer`, body);
  }

  /** Extend the approved DRAFT round to the candidate → candidate OFFER_SENT. */
  sendOffer(candidateId: number): Observable<OfferResponse> {
    return this.http.post<OfferResponse>(`${this.base}/${candidateId}/offer/send`, {});
  }

  acceptOffer(candidateId: number): Observable<OfferResponse> {
    return this.http.post<OfferResponse>(`${this.base}/${candidateId}/offer/accept`, {});
  }

  rejectOffer(candidateId: number, rejectionReason: string): Observable<OfferResponse> {
    return this.http.post<OfferResponse>(`${this.base}/${candidateId}/offer/reject`, { rejectionReason });
  }
}
