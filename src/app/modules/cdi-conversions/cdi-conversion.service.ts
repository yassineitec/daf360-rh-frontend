import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CdiConversion, CdiDecisionPayload, SubmitCdiConversionPayload,
} from './cdi-conversion.model';

@Injectable({ providedIn: 'root' })
export class CdiConversionService {
  private http = inject(HttpClient);
  private base = environment.hrApiUrl;

  /** `todo` = what waits for me (validator / arbiter / RH to convert); else every visible request. */
  list(todo: boolean): Observable<CdiConversion[]> {
    return this.http.get<CdiConversion[]>(`${this.base}/api/hr/cdi-conversions`, { params: { todo } });
  }

  get(id: number): Observable<CdiConversion> {
    return this.http.get<CdiConversion>(`${this.base}/api/hr/cdi-conversions/${id}`);
  }

  /** Latest request of a contract, null when there is none (204). */
  latestForContract(contractId: number): Observable<CdiConversion | null> {
    return this.http.get<CdiConversion>(`${this.base}/api/hr/contracts/${contractId}/cdi-conversion`,
      { observe: 'response' }).pipe(map(res => res.body ?? null));
  }

  submit(contractId: number, payload: SubmitCdiConversionPayload): Observable<CdiConversion> {
    return this.http.post<CdiConversion>(`${this.base}/api/hr/contracts/${contractId}/cdi-conversion`, payload);
  }

  decide(id: number, payload: CdiDecisionPayload): Observable<CdiConversion> {
    return this.http.post<CdiConversion>(`${this.base}/api/hr/cdi-conversions/${id}/decision`, payload);
  }

  cancel(id: number, comment: string | null): Observable<CdiConversion> {
    return this.http.post<CdiConversion>(`${this.base}/api/hr/cdi-conversions/${id}/cancel`, { comment });
  }
}
