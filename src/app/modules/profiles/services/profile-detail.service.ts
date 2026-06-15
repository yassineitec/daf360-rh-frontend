import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface LeaveBalanceDto {
  leaveType:     string;
  joursAcquis:   number;
  joursPris:     number;
  joursRestants: number;
}

export interface LeaveHistoryDto {
  id:          number;
  leaveType:   string;
  startDate:   string;
  endDate:     string;
  etatDemande: string;
  totalJours:  number;
  comment:     string | null;
}

@Injectable({ providedIn: 'root' })
export class ProfileDetailService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr`;

  getLeaveBalances(profileId: number, year: number): Observable<LeaveBalanceDto[]> {
    return this.http
      .get<LeaveBalanceDto[]>(`${this.base}/profiles/${profileId}/leave-balances`, {
        params: new HttpParams().set('annee', year),
      })
      .pipe(catchError(() => of([])));
  }

  getLeaveHistory(profileId: number): Observable<LeaveHistoryDto[]> {
    return this.http
      .get<{ content: LeaveHistoryDto[] }>(`${this.base}/absences`, {
        params: new HttpParams()
          .set('profileId', profileId)
          .set('page', 0)
          .set('size', 10),
      })
      .pipe(
        map(res => res.content ?? []),
        catchError(() => of([])),
      );
  }
}
