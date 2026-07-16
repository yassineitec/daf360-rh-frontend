import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Holiday, HolidayDto, ParameterDto, ParameterSet,
  RegimeDto, RequestTypeCatalog, RequestTypeDto,
  Role, WorkingTimeRegime,
  OffboardingCatalogTask, SaveCatalogTaskRequest,
  DocumentTemplate, SaveDocumentTemplateRequest, VariableDef,
} from './models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base  = `${environment.hrApiUrl}/api/hr/admin`;
  private hrBase = `${environment.hrApiUrl}/api/hr`;

  // ── Roles & Permissions ───────────────────────────────────────────────────
  listRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.base}/roles`);
  }

  getRole(id: number): Observable<Role> {
    return this.http.get<Role>(`${this.base}/roles/${id}`);
  }

  updatePermissions(roleId: number, permissions: string[]): Observable<Role> {
    return this.http.patch<Role>(`${this.base}/roles/${roleId}/permissions`, { permissions });
  }

  getAllowedPermissions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/roles/allowed-permissions`);
  }

  // ── Parameter Sets ────────────────────────────────────────────────────────
  listParameters(paysId: number): Observable<ParameterSet[]> {
    return this.http.get<ParameterSet[]>(`${this.base}/parameters`, { params: { pays: paysId } });
  }

  createParameter(dto: ParameterDto): Observable<ParameterSet> {
    return this.http.post<ParameterSet>(`${this.base}/parameters`, dto);
  }

  updateParameter(id: number, dto: ParameterDto): Observable<ParameterSet> {
    return this.http.patch<ParameterSet>(`${this.base}/parameters/${id}`, dto);
  }

  deleteParameter(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/parameters/${id}`);
  }

  seedParameters(): Observable<void> {
    return this.http.post<void>(`${this.base}/parameters/seed`, null);
  }

  // ── Holidays ──────────────────────────────────────────────────────────────
  listHolidays(paysId: number, year?: number): Observable<Holiday[]> {
    let params = new HttpParams().set('pays', paysId);
    if (year) params = params.set('year', year);
    return this.http.get<Holiday[]>(`${this.base}/holidays`, { params });
  }

  createHoliday(dto: HolidayDto): Observable<Holiday> {
    return this.http.post<Holiday>(`${this.base}/holidays`, dto);
  }

  updateHoliday(id: number, dto: HolidayDto): Observable<Holiday> {
    return this.http.patch<Holiday>(`${this.base}/holidays/${id}`, dto);
  }

  deleteHoliday(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/holidays/${id}`);
  }

  // ── Request type catalog ──────────────────────────────────────────────────
  listRequestTypes(paysId: number): Observable<RequestTypeCatalog[]> {
    return this.http.get<RequestTypeCatalog[]>(`${this.hrBase}/request-types`, { params: { paysId } });
  }

  createRequestType(dto: RequestTypeDto): Observable<RequestTypeCatalog> {
    return this.http.post<RequestTypeCatalog>(`${this.hrBase}/request-types`, dto);
  }

  updateRequestType(id: number, dto: RequestTypeDto): Observable<RequestTypeCatalog> {
    return this.http.patch<RequestTypeCatalog>(`${this.hrBase}/request-types/${id}`, dto);
  }

  deactivateRequestType(id: number): Observable<void> {
    return this.http.delete<void>(`${this.hrBase}/request-types/${id}`);
  }

  seedRequestTypes(): Observable<void> {
    return this.http.post<void>(`${this.hrBase}/request-types/seed`, null);
  }

  // ── Working time regimes ──────────────────────────────────────────────────
  listRegimes(paysId: number): Observable<WorkingTimeRegime[]> {
    return this.http.get<WorkingTimeRegime[]>(`${this.hrBase}/regimes`, { params: { paysId } });
  }

  createRegime(dto: RegimeDto): Observable<WorkingTimeRegime> {
    return this.http.post<WorkingTimeRegime>(`${this.hrBase}/regimes`, dto);
  }

  updateRegime(id: number, dto: RegimeDto): Observable<WorkingTimeRegime> {
    return this.http.patch<WorkingTimeRegime>(`${this.hrBase}/regimes/${id}`, dto);
  }

  deactivateRegime(id: number): Observable<void> {
    return this.http.delete<void>(`${this.hrBase}/regimes/${id}`);
  }

  // ── Document templates ────────────────────────────────────────────────────
  getTemplateVariables(): Observable<VariableDef[]> {
    return this.http.get<VariableDef[]>(`${this.base}/document-templates/variables`);
  }

  listTemplates(paysId: number, category?: string, includeInactive = false): Observable<DocumentTemplate[]> {
    let params = new HttpParams().set('paysId', paysId).set('includeInactive', includeInactive);
    if (category) params = params.set('category', category);
    return this.http.get<DocumentTemplate[]>(`${this.base}/document-templates`, { params });
  }

  createTemplate(dto: SaveDocumentTemplateRequest): Observable<DocumentTemplate> {
    return this.http.post<DocumentTemplate>(`${this.base}/document-templates`, dto);
  }

  updateTemplate(id: number, dto: SaveDocumentTemplateRequest): Observable<DocumentTemplate> {
    return this.http.put<DocumentTemplate>(`${this.base}/document-templates/${id}`, dto);
  }

  toggleTemplateActive(id: number): Observable<DocumentTemplate> {
    return this.http.patch<DocumentTemplate>(`${this.base}/document-templates/${id}/toggle-active`, null);
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/document-templates/${id}`);
  }

  renderTemplate(id: number, employeeProfileId?: number): Observable<Blob> {
    return this.http.post(
      `${this.base}/document-templates/${id}/render`,
      { employeeProfileId: employeeProfileId ?? null },
      { responseType: 'blob' }
    );
  }

  previewRawTemplate(html: string, paysId: number, employeeProfileId?: number): Observable<Blob> {
    return this.http.post(
      `${this.base}/document-templates/preview-raw`,
      { htmlContent: html, paysId, employeeProfileId: employeeProfileId ?? null },
      { responseType: 'blob' }
    );
  }

  // ── Offboarding task catalog ──────────────────────────────────────────────
  listCatalogTasks(paysId: number, contractType?: string): Observable<OffboardingCatalogTask[]> {
    let params = new HttpParams().set('paysId', paysId);
    if (contractType) params = params.set('contractType', contractType);
    return this.http.get<OffboardingCatalogTask[]>(`${this.base}/offboarding-catalog`, { params });
  }

  createCatalogTask(dto: SaveCatalogTaskRequest): Observable<OffboardingCatalogTask> {
    return this.http.post<OffboardingCatalogTask>(`${this.base}/offboarding-catalog`, dto);
  }

  updateCatalogTask(id: number, dto: SaveCatalogTaskRequest): Observable<OffboardingCatalogTask> {
    return this.http.put<OffboardingCatalogTask>(`${this.base}/offboarding-catalog/${id}`, dto);
  }

  toggleCatalogTaskActive(id: number): Observable<OffboardingCatalogTask> {
    return this.http.patch<OffboardingCatalogTask>(
      `${this.base}/offboarding-catalog/${id}/toggle-active`, null);
  }

  deleteCatalogTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/offboarding-catalog/${id}`);
  }
}
