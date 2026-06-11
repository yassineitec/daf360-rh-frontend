import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateWorkflowDto, HrNotification,
  PageResponse, WorkflowFilter, WorkflowInstance, WorkflowTask,
} from './models/lifecycle.model';

@Injectable({ providedIn: 'root' })
export class LifecycleService {
  private http = inject(HttpClient);
  private base  = `${environment.hrApiUrl}/api/hr`;

  // ── Workflow instances ─────────────────────────────────────────────────────
  listWorkflows(filter: WorkflowFilter = {}): Observable<PageResponse<WorkflowInstance>> {
    let params = new HttpParams();
    if (filter.status)       params = params.set('status',    filter.status);
    if (filter.eventType)    params = params.set('eventType', filter.eventType);
    if (filter.paysId)       params = params.set('paysId',    filter.paysId);
    if (filter.page != null) params = params.set('page',      filter.page);
    if (filter.size != null) params = params.set('size',      filter.size ?? 20);
    return this.http.get<PageResponse<WorkflowInstance>>(`${this.base}/lifecycle`, { params });
  }

  getWorkflow(id: number): Observable<WorkflowInstance> {
    return this.http.get<WorkflowInstance>(`${this.base}/lifecycle/${id}`);
  }

  createWorkflow(dto: CreateWorkflowDto): Observable<WorkflowInstance> {
    return this.http.post<WorkflowInstance>(`${this.base}/lifecycle`, dto);
  }

  cancelWorkflow(id: number): Observable<WorkflowInstance> {
    return this.http.patch<WorkflowInstance>(`${this.base}/lifecycle/${id}`, { status: 'CANCELLED' });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  completeTask(instanceId: number, taskId: number, dto: { notes?: string } = {}): Observable<WorkflowTask> {
    return this.http.post<WorkflowTask>(
      `${this.base}/lifecycle/${instanceId}/tasks/${taskId}/complete`, dto
    );
  }

  updateTask(instanceId: number, taskId: number, dto: Partial<WorkflowTask>): Observable<WorkflowTask> {
    return this.http.patch<WorkflowTask>(
      `${this.base}/lifecycle/${instanceId}/tasks/${taskId}`, dto
    );
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  listNotifications(): Observable<HrNotification[]> {
    return this.http.get<HrNotification[]>(`${this.base}/notifications`);
  }

  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/notifications/unread-count`);
  }

  markRead(id: number): Observable<HrNotification> {
    return this.http.patch<HrNotification>(`${this.base}/notifications/${id}/read`, null);
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/read-all`, null);
  }
}
