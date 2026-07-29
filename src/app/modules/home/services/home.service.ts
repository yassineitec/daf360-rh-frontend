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
  missingDocs: ('CONTRACT' | 'ID_CARD' | 'RIB')[];
  urgency:     'HIGH' | 'MEDIUM' | 'LOW';
}

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
  missingDocs:         ('CONTRACT' | 'ID_CARD' | 'RIB')[];
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

  getStats(): Observable<HomeStats> {
    return this.http.get<HomeStats>(`${this.base}/dashboard/stats`);
  }

  getWorkforce(): Observable<WorkforceData> {
    return this.http.get<WorkforceData>(`${this.base}/dashboard/workforce`);
  }

  getCompletion(): Observable<ProfileCompletionData> {
    return this.http.get<ProfileCompletionData>(`${this.base}/dashboard/completion`);
  }

  getFinPeriodeEssai(): Observable<PreviewResponse<ProbationAlertDto>> {
    return this.http.get<PreviewResponse<ProbationAlertDto>>(`${this.base}/dashboard/fin-periode-essai`);
  }

  getMissingDocs(): Observable<PreviewResponse<MissingDocumentDto>> {
    return this.http.get<PreviewResponse<MissingDocumentDto>>(`${this.base}/dashboard/missing-documents`);
  }

  getAnniversaires(): Observable<AnniversaireDto[]> {
    return this.http.get<AnniversaireDto[]>(`${this.base}/dashboard/anniversaires`);
  }

  /**
   * The backend returns joiners from the last 3 months, hire date desc. One fetch
   * feeds two consumers — the employee cards (first 4 only) and the activity
   * sidebar widget — so it asks for more than 4 deliberately.
   */
  getNouveauxEmployes(limit = 10): Observable<NouveauEmployeDto[]> {
    return this.http.get<NouveauEmployeDto[]>(`${this.base}/dashboard/nouveaux-employes`, {
      params: { limit },
    });
  }

  private emptyPreview<T>(): PreviewResponse<T> { return { items: [], total: 0 }; }

  load(): Observable<HomeData> {
    const failed: string[] = [];
    const fail = (key: string) => { failed.push(key); };

    return forkJoin({
      stats:            this.getStats().pipe(catchError(() => { fail('stats');            return of(null); })),
      workforce:        this.getWorkforce().pipe(catchError(() => { fail('workforce');    return of(null); })),
      completion:       this.getCompletion().pipe(catchError(() => { fail('completion');  return of(null); })),
      probation:        this.getFinPeriodeEssai().pipe(catchError(() => { fail('probation');        return of(this.emptyPreview<ProbationAlertDto>()); })),
      missingDocuments: this.getMissingDocs().pipe(catchError(() => { fail('missingDocuments');     return of(this.emptyPreview<MissingDocumentDto>()); })),
      anniversaires:    this.getAnniversaires().pipe(catchError(() => { fail('anniversaires');      return of([] as AnniversaireDto[]); })),
      nouveauxEmployes: this.getNouveauxEmployes().pipe(catchError(() => { fail('nouveauxEmployes'); return of([] as NouveauEmployeDto[]); })),
    }).pipe(map(result => ({ ...result, failed })));
  }
}
