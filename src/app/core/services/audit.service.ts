import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditLog } from '../models/audit.model';
import { Page } from '../models/page.model';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private base = `${environment.hrApiUrl}/audit`;

  constructor(private http: HttpClient) {}

  logs(page = 0, size = 30): Observable<Page<AuditLog>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<AuditLog>>(`${this.base}/logs`, { params });
  }
}
