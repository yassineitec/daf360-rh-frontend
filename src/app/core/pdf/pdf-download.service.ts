import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface GeneratedDocumentResponse {
  id: number;
  employeeRequestId: number | null;
  documentType: string;
  fileUrl: string;
  verificationCode: string;
  generatedAt: string;
  generatedBy: number | null;
  downloadUrl: string;
}

export class PdfBusinessError extends Error {
  constructor(public readonly serverMessage: string) { super(serverMessage); }
}

export class PdfServiceUnavailableError extends Error {
  constructor() { super('Service PDF indisponible'); }
}

@Injectable({ providedIn: 'root' })
export class PdfDownloadService {
  private http = inject(HttpClient);

  generateDocument(endpoint: string, body: Record<string, unknown> | null): Observable<GeneratedDocumentResponse> {
    const url = environment.hrApiUrl + endpoint;
    const req$ = body != null
      ? this.http.post<GeneratedDocumentResponse>(url, body)
      : this.http.get<GeneratedDocumentResponse>(url);
    return req$.pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 422) return throwError(() => new PdfBusinessError(err.error?.error ?? 'Erreur metier lors de la generation.'));
        if (err.status === 503) return throwError(() => new PdfServiceUnavailableError());
        return throwError(() => err);
      })
    );
  }

  downloadById(documentId: number, filename: string): Observable<void> {
    const url = environment.hrApiUrl + '/api/hr/documents/download/' + documentId;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      map(blob => triggerDownload(blob, filename)),
      catchError(err => throwError(() => err))
    );
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
