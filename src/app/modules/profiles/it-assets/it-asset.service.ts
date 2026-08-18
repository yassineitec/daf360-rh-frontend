import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateAssetAssignmentRequest,
  ItAssetAssignmentDto,
  ReturnAssetAssignmentRequest,
  UpdateAssetAssignmentRequest,
} from './it-asset.model';

@Injectable({ providedIn: 'root' })
export class ItAssetService {
  private http = inject(HttpClient);
  private base = environment.hrApiUrl + '/api/hr';

  /**
   * Swallows errors into an empty list, like the other profile tabs do: a missing
   * ledger must not blank the whole page. Write calls do NOT — the caller needs the
   * message (a serial already assigned comes back as a 409).
   */
  getHistory(profileId: number): Observable<ItAssetAssignmentDto[]> {
    return this.http.get<ItAssetAssignmentDto[]>(`${this.base}/profiles/${profileId}/it-assets`)
      .pipe(catchError(() => of([])));
  }

  assign(profileId: number, req: CreateAssetAssignmentRequest): Observable<ItAssetAssignmentDto> {
    return this.http.post<ItAssetAssignmentDto>(
      `${this.base}/profiles/${profileId}/it-assets`, req);
  }

  update(id: number, req: UpdateAssetAssignmentRequest): Observable<ItAssetAssignmentDto> {
    return this.http.patch<ItAssetAssignmentDto>(`${this.base}/it-assets/${id}`, req);
  }

  returnAsset(id: number, req: ReturnAssetAssignmentRequest): Observable<ItAssetAssignmentDto> {
    return this.http.post<ItAssetAssignmentDto>(`${this.base}/it-assets/${id}/return`, req);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/it-assets/${id}`);
  }

  /**
   * Pulls anything marked "fourni" on the employee's IT provisioning dossier that is not in
   * the ledger yet. Idempotent — the catch-up for profiles hired before the ledger existed.
   */
  syncFromProvisioning(profileId: number): Observable<ItAssetAssignmentDto[]> {
    return this.http.post<ItAssetAssignmentDto[]>(
      `${this.base}/profiles/${profileId}/it-assets/sync-from-provisioning`, {});
  }
}
