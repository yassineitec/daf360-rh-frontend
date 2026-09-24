import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DocumentHistory } from './document-history.model';

/**
 * `/api/hr/profiles/{id}/documents/history` — the profile's "Historique documents" tab.
 *
 * Kept out of `ProfileService` on purpose: that file is shared with other work on the profile
 * page, and this feature needs nothing from it.
 */
@Injectable({ providedIn: 'root' })
export class DocumentHistoryService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/profiles`;

  /**
   * The whole dossier, newest first. Cached server-side per profile (~10 min);
   * `refresh` re-walks SharePoint.
   */
  getHistory(profileId: number, refresh = false): Observable<DocumentHistory> {
    return this.http.get<DocumentHistory>(`${this.base}/${profileId}/documents/history`,
      { params: { refresh } });
  }

  /**
   * One file's bytes. Sends the Graph item id, never a path: the server only serves ids that
   * appear in THIS profile's own listing.
   */
  download(profileId: number, itemId: string): Observable<Blob> {
    return this.http.get(
      `${this.base}/${profileId}/documents/history/${encodeURIComponent(itemId)}/content`,
      { responseType: 'blob' });
  }
}
