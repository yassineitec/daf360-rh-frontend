import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeeListItem } from '../../profiles/models/profile.model';

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
  pending: number;
  accepted: number;
  itInProgress: number;
  hired: number;
  rejected: number;
  total: number;
}

export interface ProfileCompletionData {
  completionRate: number;
  complete: number;
  incomplete: number;
  total: number;
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
  anniversaires: EmployeeListItem[];
  nouveauxEmployes: EmployeeListItem[];
}

export interface WeeklyStats {
  weekLabel: string;
  week: number;
  pointageEnAttente: number;
  tauxAffectation: number;
}

export interface RecruitmentStats {
  recrutementsEnCours: number;
  congesValidesMonth: number;
  newApplications: number;
}

export interface RecentActivityItem {
  id: number;
  collaborateur: string;
  action: string;
  date: string;
  type: string;
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

  getAnniversaires(): Observable<EmployeeListItem[]> {
    return this.http.get<EmployeeListItem[]>(`${this.base}/dashboard/anniversaires`);
  }

  getNouveauxEmployes(): Observable<EmployeeListItem[]> {
    return this.http.get<EmployeeListItem[]>(`${this.base}/dashboard/nouveaux-employes`);
  }

  getWeeklyStats(): Observable<WeeklyStats> {
    return this.http.get<WeeklyStats>(`${this.base}/dashboard/weekly-stats`);
  }

  getRecruitmentStats(): Observable<RecruitmentStats> {
    return this.http.get<RecruitmentStats>(`${this.base}/dashboard/recruitment-stats`);
  }

  getRecentActivity(): Observable<RecentActivityItem[]> {
    return this.http.get<RecentActivityItem[]>(`${this.base}/dashboard/recent-activity`);
  }

  load(): Observable<DashboardData> {
    return forkJoin({
      stats:             this.getStats().pipe(catchError(() => of(null))),
      workforce:         this.getWorkforce().pipe(catchError(() => of(null))),
      completion:        this.getCompletion().pipe(catchError(() => of(null))),
      finPeriodeEssai:   this.getFinPeriodeEssai().pipe(catchError(() => of([] as FinPeriodeEssaiItem[]))),
      anniversaires:     this.getAnniversaires().pipe(catchError(() => of([] as EmployeeListItem[]))),
      nouveauxEmployes:  this.getNouveauxEmployes().pipe(catchError(() => of([] as EmployeeListItem[]))),
    });
  }
}
