import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DashboardStats {
  totalActifs:               number;
  newThisMonth:              number;
  onLeave:                   number;
  pendingRequests:           number;
  pctFemmes:                 number;
  pctHommes:                 number;
  collaborateursSansManager: number;
  contratsARenouveler:       number;
}

export interface WorkforceData {
  totalActifs: number;
  hommes:      number;
  femmes:      number;
  nonDefini:   number;
  pctHommes:   number;
  pctFemmes:   number;
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
}

export interface DashboardData {
  stats:            DashboardStats | null;
  workforce:        WorkforceData | null;
  completion:       ProfileCompletionData | null;
  probation:        PreviewResponse<ProbationAlertDto>;
  missingDocuments: PreviewResponse<MissingDocumentDto>;
  anniversaires:    AnniversaireDto[];
  nouveauxEmployes: NouveauEmployeDto[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr`;

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base}/dashboard/stats`);
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

  getNouveauxEmployes(): Observable<NouveauEmployeDto[]> {
    return this.http.get<NouveauEmployeDto[]>(`${this.base}/dashboard/nouveaux-employes`);
  }

  private emptyPreview<T>(): PreviewResponse<T> { return { items: [], total: 0 }; }

  load(): Observable<DashboardData> {
    return forkJoin({
      stats:            this.getStats().pipe(catchError(() => of(null))),
      workforce:        this.getWorkforce().pipe(catchError(() => of(null))),
      completion:       this.getCompletion().pipe(catchError(() => of(null))),
      probation:        this.getFinPeriodeEssai().pipe(catchError(() => of(this.emptyPreview<ProbationAlertDto>()))),
      missingDocuments: this.getMissingDocs().pipe(catchError(() => of(this.emptyPreview<MissingDocumentDto>()))),
      anniversaires:    this.getAnniversaires().pipe(catchError(() => of([] as AnniversaireDto[]))),
      nouveauxEmployes: this.getNouveauxEmployes().pipe(catchError(() => of([] as NouveauEmployeDto[]))),
    });
  }
}
