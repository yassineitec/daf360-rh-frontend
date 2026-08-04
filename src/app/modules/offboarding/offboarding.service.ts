import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CompleteTaskRequest, CreateAssetReturnRequest, CreateChecklistItemRequest, ExitInterview,
  ExitInterviewRequest, HrNotification, HrValidationRequest, ManagerValidationRequest,
  OffboardingAssetReturn, OffboardingAuditEntry, OffboardingChecklistItem, OffboardingFilter,
  OffboardingSettlement, OffboardingTask, OffboardingWorkflowInstance,
  SaveSettlementLineRequest, ScheduleExitInterviewRequest, StartOffboardingRequest,
  UpdateChecklistItemRequest, UpdateDeclarationRequest, UpdateHandoverRequest,
  UpdateItSecurityRequest, UpdateSettlementRequest,
} from './models/offboarding.model';

@Injectable({ providedIn: 'root' })
export class OffboardingService {
  private http      = inject(HttpClient);
  private base      = `${environment.hrApiUrl}/api/hr/offboarding`;
  private notifBase = `${environment.hrApiUrl}/api/hr/notifications`;
  private profileBase = `${environment.hrApiUrl}/api/hr/profiles`;

  /**
   * Uploads the resignation letter through the employee's OWN document set, with the
   * existing `RESIGNATION` document type, rather than through a new offboarding upload
   * endpoint. The letter belongs in the employee's file either way, and this reuses the
   * storage, the size/type validation and the verification workflow already there.
   *
   * Caveat: that endpoint is guarded by HR_CREATE_PROFILE | HR_UPDATE_PROFILE |
   * HR_ADMIN_ROLES, which is a different set from RH_MANAGE_OFFBOARDING. A user who can
   * fill the declaration but holds none of those gets a 403 here — so the caller treats
   * the upload as independently failable and still saves the rest of the declaration.
   */
  uploadJustification(profileId: number, file: File): Observable<{ fileUrl: string; fileName: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('documentType', 'RESIGNATION');
    return this.http.post<{ fileUrl: string; fileName: string }>(
      `${this.profileBase}/${profileId}/documents`, form,
    );
  }

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

  /** Stage 1 — fills in the declaration. Returns the whole updated instance. */
  updateDeclaration(id: number, dto: UpdateDeclarationRequest): Observable<OffboardingWorkflowInstance> {
    return this.http.patch<OffboardingWorkflowInstance>(`${this.base}/${id}/declaration`, dto);
  }

  // ── Stage 5 — Kit RH ───────────────────────────────────────────────────────
  /** Books or re-books the interview, without recording an outcome. */
  scheduleExitInterview(id: number, dto: ScheduleExitInterviewRequest): Observable<ExitInterview> {
    return this.http.post<ExitInterview>(`${this.base}/${id}/exit-interview/schedule`, dto);
  }

  /** Generates one Kit RH document and ticks its checklist line. */
  generateKitDocument(id: number, itemCode: string): Observable<OffboardingChecklistItem> {
    return this.http.post<OffboardingChecklistItem>(
      `${this.base}/${id}/documents/kit/${itemCode}`, {});
  }

