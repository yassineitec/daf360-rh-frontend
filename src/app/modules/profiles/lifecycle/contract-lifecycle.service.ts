import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ContractListDto, ContractDetailDto, ContractTransitionHistoryDto,
  LifecycleAlertDto, CreateContractRequest, TransitionRequest,
  ValidateTrialRequest, RenewCDDRequest, ConvertToCDIRequest,
} from './contract-lifecycle.model';

@Injectable({ providedIn: 'root' })
export class ContractLifecycleService {
  private http = inject(HttpClient);
  private base = environment.hrApiUrl;

  getContracts(profileId: number): Observable<ContractListDto[]> {
    return this.http.get<ContractListDto[]>(`${this.base}/api/hr/employees/${profileId}/contracts`);
  }

  createContract(profileId: number, req: CreateContractRequest): Observable<ContractDetailDto> {
    return this.http.post<ContractDetailDto>(`${this.base}/api/hr/employees/${profileId}/contracts`, req);
  }

  getLifecycleHistory(profileId: number): Observable<ContractTransitionHistoryDto[]> {
    return this.http.get<ContractTransitionHistoryDto[]>(`${this.base}/api/hr/employees/${profileId}/lifecycle-history`);
  }

  getContract(contractId: number): Observable<ContractDetailDto> {
    return this.http.get<ContractDetailDto>(`${this.base}/api/hr/contracts/${contractId}`);
  }

  transition(contractId: number, req: TransitionRequest): Observable<ContractDetailDto> {
    return this.http.post<ContractDetailDto>(`${this.base}/api/hr/contracts/${contractId}/transition`, req);
  }

  validateTrial(contractId: number, req: ValidateTrialRequest): Observable<ContractDetailDto> {
    return this.http.post<ContractDetailDto>(`${this.base}/api/hr/contracts/${contractId}/validate-trial`, req);
  }

  renewCDD(contractId: number, req: RenewCDDRequest): Observable<ContractDetailDto> {
    return this.http.post<ContractDetailDto>(`${this.base}/api/hr/contracts/${contractId}/renew-cdd`, req);
  }

  convertToCDI(contractId: number, req: ConvertToCDIRequest): Observable<ContractDetailDto> {
    return this.http.post<ContractDetailDto>(`${this.base}/api/hr/contracts/${contractId}/convert-to-cdi`, req);
  }

  getContractHistory(contractId: number): Observable<ContractTransitionHistoryDto[]> {
    return this.http.get<ContractTransitionHistoryDto[]>(`${this.base}/api/hr/contracts/${contractId}/history`);
  }

  getAlerts(paysId: number, acknowledged?: boolean): Observable<LifecycleAlertDto[]> {
    let url = `${this.base}/api/hr/lifecycle/alerts?paysId=${paysId}`;
    if (acknowledged !== undefined) url += `&acknowledged=${acknowledged}`;
    return this.http.get<LifecycleAlertDto[]>(url);
  }

  acknowledgeAlert(alertId: number): Observable<LifecycleAlertDto> {
    return this.http.post<LifecycleAlertDto>(`${this.base}/api/hr/lifecycle/alerts/${alertId}/acknowledge`, {});
  }
}
