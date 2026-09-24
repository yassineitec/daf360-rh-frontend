import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface EmployeePayrollConfigDto {
  profileUserId: number;
  // Null on a never-configured employee whose paysId payroll-service's own cross-service HR
  // lookup couldn't resolve — see RemunerationSectionComponent's own fallback to profile().paysId.
  paysId: number | null;
  contractType: string;
  selectedBenefitCodes: string[];
  currentGrossSalary: number | null;
  currentNetSalary: number | null;
  updatedBy: number | null;
  updatedAt: string | null;
}

export interface UpsertEmployeePayrollConfigRequest {
  paysId: number;
  contractType: string;
  selectedBenefitCodes: string[];
  currentGrossSalary: number | null;
  currentNetSalary: number | null;
  reason: string;
}

export interface BenefitCatalogueDto {
  benefitCode: string;
  benefitLabelFr: string;
  benefitLabelEn: string | null;
}

export interface CalculateNetResponse {
  netInHand: number;
}

export interface EmployeePayrollBonusDto {
  id: number;
  profileUserId: number;
  amount: number;
  currency: string;
  periodMonth: number;
  periodYear: number;
  label: string;
  comment: string | null;
  createdBy: number;
  createdAt: string;
}

export interface CreateEmployeePayrollBonusRequest {
  amount: number;
  currency: string;
  periodMonth: number;
  periodYear: number;
  label: string;
  comment: string | null;
}

/**
 * The Rémunération tab's own data source — daf360-payroll-service directly, bypassing this
 * app's own backend, exactly like PayrollSimulationService (candidates module) already does.
 * See docs/superpowers/specs/2026-09-22-employee-payroll-config-design.md and
 * docs/superpowers/specs/2026-09-23-employee-config-enhancements-design.md.
 */
@Injectable({ providedIn: 'root' })
export class RemunerationService {
  private http = inject(HttpClient);
  private base = `${environment.payrollApiUrl}/api/payroll/employee-configs`;
  private paramSetBase = `${environment.payrollApiUrl}/api/payroll/parameter-sets`;

  get(profileUserId: number): Observable<EmployeePayrollConfigDto> {
    return this.http.get<EmployeePayrollConfigDto>(`${this.base}/${profileUserId}`);
  }

  upsert(profileUserId: number, req: UpsertEmployeePayrollConfigRequest): Observable<EmployeePayrollConfigDto> {
    return this.http.put<EmployeePayrollConfigDto>(`${this.base}/${profileUserId}`, req);
  }

  calculateNet(profileUserId: number, grossSalary: number): Observable<CalculateNetResponse> {
    return this.http.post<CalculateNetResponse>(`${this.base}/${profileUserId}/calculate-net`, { grossSalary });
  }

  getBonuses(profileUserId: number): Observable<EmployeePayrollBonusDto[]> {
    return this.http.get<EmployeePayrollBonusDto[]>(`${this.base}/${profileUserId}/bonuses`);
  }

  createBonus(profileUserId: number, req: CreateEmployeePayrollBonusRequest): Observable<EmployeePayrollBonusDto> {
    return this.http.post<EmployeePayrollBonusDto>(`${this.base}/${profileUserId}/bonuses`, req);
  }

  deleteBonus(profileUserId: number, bonusId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${profileUserId}/bonuses/${bonusId}`);
  }

  /** Benefits catalogue for the employee's own country, same source
   * daf360-payroll-frontend's employee-config screen and simulator already read from.
   * Requires PAYROLL_VIEW_PARAMSET or PAYROLL_RUN_SIMULATION on top of the employee-config
   * permissions — a pairing to grant alongside PAYROLL_VIEW_EMPLOYEE_CONFIG for any role that
   * should see benefits here (see the design doc's permission-rollout note). */
  getBenefits(paysId: number): Observable<{ benefits: BenefitCatalogueDto[] }> {
    return this.http.get<{ benefits: BenefitCatalogueDto[] }>(`${this.paramSetBase}/active`, {
      params: { paysId: paysId.toString() },
    });
  }
}
