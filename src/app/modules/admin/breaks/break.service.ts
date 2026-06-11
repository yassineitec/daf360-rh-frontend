import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BreakTemplateDto, BreakLegalRuleDto,
  CreateBreakTemplateRequest, CreateBreakLegalRuleRequest,
} from './break.model';

@Injectable({ providedIn: 'root' })
export class BreakService {
  private http = inject(HttpClient);
  private base = environment.hrApiUrl + '/api/hr/breaks';

  getTemplatesForRegime(regimeId: number): Observable<BreakTemplateDto[]> {
    return this.http.get<BreakTemplateDto[]>(`${this.base}/templates?regimeId=${regimeId}`)
      .pipe(catchError(() => of([])));
  }

  getTemplatesForPays(paysId: number): Observable<BreakTemplateDto[]> {
    return this.http.get<BreakTemplateDto[]>(`${this.base}/templates?paysId=${paysId}`)
      .pipe(catchError(() => of([])));
  }

  createTemplate(req: CreateBreakTemplateRequest): Observable<BreakTemplateDto> {
    return this.http.post<BreakTemplateDto>(`${this.base}/templates`, req);
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/templates/${id}`);
  }

  getLegalRules(paysId: number): Observable<BreakLegalRuleDto[]> {
    return this.http.get<BreakLegalRuleDto[]>(`${this.base}/legal-rules?paysId=${paysId}`)
      .pipe(catchError(() => of([])));
  }

  createLegalRule(req: CreateBreakLegalRuleRequest): Observable<BreakLegalRuleDto> {
    return this.http.post<BreakLegalRuleDto>(`${this.base}/legal-rules`, req);
  }

  deleteLegalRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/legal-rules/${id}`);
  }
}
