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
  /** In the working currency. When `inputCurrency` is set, the amount as typed is
   *  `inputAmountOriginal` — see `toEditableConfig`. */
  currentGrossSalary: number | null;
  /** Computed by the payroll engine from the gross on every save — read-only. */
  currentNetSalary: number | null;
  /** IRPP family situation — read by payroll from THIS app's profile (source of truth). */
  isMarried: boolean;
  childrenCount: number;
  /** false = payroll couldn't reach RH and shows its last cached value. */
  familyFromHr: boolean | null;
  updatedBy: number | null;
  updatedAt: string | null;
  /** Set only when the stored gross salary was originally typed in a different currency
   *  than the working one — null in the common case. */
  inputCurrency: string | null;
  inputAmountOriginal: number | null;
  /** The country's working currency, resolved server-side — this app has no `pays_ref`
   *  lookup of its own, so this is the only source for it on this screen. */
  workingCurrency: string | null;
  /** Date the current salary applies from (ISO yyyy-MM-dd); null before V37 / never saved. */
  effectiveDate: string | null;
}

/** A benefit as priced when a salary change was saved (null amount/labels on pre-V37 rows). */
export interface BenefitSnapshotDto {
  code: string;
  labelFr: string | null;
  labelEn: string | null;
  monthlyValue: number | null;
  taxable: boolean | null;
}

/** One salary change, newest first in the list the server returns. */
export interface EmployeePayrollConfigHistoryDto {
  id: number;
  paysId: number;
  contractType: string;
  selectedBenefitCodes: string[];
  benefits: BenefitSnapshotDto[];
  /** In `workingCurrency`. */
  currentGrossSalary: number | null;
  currentNetSalary: number | null;
  /** Values this change replaced; null on the first save. */
  previousGrossSalary: number | null;
  previousNetSalary: number | null;
  workingCurrency: string | null;
  reason: string;
  changedBy: number;
  /** Full name from payroll's users_ref; null when that user is not synced. */
  changedByName: string | null;
  changedAt: string;
  /** Null on rows saved before V37 — screens fall back to `changedAt`. */
  effectiveDate: string | null;
  inputCurrency: string | null;
  inputAmountOriginal: number | null;
  /** Country director who approved it (payroll V38); null for a direct save (first salary). */
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
}

export interface UpsertEmployeePayrollConfigRequest {
  paysId: number;
  contractType: string;
  selectedBenefitCodes: string[];
  /** As typed, in `inputCurrency` (or in the working currency when that is null). */
  currentGrossSalary: number | null;
  /** Ignored by the server whenever it can compute the net from the gross. */
  currentNetSalary: number | null;
  reason: string;
  inputCurrency?: string | null;
  /** Date the salary applies from (yyyy-MM-dd); omitted = the day of the save. */
  effectiveDate?: string | null;
}

/**
 * The config as the form edits it: when the gross was typed in another currency, the field
 * shows (and sends back) the amount AS TYPED, not the converted one stored in
 * `currentGrossSalary` — sending the converted figure with `inputCurrency` converted the
 * salary once more on every save.
 */
export function toEditableConfig(dto: EmployeePayrollConfigDto): EmployeePayrollConfigDto {
  return dto.inputCurrency && dto.inputAmountOriginal != null
    ? { ...dto, currentGrossSalary: dto.inputAmountOriginal }
    : dto;
}

/** Old RH onboarding codes → payroll codes (same mapping as payroll-service). */
const LEGACY_CONTRACT: Record<string, string> = { PERMANENT: 'CDI', FIXED_TERM: 'CDD', INTERN: 'STAGE' };

/** Contract code as payroll keys its rules on; null when RH has none. */
export function payrollContractCode(code: string | null | undefined): string | null {
  const c = code?.trim().toUpperCase();
  return c ? (LEGACY_CONTRACT[c] ?? c) : null;
}

export interface FxRateDto {
  currencyCode: string;
  rateToEur: number;
}

export interface BenefitCatalogueDto {
  benefitCode: string;
  benefitLabelFr: string;
  benefitLabelEn: string | null;
  /** Monthly value in the country's working currency. */
  monthlyValue: number | null;
  isTaxable: boolean | null;
}

/** The parts of the country's ACTIVE payroll rules this tab reads. */
export interface ActivePayrollRulesDto {
  benefits: BenefitCatalogueDto[];
  /** One row per (contract, charge): the distinct contract types are the priced contracts. */
  socialChargeRates: { contractType: string }[];
}

/** Benefit code of meal tickets in every country's catalogue. */
export const MEAL_BENEFIT_CODE = 'MEAL';

export interface CalculateNetResponse {
  netInHand: number;
}

/** One column of the simulation breakdown — every amount in the working currency. */
export interface RemunerationBreakdown {
  baseSalary: number;
  bonuses: number;
  gross: number;
  taxableBenefits: number;
  nonTaxableBenefits: number;
  employeeCharges: number;
  taxableBase: number;
  irpp: number;
  net: number;
  employerCharges: number;
  employerCost: number;
  convergenceOk: boolean;
}

