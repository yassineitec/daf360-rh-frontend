import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, catchError, of, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface HomeStats {
  totalActifs:               number;
  newThisMonth:              number;
  onLeave:                   number;
  pendingRequests:           number;
  pctFemmes:                 number;
  pctHommes:                 number;
  collaborateursSansManager: number;
  contratsARenouveler:       number;
}

export interface CountryHeadcount {
  /** null for profiles with no country set. */
  paysId: number | null;
  label:  string | null;
  count:  number;
}

export interface WorkforceData {
  totalActifs: number;
  hommes:      number;
  femmes:      number;
  nonDefini:   number;
  pctHommes:   number;
  pctFemmes:   number;
  /** Active headcount per country, biggest first — feeds the effectif bar chart. */
  byCountry:   CountryHeadcount[];
  /** Grade code EN1 … EN8. */
  ingenieurs:    number;
  /** Grade code BC1 … BC5. */
  projeteurs:    number;
  /** Shares of ingenieurs + projeteurs — everyone else counts in neither. */
  pctIngenieurs: number;
  pctProjeteurs: number;
  /** Seniority from hire date, in full years: under 5. */
  juniors:              number;
  /** 5 to 7 years. */
  confirmes:            number;
  /** 8 years and more. */
  seniors:              number;
  /** Profiles with no hire date — counted in the total, in no bucket. */
  ancienneteNonDefinie: number;
  pctJuniors:           number;
  pctConfirmes:         number;
  pctSeniors:           number;
  /** Age brackets of the whole (filtered) headcount, from the date of birth. */
  ages:                 AgeBreakdown;
  /** Same, engineers + drafters only (EN / BC grades). */
  techAges:             AgeBreakdown;
  /**
   * Age brackets of each clickable pop-up tile: femmes, hommes · ingenieurs, projeteurs,
   * autres · juniors, confirmes, seniors.
   */
  groupAges:            Partial<Record<string, AgeBreakdown>>;
}

/** Full years of age. Absent from older backends — read with `?.`. */
export interface AgeBreakdown {
  moins25:      number;
  de25a34:      number;
  de35a44:      number;
  de45a54:      number;
  plus55:       number;
  /** No date of birth — in `total`, in no bracket. */
  nonRenseigne: number;
  total:        number;
  ageMoyen:     number | null;
  /**
   * Group under 5 people: the backend withholds the brackets (all 0), since on a tiny
   * department they would give away each person's age.
   */
  hidden:       boolean;
}

export interface ProfileCompletionData {
  tauxGlobalPct:      number;
  dossiersComplets:   number;
  dossiersIncomplets: number;
}

export interface PreviewResponse<T> {
  items: T[];
  total: number;
}

export interface ProbationAlertDto {
  profileId:       number;
  fullName:        string;
  photoUrl:        string | null;
  finPeriodeEssai: string;
  joursRestants:   number;
  contractEndDate: string | null;
  department:      string | null;
  roleName:        string | null;
  gender:          string | null;
}

export interface MissingDocumentDto {
  profileId:   number;
  fullName:    string;
  /** Codes — the required list is chosen per country by RH (V121), so any type code. */
  missingDocs: string[];
  /** Same order, the country's own labels (document_types.label_fr). */
  missingDocLabels?: string[];
  urgency:     'HIGH' | 'MEDIUM' | 'LOW';
  /** The employee's country — « Pays » filter of the pop-up (absent from an older backend). */
  paysId?:     number | null;
  /** Same order as `missingDocs`: true = required by the country (absent from an older backend). */
  missingDocRequired?: boolean[];
}

/** Which documents the pop-up checks: the required ones, or every type of the country. */
export type MissingDocsScope = 'REQUIRED' | 'ALL';

export interface AnniversaireDto {
  profileId:   number;
  fullName:    string;
  photoUrl:    string | null;
  dateOfBirth: string;
  joursAvant:  number;
}

export interface NouveauEmployeDto {
  profileId:           number;
  fullName:            string;
  photoUrl:            string;
  hireDate:            string | null;
  department:          string | null;
  grade:               string | null;
  gender:              string | null;
  onboardingCompleted: boolean;
  paysLabel:           string | null;
  discipline:          string | null;
  contractType:        string | null;
  /**
   * Onboarding completeness, derived from the required document types. Onboarding
   * itself writes no task rows — only one `workflow_instances` row — so documents
   * are the only real per-employee progress signal that exists. See UI-PLAYBOOK §8b.
   */
  docsPresent:         number;
  docsRequired:        number;
  missingDocs:         string[];
  /** Per-section completeness in onboarding-wizard step order; documents last. */
  onboardingSections:  OnboardingSectionProgress[];
}

export interface OnboardingSectionProgress {
  /** Stable code — IDENTITY | CONTRACT | REGIME | PERSONAL | BANK | EMERGENCY | DOCUMENTS. */
  key:    string;
  filled: number;
  total:  number;
}

export interface HomeData {
  stats:            HomeStats | null;
  workforce:        WorkforceData | null;
  completion:       ProfileCompletionData | null;
  probation:        PreviewResponse<ProbationAlertDto>;
  missingDocuments: PreviewResponse<MissingDocumentDto>;
  anniversaires:    AnniversaireDto[];
  nouveauxEmployes: NouveauEmployeDto[];
  /**
   * Keys of the widget calls that failed. Each call still falls back to an empty
   * value so one dead endpoint can't blank the whole page — but the failures are
   * reported here instead of being swallowed. Previously every error was absorbed
   * by `catchError`, so `forkJoin` never errored, the component's `error` callback
   * was unreachable, and a fully-down backend rendered a silently empty page.
   */
  failed: string[];
}

