import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditLog } from '../models/audit.model';
import { Page } from '../models/page.model';

export interface AuditActor {
  id: number;
  fullName: string | null;
  email: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private base = `${environment.hrApiUrl}/api/hr/audit`;

  constructor(private http: HttpClient) {}

  logs(page = 0, size = 30): Observable<Page<AuditLog>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<AuditLog>>(`${this.base}/logs`, { params });
  }

  /** Resolves `Users.id`s found inside a diff's own JSON (e.g. `validated_by`) to a name --
   *  a different concept from the row's own `actor` field, which is already a readable string. */
  usersByIds(ids: number[]): Observable<AuditActor[]> {
    const params = new HttpParams().set('ids', ids.join(','));
    return this.http.get<AuditActor[]>(`${this.base}/users`, { params });
  }
}