/** Payroll SIMULATION engine's breakdown for the « Nouvelle rémunération » form (nothing saved). */
export interface RemunerationSimulationDto {
  currency: string;
  contractType: string;
  married: boolean | null;
  children: number | null;
  periodYear: number;
  periodMonth: number;
  benefits: { code: string; labelFr: string | null; labelEn: string | null; monthlyValue: number | null; taxable: boolean | null }[];
  bonuses: { id: number; label: string; amount: number; bonusCurrency: string; amountInCurrency: number }[];
  /** Regular month: base salary + benefits. */
  monthly: RemunerationBreakdown;
  /** The effective date's month with its exceptional bonuses added to the gross; null without bonus. */
  withBonuses: RemunerationBreakdown | null;
}

export type SalaryChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** A salary change submitted for the country director's approval (payroll V38). */
export interface SalaryChangeDto {
  id: number;
  profileUserId: number;
  employeeName: string | null;
  paysId: number;
  status: SalaryChangeStatus;
  contractType: string;
  selectedBenefitCodes: string[];
  /** As typed, in `inputCurrency` (null = working currency). */
  grossSalary: number;
  inputCurrency: string | null;
  workingCurrency: string | null;
  currentGrossSalary: number | null;
  currentNetSalary: number | null;
  newGrossSalary: number | null;
  newNetSalary: number | null;
  monthlyCostBefore: number | null;
  monthlyCostAfter: number | null;
  effectiveDate: string | null;
  reason: string;
  simulation: RemunerationSimulationDto | null;
  submittedBy: number;
  submittedByName: string | null;
  submittedAt: string;
  decidedBy: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
}

export interface SubmitSalaryChangeRequest {
  paysId: number;
  contractType: string;
  selectedBenefitCodes: string[];
  grossSalary: number;
  inputCurrency: string | null;
  effectiveDate: string | null;
  reason: string;
}

export interface RemunerationSimulationRequest {
  grossSalary: number;
  inputCurrency: string | null;
  paysId: number | null;
  contractType: string | null;
  selectedBenefitCodes: string[];
  effectiveDate: string | null;
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
  private changesBase = `${environment.payrollApiUrl}/api/payroll/salary-changes`;

  get(profileUserId: number): Observable<EmployeePayrollConfigDto> {
    return this.http.get<EmployeePayrollConfigDto>(`${this.base}/${profileUserId}`);
  }

  upsert(profileUserId: number, req: UpsertEmployeePayrollConfigRequest): Observable<EmployeePayrollConfigDto> {
    return this.http.put<EmployeePayrollConfigDto>(`${this.base}/${profileUserId}`, req);
  }

  /** Net by the real payroll engine (nothing saved), for the country/contract shown on screen. */
  calculateNet(profileUserId: number, grossSalary: number, inputCurrency: string | null,
               paysId: number | null, contractType: string | null): Observable<CalculateNetResponse> {
    return this.http.post<CalculateNetResponse>(`${this.base}/${profileUserId}/calculate-net`,
      { grossSalary, inputCurrency, paysId, contractType });
  }

  /** Payroll simulation engine on the salary being typed: benefits and the month's bonuses
   *  broken down. Nothing saved (not even in the simulations history). */
  simulate(profileUserId: number, req: RemunerationSimulationRequest): Observable<RemunerationSimulationDto> {
    return this.http.post<RemunerationSimulationDto>(`${this.base}/${profileUserId}/simulate`, req);
  }

  /** A change of an already-paid employee: submitted for approval, applied only once approved. */
  submitSalaryChange(profileUserId: number, req: SubmitSalaryChangeRequest): Observable<SalaryChangeDto> {
    return this.http.post<SalaryChangeDto>(`${this.changesBase}/employee/${profileUserId}`, req);
  }

  /** The employee's requests, newest first (pending, decided, withdrawn). */
  getSalaryChanges(profileUserId: number): Observable<SalaryChangeDto[]> {
    return this.http.get<SalaryChangeDto[]>(`${this.changesBase}/employee/${profileUserId}`);
  }

  cancelSalaryChange(id: number): Observable<SalaryChangeDto> {
    return this.http.post<SalaryChangeDto>(`${this.changesBase}/${id}/cancel`, {});
  }

  /** Salary changes, newest first, with the values they replaced and who saved them. */
  getHistory(profileUserId: number): Observable<EmployeePayrollConfigHistoryDto[]> {
    return this.http.get<EmployeePayrollConfigHistoryDto[]>(`${this.base}/${profileUserId}/history`);
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
  getActiveRules(paysId: number): Observable<ActivePayrollRulesDto> {
    return this.http.get<ActivePayrollRulesDto>(`${this.paramSetBase}/active`, {
      params: { paysId: paysId.toString() },
    });
  }

  /** Currencies the gross-salary field's picker can offer, with their cached rate-to-EUR —
   *  same source daf360-payroll-frontend's employee-config screen and Simulator already use.
   *  Requires PAYROLL_VIEW_EMPLOYEE_CONFIG/MANAGE_EMPLOYEE_CONFIG on top of the existing
   *  employee-config permissions (already widened for this on the backend). */
  getFxRates(): Observable<FxRateDto[]> {
    return this.http.get<FxRateDto[]>(`${environment.payrollApiUrl}/api/payroll/ref/fx-rates`);
  }
}
