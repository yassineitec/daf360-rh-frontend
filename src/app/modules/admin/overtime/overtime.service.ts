import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ParametrageHSDto, CreateParametrageHSRequest,
  OvertimeCalculationRequest, OvertimeCalculationResult,
} from './overtime.model';

@Injectable({ providedIn: 'root' })
export class OvertimeService {
  private http = inject(HttpClient);
  private base = environment.hrApiUrl + '/api/hr/config/hs';

  getAll(): Observable<ParametrageHSDto[]> {
    return this.http.get<ParametrageHSDto[]>(this.base).pipe(catchError(() => of([])));
  }

  getForPays(paysId: number): Observable<ParametrageHSDto[]> {
    return this.http.get<ParametrageHSDto[]>(`${this.base}/pays/${paysId}`).pipe(catchError(() => of([])));
  }

  create(req: CreateParametrageHSRequest): Observable<ParametrageHSDto> {
    return this.http.post<ParametrageHSDto>(this.base, req);
  }

  update(id: number, req: CreateParametrageHSRequest): Observable<ParametrageHSDto> {
    return this.http.put<ParametrageHSDto>(`${this.base}/${id}`, req);
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  calculate(req: OvertimeCalculationRequest): Observable<OvertimeCalculationResult> {
    return this.http.post<OvertimeCalculationResult>(`${this.base}/calculate`, req);
  }

  getAllPays(): Observable<{ id: number; iso_code: string; french_label: string }[]> {
    return this.http.get<{ id: number; iso_code: string; french_label: string }[]>(
      `${this.base}/pays-list`
    ).pipe(catchError(() => of([])));
  }
}
