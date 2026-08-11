import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SimulationMode = 'NET_TO_BRUT' | 'BRUT_TO_NET';

export interface SimulateFromNetRequest {
  paysId: number;
  /** NET_TO_BRUT: required. BRUT_TO_NET: ignored. */
  inputNet?: number;
  /** BRUT_TO_NET: required. NET_TO_BRUT: ignored. */
  inputGross?: number;
  /** Defaults to NET_TO_BRUT when omitted. */
  mode?: SimulationMode;
  contractType?: string;
  joursTravailes?: number;
}

export interface PayrollSimulationResult {
  id: number;
  paysId: number;
  parameterSetId: number;
  simulationType: string;
  contractType: string;
  inputNet: number;
  netTaxable: number;
  taxableBase: number;
  gross: number;
  loadedCost: number;
  loadedCostEur?: number;
  loadedCostUsd?: number;
  fxRateEur?: number;
  fxRateUsd?: number;
  localCurrency: string;
  irppAmount: number;
  employeeCharges: number;
  employerCharges: number;
  benefitsApplied?: string;
  rubriquesApplied?: string;
  iterationsUsed: number;
  convergenceOk: boolean;
  mode: SimulationMode | null;
  simulatedAt: string;
}

export interface CandidateCostApprovalDto {
  id: number;
  candidateId: number;
  candidateFirstName?: string;
  candidateLastName?: string;
  paysId: number;
  fiscalYear: number;
  salaireNetRh: number;
  salaireNetCandidat?: number;
  contractTypeCode: string;
  simulationSnapshot: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy: number;
  submittedAt: string;
  approvedBy?: number;
  approvedAt?: string;
  approvalNotes?: string;
}

export interface SubmitCostApprovalRequest {
  candidateId: number;
  paysId: number;
  fiscalYear: number;
  salaireNetRh: number;
  salaireNetCandidat?: number;
  contractTypeCode: string;
  simulationSnapshot: string;
}

@Injectable({ providedIn: 'root' })
export class PayrollSimulationService {
  private http        = inject(HttpClient);
  private payrollBase = `${environment.payrollApiUrl}/api/payroll/simulations`;
  private hrBase      = `${environment.hrApiUrl}/api/hr/cost-approvals`;

  /** Call payroll engine: target net → full payroll breakdown. */
  simulateFromNet(req: SimulateFromNetRequest): Observable<PayrollSimulationResult> {
    return this.http.post<PayrollSimulationResult>(`${this.payrollBase}/individual`, req);
  }

  /** Submit simulation snapshot to RH service for CD approval. */
  submitForApproval(req: SubmitCostApprovalRequest): Observable<CandidateCostApprovalDto> {
    return this.http.post<CandidateCostApprovalDto>(this.hrBase, req);
  }

  /** CD inbox — pending approvals for a country. */
  getPendingByPays(paysId: number): Observable<CandidateCostApprovalDto[]> {
    return this.http.get<CandidateCostApprovalDto[]>(`${this.hrBase}/pending`, {
      params: { paysId: paysId.toString() }
    });
  }

  /** Approval history for a single candidate. */
  getByCandidate(candidateId: number): Observable<CandidateCostApprovalDto[]> {
    return this.http.get<CandidateCostApprovalDto[]>(`${this.hrBase}/candidate/${candidateId}`);
  }

  approve(id: number, notes?: string): Observable<CandidateCostApprovalDto> {
    return this.http.post<CandidateCostApprovalDto>(`${this.hrBase}/${id}/approve`, { notes });
  }

  reject(id: number, notes?: string): Observable<CandidateCostApprovalDto> {
    return this.http.post<CandidateCostApprovalDto>(`${this.hrBase}/${id}/reject`, { notes });
  }
}
