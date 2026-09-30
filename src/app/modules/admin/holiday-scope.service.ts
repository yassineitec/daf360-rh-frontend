import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/** One entity the caller may administer holidays for. */
export interface HolidayPaysOption {
  id: number;
  frenchLabel: string;
  englishLabel: string | null;
  isoCode: string | null;
}

/**
 * The entities whose holidays this caller may read and edit.
 *
 * Server-scoped to the role's country perimeter (V74). The screen's picker is built from this
 * and nothing else, so it can never offer an entity the save would refuse — before, the screen
 * was pinned to the caller's own `paysId` while the list endpoint accepted any `pays` the query
 * string asked for.
 */
@Injectable({ providedIn: 'root' })
export class HolidayScopeService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/admin/holidays`;

  scopedPays(): Observable<HolidayPaysOption[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/pays`).pipe(
      map(rows => (rows ?? []).map(r => ({
        // The endpoint returns raw column names — this is the one place that knows them.
        id:           Number(r['id']),
        frenchLabel:  String(r['french_label'] ?? ''),
        englishLabel: (r['english_label'] as string) ?? null,
        isoCode:      (r['iso_code'] as string) ?? null,
      }))),
      // An empty list is a usable screen (the picker hides, the caller's own entity still
      // loads); a thrown error would take the whole tab down with it.
      catchError(() => of([] as HolidayPaysOption[])),
    );
  }
}