  downloadKitArchive(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/documents/kit`, { responseType: 'blob' });
  }

  // ── Stage 6 — Solde de tout compte ─────────────────────────────────────────
  updateSettlement(id: number, dto: UpdateSettlementRequest): Observable<OffboardingWorkflowInstance> {
    return this.http.patch<OffboardingWorkflowInstance>(`${this.base}/${id}/settlement`, dto);
  }

  /** Seeds the breakdown: prorata 13ᵉ mois computed, the other two blank to fill in. */
  suggestSettlement(id: number): Observable<OffboardingSettlement> {
    return this.http.post<OffboardingSettlement>(`${this.base}/${id}/settlement/suggest`, {});
  }

  addSettlementLine(id: number, dto: SaveSettlementLineRequest): Observable<OffboardingSettlement> {
    return this.http.post<OffboardingSettlement>(`${this.base}/${id}/settlement/lines`, dto);
  }

  updateSettlementLine(lineId: number, dto: SaveSettlementLineRequest): Observable<OffboardingSettlement> {
    return this.http.patch<OffboardingSettlement>(`${this.base}/settlement/lines/${lineId}`, dto);
  }

  deleteSettlementLine(lineId: number): Observable<OffboardingSettlement> {
    return this.http.delete<OffboardingSettlement>(`${this.base}/settlement/lines/${lineId}`);
  }

  // ── Stage 7 — Reopen / Archive / Audit ─────────────────────────────────────
  reopenOffboarding(id: number, reason: string): Observable<OffboardingWorkflowInstance> {
    return this.http.post<OffboardingWorkflowInstance>(`${this.base}/${id}/reopen`, { reason });
  }

  archiveOffboarding(id: number): Observable<OffboardingWorkflowInstance> {
    return this.http.post<OffboardingWorkflowInstance>(`${this.base}/${id}/archive`, {});
  }

  /** The real trail, gathered across the six entity types a file touches. */
  getAuditTrail(id: number): Observable<OffboardingAuditEntry[]> {
    return this.http.get<OffboardingAuditEntry[]>(`${this.base}/${id}/audit`);
  }

  downloadAuditCsv(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/audit.csv`, { responseType: 'blob' });
  }

  // ── Stage 4 — Informatique & Matériel ──────────────────────────────────────
  updateItSecurity(id: number, dto: UpdateItSecurityRequest): Observable<OffboardingWorkflowInstance> {
    return this.http.patch<OffboardingWorkflowInstance>(`${this.base}/${id}/it-security`, dto);
  }

  /** Regenerates from the live asset list, so a late return produces a correct décharge. */
  generateDischarge(id: number): Observable<OffboardingWorkflowInstance> {
    return this.http.post<OffboardingWorkflowInstance>(`${this.base}/${id}/documents/discharge`, {});
  }

  // ── Stage 3 — Passation ────────────────────────────────────────────────────
  /** Successor and/or PV de passation. Returns the whole updated instance. */
  updateHandover(id: number, dto: UpdateHandoverRequest): Observable<OffboardingWorkflowInstance> {
    return this.http.patch<OffboardingWorkflowInstance>(`${this.base}/${id}/handover`, dto);
  }

  // ── Checklists (stages 3, 4, 5) ────────────────────────────────────────────
  // Item ids are globally unique, so tick/delete do not need the instance in the path.
  updateChecklistItem(itemId: number, dto: UpdateChecklistItemRequest): Observable<OffboardingChecklistItem> {
    return this.http.patch<OffboardingChecklistItem>(`${this.base}/checklist-items/${itemId}`, dto);
  }

  addChecklistItem(instanceId: number, dto: CreateChecklistItemRequest): Observable<OffboardingChecklistItem> {
    return this.http.post<OffboardingChecklistItem>(`${this.base}/${instanceId}/checklist-items`, dto);
  }

  deleteChecklistItem(itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/checklist-items/${itemId}`);
  }

  // ── Stage 2 — Validation Manager & RH ──────────────────────────────────────
  /** The manager's decision. Refused unless the caller is the file's named manager, or RH. */
  validateAsManager(id: number, dto: ManagerValidationRequest): Observable<OffboardingWorkflowInstance> {
    return this.http.post<OffboardingWorkflowInstance>(`${this.base}/${id}/validation/manager`, dto);
  }

  /** RH's validation and date adjustment. Refused until the manager has stamped. */
  validateAsHr(id: number, dto: HrValidationRequest): Observable<OffboardingWorkflowInstance> {
    return this.http.post<OffboardingWorkflowInstance>(`${this.base}/${id}/validation/hr`, dto);
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
  /** Null when none recorded yet — the endpoint answers 204, not 404. */
  getExitInterview(instanceId: number): Observable<ExitInterview | null> {
    return this.http.get<ExitInterview | null>(`${this.base}/${instanceId}/exit-interview`);
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
