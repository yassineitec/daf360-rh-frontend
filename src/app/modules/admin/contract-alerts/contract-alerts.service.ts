import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** One row of contract_type_config — only the fields this screen edits are typed. */
export interface ContractTypeConfig {
  id: number;
  paysId: number;
  contractTypeCode: string;
  alertDaysBeforeExpiry: number;
  alertDaysBeforeTrialEnd: number;
  trialPeriodDaysStandard: number | null;
  trialPeriodDaysManager: number | null;
}

export interface LeadTimes {
  alertDaysBeforeExpiry: number;
  alertDaysBeforeTrialEnd: number;
}

/** What one run of the daily alert job did. `ran` is false when a run was already in progress. */
export interface AlertRunSummary {
  ran: boolean;
  due: number;
  sent: number;
  pending: number;
}

@Injectable({ providedIn: 'root' })
export class ContractAlertsService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/lifecycle`;

  list(paysId: number): Observable<ContractTypeConfig[]> {
    return this.http.get<ContractTypeConfig[]>(`${this.base}/configs`, {
      params: new HttpParams().set('paysId', paysId),
    });
  }

  create(paysId: number, contractTypeCode: string, lead: LeadTimes): Observable<ContractTypeConfig> {
    return this.http.post<ContractTypeConfig>(`${this.base}/configs`, lead, {
      params: new HttpParams().set('paysId', paysId).set('contractTypeCode', contractTypeCode),
    });
  }

  update(id: number, lead: LeadTimes): Observable<ContractTypeConfig> {
    return this.http.patch<ContractTypeConfig>(`${this.base}/config/${id}`, lead);
  }

  runNow(): Observable<AlertRunSummary> {
    return this.http.post<AlertRunSummary>(`${this.base}/alerts/process`, {});
  }
}