/**
 * `?paysId=179,64` for the dashboard endpoints — the flags ticked in the navbar. Empty =
 * « Tous les pays ». Server side each id is kept only if it is in the role's country scope
 * (TenantService.resolvePaysList); nothing sent = the whole scope.
 */
function paysParams(paysIds: readonly number[]): Record<string, string> {
  return paysIds.length ? { paysId: paysIds.join(',') } : {};
}

/**
 * Data for the RH home page (`/rh/accueil`).
 *
 * ⚠️ The **backend paths are still `/api/hr/dashboard/*`** — only the frontend was
 * renamed from "dashboard" to "home". Don't go looking for `/api/hr/home/stats`; it
 * doesn't exist. Renaming the endpoints would be a breaking API change, so the response
 * types here are named after the page (`HomeStats`) while the URLs keep their original
 * segment.
 */
@Injectable({ providedIn: 'root' })
export class HomeService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr`;

  getStats(paysIds: readonly number[] = []): Observable<HomeStats> {
    return this.http.get<HomeStats>(`${this.base}/dashboard/stats`, { params: paysParams(paysIds) });
  }

  /**
   * `departmentId` narrows every workforce card (headcount, gender, country,
   * engineers/drafters, seniority) to that department and its direct sub-departments.
   */
  getWorkforce(paysIds: readonly number[] = [], departmentId: number | null = null): Observable<WorkforceData> {
    const params = departmentId != null
      ? { ...paysParams(paysIds), departmentId }
      : paysParams(paysIds);
    return this.http.get<WorkforceData>(`${this.base}/dashboard/workforce`, { params });
  }

  getCompletion(paysIds: readonly number[] = []): Observable<ProfileCompletionData> {
    return this.http.get<ProfileCompletionData>(`${this.base}/dashboard/completion`, { params: paysParams(paysIds) });
  }

  getFinPeriodeEssai(paysIds: readonly number[] = []): Observable<PreviewResponse<ProbationAlertDto>> {
    return this.http.get<PreviewResponse<ProbationAlertDto>>(`${this.base}/dashboard/fin-periode-essai`, { params: paysParams(paysIds) });
  }

  /**
   * `all` = every employee concerned (pop-up); otherwise the card's top 5.
   * `scope` = REQUIRED (the country's required documents, default) or ALL (every document type).
   */
  getMissingDocs(paysIds: readonly number[] = [], all = false,
                 scope: MissingDocsScope = 'REQUIRED'): Observable<PreviewResponse<MissingDocumentDto>> {
    const params = all ? { ...paysParams(paysIds), all: true, scope } : paysParams(paysIds);
    return this.http.get<PreviewResponse<MissingDocumentDto>>(`${this.base}/dashboard/missing-documents`, { params });
  }

  getAnniversaires(paysIds: readonly number[] = []): Observable<AnniversaireDto[]> {
    return this.http.get<AnniversaireDto[]>(`${this.base}/dashboard/anniversaires`, { params: paysParams(paysIds) });
  }

  /**
   * The backend returns joiners from the last 3 months, hire date desc. One fetch
   * feeds two consumers — the employee cards (first 4 only) and the activity
   * sidebar widget — so it asks for more than 4 deliberately.
   */
  getNouveauxEmployes(limit = 10, paysIds: readonly number[] = []): Observable<NouveauEmployeDto[]> {
    return this.http.get<NouveauEmployeDto[]>(`${this.base}/dashboard/nouveaux-employes`, {
      params: { limit, ...paysParams(paysIds) },
    });
  }

  private emptyPreview<T>(): PreviewResponse<T> { return { items: [], total: 0 }; }

  /**
   * `paysIds` empty = no filter: every country of the caller's scope.
   * `departmentId` only reaches the workforce cards — alerts and joiners stay per country.
   */
  load(paysIds: readonly number[] = [], departmentId: number | null = null): Observable<HomeData> {
    const failed: string[] = [];
    const fail = (key: string) => { failed.push(key); };

    return forkJoin({
      stats:            this.getStats(paysIds).pipe(catchError(() => { fail('stats');            return of(null); })),
      workforce:        this.getWorkforce(paysIds, departmentId).pipe(catchError(() => { fail('workforce');    return of(null); })),
      completion:       this.getCompletion(paysIds).pipe(catchError(() => { fail('completion');  return of(null); })),
      probation:        this.getFinPeriodeEssai(paysIds).pipe(catchError(() => { fail('probation');        return of(this.emptyPreview<ProbationAlertDto>()); })),
      missingDocuments: this.getMissingDocs(paysIds).pipe(catchError(() => { fail('missingDocuments');     return of(this.emptyPreview<MissingDocumentDto>()); })),
      anniversaires:    this.getAnniversaires(paysIds).pipe(catchError(() => { fail('anniversaires');      return of([] as AnniversaireDto[]); })),
      nouveauxEmployes: this.getNouveauxEmployes(10, paysIds).pipe(catchError(() => { fail('nouveauxEmployes'); return of([] as NouveauEmployeDto[]); })),
    }).pipe(map(result => ({ ...result, failed })));
  }
}
