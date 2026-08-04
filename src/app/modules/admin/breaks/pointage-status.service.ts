import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** One row of DAF360_LOG status_definitions, as returned by the log service. */
export interface PointageStatusOption {
  status:   string;
  labelFr:  string;
  labelEn:  string;
  color?:   string;
  icon?:    string;
  active?:  boolean;
}

interface PageResponse<T> { content?: T[] }

/**
 * Read-only view of the pointage status catalogue, used by the break-template form so
 * HR can map each break window to the status it switches employees into.
 *
 * The catalogue lives in DAF360_LOG, which rh-service cannot read, so this goes straight
 * to the log service — the same cross-module pattern as PayrollSimulationService. GET on
 * that endpoint needs no special permission, only a session.
 */
@Injectable({ providedIn: 'root' })
export class PointageStatusService {
  private http = inject(HttpClient);
  private base = environment.logApiUrl + '/log/v1/status/definitions';

  private cached?: Observable<PointageStatusOption[]>;

  /** Active status definitions. Empty on failure — the form degrades to "no mapping". */
  getStatuses(): Observable<PointageStatusOption[]> {
    if (!this.cached) {
      this.cached = this.http
        .get<PageResponse<PointageStatusOption>>(`${this.base}?page=0&size=100`, {
          withCredentials: true,
        })
        .pipe(
          map(page => (page?.content ?? []).filter(s => s.active !== false)),
          catchError(() => of([] as PointageStatusOption[])),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.cached;
  }
}
