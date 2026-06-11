import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HrDocument, DocumentType } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private base = `${environment.hrApiUrl}/documents`;

  constructor(private http: HttpClient) {}

  listForEmployee(employeeId: number): Observable<HrDocument[]> {
    return this.http.get<HrDocument[]>(`${this.base}/employee/${employeeId}`);
  }

  upload(
    employeeId: number,
    documentType: DocumentType,
    file: File,
    confidential = false,
  ): Observable<HrDocument> {
    const form = new FormData();
    form.append('file', file);
    const params = new HttpParams()
      .set('employeeId', employeeId)
      .set('documentType', documentType)
      .set('confidential', confidential);
    return this.http.post<HrDocument>(`${this.base}/upload`, form, { params });
  }
}
