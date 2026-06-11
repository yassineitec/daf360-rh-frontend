import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Leave, LeaveRequest } from '../models/leave.model';
import { Page } from '../models/page.model';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private base = `${environment.hrApiUrl}/absences`;

  constructor(private http: HttpClient) {}

  byEmployee(employeeId: number): Observable<Leave[]> {
    return this.http.get<Leave[]>(`${this.base}/employee/${employeeId}`);
  }

  pending(page = 0, size = 20): Observable<Page<Leave>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<Leave>>(`${this.base}/pending`, { params });
  }

  submit(dto: LeaveRequest): Observable<Leave> {
    return this.http.post<Leave>(this.base, dto);
  }

  approveManager(id: number, managerId: number): Observable<Leave> {
    const params = new HttpParams().set('managerId', managerId);
    return this.http.put<Leave>(`${this.base}/${id}/approve-manager`, null, { params });
  }

  approveHr(id: number, hrUserId: number): Observable<Leave> {
    const params = new HttpParams().set('hrUserId', hrUserId);
    return this.http.put<Leave>(`${this.base}/${id}/approve-hr`, null, { params });
  }

  reject(id: number, reason: string): Observable<Leave> {
    return this.http.put<Leave>(`${this.base}/${id}/reject`, { reason });
  }
}
