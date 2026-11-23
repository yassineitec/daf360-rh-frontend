import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** OFFER = first offer · OFFER_REVISED = any later round (RH renegotiation, DAF counter). */
export type CandidateEmailCode = 'OFFER' | 'OFFER_REVISED';

export interface CandidateEmailTemplate {
  id: number;
  code: CandidateEmailCode;
  paysId: number;
  subject: string;
  body: string;
  active: boolean;
  updatedAt: string | null;
}

/** The built-in text of a code — what « Nouveau modèle » opens on, and what is sent without one. */
export interface CandidateEmailDefault {
  code: CandidateEmailCode;
  subject: string;
  body: string;
  tokens: string[];
}

export interface SaveCandidateEmailTemplate {
  code: CandidateEmailCode;
  paysId: number;
  subject: string;
  body: string;
  active: boolean;
}

/** « Administration > Modèles d'emails candidats » (V134). */
@Injectable({ providedIn: 'root' })
export class CandidateEmailTemplateService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/candidate-email-templates`;

  list(paysId: number): Observable<CandidateEmailTemplate[]> {
    return this.http.get<CandidateEmailTemplate[]>(this.base, { params: { paysId: String(paysId) } });
  }

  defaults(): Observable<CandidateEmailDefault[]> {
    return this.http.get<CandidateEmailDefault[]>(`${this.base}/defaults`);
  }

  create(dto: SaveCandidateEmailTemplate): Observable<CandidateEmailTemplate> {
    return this.http.post<CandidateEmailTemplate>(this.base, dto);
  }

  update(id: number, dto: SaveCandidateEmailTemplate): Observable<CandidateEmailTemplate> {
    return this.http.put<CandidateEmailTemplate>(`${this.base}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
