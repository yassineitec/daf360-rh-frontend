import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Anciens codes RH → codes de contrat du moteur de paie. */
const LEGACY_CONTRACT: Record<string, string> = { PERMANENT: 'CDI', FIXED_TERM: 'CDD', INTERN: 'STAGE' };

/**
 * Code de contrat envoyé au moteur pour une valeur de la liste « Type de contrat » :
 * `payrollContractCode` s'il est renseigné, sinon le code de la valeur elle-même (ramené au
 * code de paie), et CDI seulement en tout dernier recours. Avant, un `payrollContractCode`
 * vide faisait chiffrer un CDD ou un CIVP comme un CDI, sans le dire.
 */
export function payrollContractOf(v: { payrollContractCode?: string | null; valueCode?: string | null } | null | undefined): string {
  const explicit = v?.payrollContractCode?.trim();
  if (explicit) return explicit.toUpperCase();
  const code = v?.valueCode?.trim().toUpperCase();
  if (code) return LEGACY_CONTRACT[code] ?? code;
  return 'CDI';
}

/**
 * Devise d'un pays, par son code ISO : le champ `devise` du référentiel n'est pas fiable
 * (« IHE » pour la Tunisie en local), il ne sert qu'en dernier recours.
 */
const CURRENCY_BY_ISO: Record<string, string> = {
  TN: 'TND', EG: 'EGP', MA: 'MAD', DZ: 'DZD', FR: 'EUR', SA: 'SAR', AE: 'AED', US: 'USD', GB: 'GBP', CH: 'CHF',
};

interface PaysRefDto { id: number; isoCode: string; frenchLabel: string; devise: string | null; }

export interface SimulateFromNetRequest {
  paysId: number;
  inputNet: number;
  contractType?: string;
  joursTravailes?: number;
  /** Avantages à inclure. ABSENT = TOUS ceux du pays côté serveur — d'où le `[]` par défaut
   *  de `simulateFromNet` : un candidat n'a aucun avantage tant qu'on ne lui en donne pas. */
  selectedBenefitCodes?: string[];
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
  simulatedAt: string;
}

export interface CandidateCostApprovalDto {
  id: number;
  candidateId: number;
  /**
   * The offer round this decision gates, or null for a standalone budget pre-validation
   * (the creation wizard's, or one run from the Rémunération tab). A round cannot be sent
   * to the candidate until its own approval reads APPROVED.
   */
  jobOfferId?: number | null;
  /** The figure offered on that round — null on a pre-validation, which offers nothing yet. */
  proposedSalary?: number | null;
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
  /**
   * The salary finance said it WOULD approve, set when rejecting. It is what the next
   * round opens on — the whole point of a counter-proposal is to be the starting figure.
   */
  contrePropSalaire?: number | null;
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

  /** Call payroll engine: target net → full payroll breakdown. Sans avantages sauf demande
   *  explicite : le serveur les applique TOUS quand la liste est absente (ex. MEAL 198 DT
   *  ajouté d'office à chaque offre en Tunisie). */
  simulateFromNet(req: SimulateFromNetRequest): Observable<PayrollSimulationResult> {
    return this.http.post<PayrollSimulationResult>(`${this.payrollBase}/individual`,
      { selectedBenefitCodes: [], ...req });
  }

  /** Référentiel des pays de la paie, chargé une fois. */
  private paysRef$?: Observable<PaysRefDto[]>;

  /** Devise d'affichage d'un pays (TND, EGP…) — voir `CURRENCY_BY_ISO`. `null` si inconnue. */
  currencyFor(paysId: number | null | undefined): Observable<string | null> {
    if (paysId == null) return of(null);
    this.paysRef$ ??= this.http.get<PaysRefDto[]>(`${environment.payrollApiUrl}/api/payroll/ref/pays`).pipe(
      catchError(() => of([] as PaysRefDto[])),
      shareReplay(1),
    );
    return this.paysRef$.pipe(map(list => {
      const p = list.find(x => x.id === paysId);
      if (!p) return null;
      return CURRENCY_BY_ISO[p.isoCode?.toUpperCase()] ?? p.devise?.trim().toUpperCase() ?? null;
    }));
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
