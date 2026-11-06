import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** A question / answer typed in Admin › Assistant & FAQ. French required, EN / AR optional. */
export interface HelpFaqEntry {
  id: number;
  /** Guide key of the page it is about (`GUIDE_PAGES.guideKey`). */
  pageKey: string;
  questionFr: string;
  answerFr: string;
  questionEn: string | null;
  answerEn: string | null;
  questionAr: string | null;
  answerAr: string | null;
  orderIndex: number;
  /** Published: shown by the assistant and the help page. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface SaveHelpFaqRequest {
  pageKey: string;
  questionFr: string;
  answerFr: string;
  questionEn: string;
  answerEn: string;
  questionAr: string;
  answerAr: string;
  orderIndex: number;
  isActive: boolean;
}

/** `/api/hr/help-faq` — writes need HR_ADMIN_ROLES; `/active` is open to every signed-in user. */
@Injectable({ providedIn: 'root' })
export class HelpFaqService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/help-faq`;

  list(): Observable<HelpFaqEntry[]> {
    return this.http.get<HelpFaqEntry[]>(this.base);
  }

  listActive(): Observable<HelpFaqEntry[]> {
    return this.http.get<HelpFaqEntry[]>(`${this.base}/active`);
  }

  create(req: SaveHelpFaqRequest): Observable<HelpFaqEntry> {
    return this.http.post<HelpFaqEntry>(this.base, req);
  }

  update(id: number, req: SaveHelpFaqRequest): Observable<HelpFaqEntry> {
    return this.http.put<HelpFaqEntry>(`${this.base}/${id}`, req);
  }

  setActive(id: number, active: boolean): Observable<HelpFaqEntry> {
    return this.http.patch<HelpFaqEntry>(`${this.base}/${id}/${active ? 'activate' : 'deactivate'}`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
