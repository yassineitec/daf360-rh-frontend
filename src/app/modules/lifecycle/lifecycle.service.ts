import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CompleteTaskRequest, CreateAssetReturnRequest, ExitInterview, ExitInterviewRequest,
  HrNotification, OffboardingAssetReturn, OffboardingFilter, OffboardingTask,
  OffboardingWorkflowInstance, StartOffboardingRequest,
} from './models/lifecycle.model';

@Injectable({ providedIn: 'root' })
export class LifecycleService {
  private http      = inject(HttpClient);
  private base      = `${environment.hrApiUrl}/api/hr/offboarding`;
  private notifBase = `${environment.hrApiUrl}/api/hr/notifications`;

  // ── Workflows ─────────────────────────────────────────────────────────────
  startOffboarding(dto: StartOffboardingRequest): Observable<OffboardingWorkflowInstance> {
    return this.http.post<OffboardingWorkflowInstance>(this.base, dto);
  }

  listOffboarding(filter: OffboardingFilter = {}): Observable<OffboardingWorkflowInstance[]> {
    let params = new HttpParams();
    if (filter.status) params = params.set('status', filter.status);
    if (filter.paysId) params = params.set('paysId', String(filter.paysId));
    return this.http.get<OffboardingWorkflowInstance[]>(this.base, { params });
  }

  getOffboarding(id: number): Observable<OffboardingWorkflowInstance> {
    return this.http.get<OffboardingWorkflowInstance>(`${this.base}/${id}`);
  }

  validateOffboarding(id: number): Observable<OffboardingWorkflowInstance> {
    return this.http.post<OffboardingWorkflowInstance>(`${this.base}/${id}/validate`, {});
  }

  cancelOffboarding(id: number, reason: string): Observable<OffboardingWorkflowInstance> {
    return this.http.post<OffboardingWorkflowInstance>(`${this.base}/${id}/cancel`, { reason });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  completeTask(taskId: number, dto: CompleteTaskRequest): Observable<OffboardingTask> {
    return this.http.post<OffboardingTask>(`${this.base}/tasks/${taskId}/complete`, dto);
  }

  skipTask(taskId: number, reason: string): Observable<OffboardingTask> {
    return this.http.post<OffboardingTask>(`${this.base}/tasks/${taskId}/skip`, { reason });
  }

  // ── Exit interview ─────────────────────────────────────────────────────────
  getExitInterview(instanceId: number): Observable<ExitInterview> {
    return this.http.get<ExitInterview>(`${this.base}/${instanceId}/exit-interview`);
  }

  saveExitInterview(instanceId: number, dto: ExitInterviewRequest): Observable<ExitInterview> {
    return this.http.post<ExitInterview>(`${this.base}/${instanceId}/exit-interview`, dto);
  }

  // ── Asset returns ──────────────────────────────────────────────────────────
  getAssets(instanceId: number): Observable<OffboardingAssetReturn[]> {
    return this.http.get<OffboardingAssetReturn[]>(`${this.base}/${instanceId}/assets`);
  }

  syncAssetsFromIt(instanceId: number): Observable<OffboardingAssetReturn[]> {
    return this.http.post<OffboardingAssetReturn[]>(`${this.base}/${instanceId}/assets/sync-from-it`, null);
  }

  addAsset(instanceId: number, dto: CreateAssetReturnRequest): Observable<OffboardingAssetReturn> {
    return this.http.post<OffboardingAssetReturn>(`${this.base}/${instanceId}/assets`, dto);
  }

  confirmAssetReturn(assetId: number, conditionOnReturn: string): Observable<OffboardingAssetReturn> {
    return this.http.patch<OffboardingAssetReturn>(
      `${this.base}/assets/${assetId}/confirm-return`,
      { conditionOnReturn },
    );
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  listNotifications(): Observable<HrNotification[]> {
    return this.http.get<HrNotification[]>(this.notifBase);
  }

  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.notifBase}/unread-count`);
  }

  markRead(id: number): Observable<HrNotification> {
    return this.http.patch<HrNotification>(`${this.notifBase}/${id}/read`, null);
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.notifBase}/read-all`, null);
  }
}
