import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
export interface AnniversaireDto {
  profileId: number;
  fullName: string;
  photoUrl: string | null;
  dateOfBirth: string;
  joursAvant: number;
}

export interface NouveauEmployeDto {
  profileId: number;
  fullName: string;
  photoUrl: string | null;
  hireDate: string | null;
  department: string | null;
  grade: string | null;
}

export interface WorkforceStats {
  totalActifs: number;
  newThisMonth: number;
  onLeave: number;
  pendingRequests: number;
  pctFemmes?: number;
  pctHommes?: number;
  collaborateursSansManager?: number;
  contratsARenouveler?: number;
}

export interface WorkforceData {
  totalActifs: number;
  hommes: number;
  femmes: number;
  nonDefini: number;
  pctHommes: number;
  pctFemmes: number;
}

export interface ProfileCompletionData {
  tauxGlobalPct: number;
  dossiersComplets: number;
  dossiersIncomplets: number;
}

export interface FinPeriodeEssaiItem {
  profileId: number;
  fullName: string;
  finPeriodeEssai: string;
  joursRestants?: number;
  department: string | null;
  roleName: string | null;
  gender: string | null;
  photoUrl: string | null;
}

export interface DashboardData {
  stats: WorkforceStats | null;
  workforce: WorkforceData | null;
  completion: ProfileCompletionData | null;
  finPeriodeEssai: FinPeriodeEssaiItem[];
  anniversaires: AnniversaireDto[];
  nouveauxEmployes: NouveauEmployeDto[];
}


@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr`;

  getStats(): Observable<WorkforceStats> {
    return this.http.get<WorkforceStats>(`${this.base}/dashboard/stats`);
  }

  getWorkforce(): Observable<WorkforceData> {
    return this.http.get<WorkforceData>(`${this.base}/dashboard/workforce`);
  }

  getCompletion(): Observable<ProfileCompletionData> {
    return this.http.get<ProfileCompletionData>(`${this.base}/dashboard/completion`);
  }

  getFinPeriodeEssai(): Observable<FinPeriodeEssaiItem[]> {
    return this.http.get<FinPeriodeEssaiItem[]>(`${this.base}/dashboard/fin-periode-essai`);
  }

  getAnniversaires(): Observable<AnniversaireDto[]> {
    return this.http.get<AnniversaireDto[]>(`${this.base}/dashboard/anniversaires`);
  }

  getNouveauxEmployes(): Observable<NouveauEmployeDto[]> {
    return this.http.get<NouveauEmployeDto[]>(`${this.base}/dashboard/nouveaux-employes`);
  }

  load(): Observable<DashboardData> {
    return forkJoin({
      stats:             this.getStats().pipe(catchError(() => of(null))),
      workforce:         this.getWorkforce().pipe(catchError(() => of(null))),
      completion:        this.getCompletion().pipe(catchError(() => of(null))),
      finPeriodeEssai:   this.getFinPeriodeEssai().pipe(catchError(() => of([] as FinPeriodeEssaiItem[]))),
      anniversaires:     this.getAnniversaires().pipe(catchError(() => of([] as AnniversaireDto[]))),
      nouveauxEmployes:  this.getNouveauxEmployes().pipe(catchError(() => of([] as NouveauEmployeDto[]))),
    });
  }
}
