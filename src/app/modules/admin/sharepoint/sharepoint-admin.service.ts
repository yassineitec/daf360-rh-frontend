import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/**
 * The SharePoint administration API (rh-service `SharePointAdminController`).
 *
 * Exists so a document path is a form field rather than hand-applied SQL. rh-service has no
 * Flyway, so every path change was previously a manual script per database — appliable on one
 * server and missed on another, silently disabling the feature there with nothing in the UI to
 * show it.
 */

/** Why a location did, or did not, resolve. Mirrors the backend `SharePointStatus`. */
export type SharePointStatus =
  | 'FOUND' | 'NO_CONFIG' | 'FOLDER_MISSING'
  | 'AMBIGUOUS' | 'AMBIGUOUS_EMPLOYEE' | 'NO_NAME' | 'UNAVAILABLE';

export type ResolutionSource = 'DISCOVERED' | 'MANUAL';

export interface DocKindInfo {
  code: string;
  /** Year-scoped kinds require `{year}` in their template and store one folder per year. */
  yearScoped: boolean;
  /**
   * True for a built-in kind (PHOTO, PAYSLIP, SALARY_CERTIFICATE) — those carry behaviour and
   * cannot be created or deactivated here. False for a document type, which is just a row in
   * `document_types` and is fully editable.
   */
  builtIn: boolean;
  /** The enum name for a built-in kind, the configured French label for a document type. */
  label: string;
}

/** One document type as the admin screen sees it — deactivated rows included. */
export interface DocumentTypeRow {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string | null;
  active: boolean;
  sortOrder: number;
}

export interface SharePointLocation {
  id: number;
  paysId: number;
  isoCode: string | null;
  docKind: string | null;
  pathTemplate: string;
  active: boolean;
  /** i18n keys. Non-empty means the resolver treats this row as "not configured". */
  problems: string[];
}

export interface FolderListing {
  path: string;
  folders: string[];
}

export interface EmployeeFolderRow {
  profileId: number;
  userId: number;
  fullName: string;
  paysIso: string | null;
  folderSegment: string | null;
  source: ResolutionSource | null;
  /** null = never looked up, which is different from a resolved failure. */
  status: SharePointStatus | null;
  resolvedAt: string | null;
  lastError: string | null;
}

export interface Diagnosis {
  profileId: number;
  docKind: string;
  status: SharePointStatus;
  path: string | null;
  basePath: string | null;
  employeeFolder: string | null;
  source: ResolutionSource | null;
  detail: string | null;
  graphConfigured: boolean;
  files: string[];
  years: string[];
}

export interface BatchResult {
  docKind: string;
  total: number;
  byStatus: Record<string, number>;
  rows: {
    profileId: number;
    employeeFolder: string | null;
    status: SharePointStatus;
    source: ResolutionSource | null;
    detail: string | null;
  }[];
}

@Injectable({ providedIn: 'root' })
export class SharePointAdminService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/sharepoint`;

  /**
   * Configurable kinds. Pass a country to have its document types included — they are
   * per-country, so without one only the three built-in kinds can be offered.
   */
  kinds(paysId?: number): Observable<DocKindInfo[]> {
    const params = paysId == null ? {} : { params: { paysId } };
    return this.http.get<DocKindInfo[]>(`${this.base}/kinds`, params);
  }

  // ── Document types (V87) ──────────────────────────────────────────────────

  listDocumentTypes(paysId: number): Observable<DocumentTypeRow[]> {
    return this.http.get<DocumentTypeRow[]>(`${this.base}/document-types`, { params: { paysId } });
  }

  /** Creates or updates one type. 422 carries the validation keys. */
  saveDocumentType(body: {
    paysId: number; code: string; labelFr: string;
    labelEn?: string | null; active?: boolean; sortOrder?: number;
  }): Observable<void> {
    return this.http.put<void>(`${this.base}/document-types`, body);
  }

  /**
   * Deactivates a type — there is no delete.
   *
   * Documents already filed store the code with no foreign key behind it, so removing the row
   * would label them with something nothing can resolve.
   */
  deactivateDocumentType(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/document-types/${id}`);
  }

  // ── Paths ─────────────────────────────────────────────────────────────────

  listLocations(): Observable<SharePointLocation[]> {
    return this.http.get<SharePointLocation[]>(`${this.base}/locations`);
  }

  /** 422 carries the validation keys — the caller shows them against the field. */
  saveLocation(paysId: number, docKind: string, pathTemplate: string): Observable<void> {
    return this.http.put<void>(`${this.base}/locations`, { paysId, docKind, pathTemplate });
  }

  deleteLocation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/locations/${id}`);
  }

  /** Immediate subfolders. Omit `path` for the drive root. */
  browse(path: string): Observable<FolderListing> {
    const params = path ? new HttpParams().set('path', path) : undefined;
    return this.http.get<FolderListing>(`${this.base}/folders`, { params });
  }

  // ── Employees ─────────────────────────────────────────────────────────────

  /** Database only — no Graph call, whatever the row count. */
  listEmployees(docKind: string): Observable<EmployeeFolderRow[]> {
    return this.http.get<EmployeeFolderRow[]>(`${this.base}/employees`, {
      params: new HttpParams().set('docKind', docKind),
    });
  }

  /**
   * Resolves every employee. Costs one Graph lookup each and runs sequentially server-side,
   * so it is slow by design — a parallel fan-out earns a 429 and a screenful of failures that
   * say nothing about the folders.
   */
  resolveAll(docKind: string, force = false): Observable<BatchResult> {
    return this.http.post<BatchResult>(`${this.base}/resolve`, null, {
      params: new HttpParams().set('docKind', docKind).set('force', force),
    });
  }

  /** Pins a folder segment. Verified against the tree server-side before it is stored. */
  pinFolder(profileId: number, docKind: string, folderSegment: string): Observable<void> {
    return this.http.put<void>(
      `${this.base}/employees/${profileId}/folder`, { docKind, folderSegment });
  }

  /** Forgets the resolution, override included, so the next lookup starts over. */
  clearFolder(profileId: number, docKind: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/employees/${profileId}/folder`, {
      params: new HttpParams().set('docKind', docKind),
    });
  }

  // ── Diagnosis ─────────────────────────────────────────────────────────────

  diagnose(profileId: number, docKind: string, force = false): Observable<Diagnosis> {
    return this.http.get<Diagnosis>(`${this.base}/diagnose`, {
      params: new HttpParams()
        .set('profileId', profileId)
        .set('docKind', docKind)
        .set('force', force),
    });
  }
}
