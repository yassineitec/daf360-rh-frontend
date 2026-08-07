import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { RefDataItem, CreateRefDataRequest, TimezoneOption, PaysTimezone } from './ref-data.model';

@Injectable({ providedIn: 'root' })
export class RefDataService {
  private http = inject(HttpClient);
  private base = environment.hrApiUrl + '/api/hr/ref';
  private cache = new Map<string, Observable<RefDataItem[]>>();
  /** Separate from `cache`, which is typed to RefDataItem[]. */
  private timezones$?: Observable<TimezoneOption[]>;

  getGrades(paysId?: number): Observable<RefDataItem[]> {
    const key = paysId ? `grades_${paysId}` : 'grades_all';
    const url = paysId ? `${this.base}/grades?paysId=${paysId}` : `${this.base}/grades`;
    return this.cached(key, this.http.get<RefDataItem[]>(url).pipe(catchError(() => of([]))));
  }

  getDisciplines(paysId?: number): Observable<RefDataItem[]> {
    const key = paysId ? `disciplines_${paysId}` : 'disciplines_all';
    const url = paysId ? `${this.base}/disciplines?paysId=${paysId}` : `${this.base}/disciplines`;
    return this.cached(key, this.http.get<RefDataItem[]>(url).pipe(catchError(() => of([]))));
  }

  getNogLevels(paysId?: number): Observable<RefDataItem[]> {
    const key = paysId ? `nog_${paysId}` : 'nog_all';
    const url = paysId ? `${this.base}/nog-levels?paysId=${paysId}` : `${this.base}/nog-levels`;
    return this.cached(key, this.http.get<RefDataItem[]>(url).pipe(catchError(() => of([]))));
  }

  getDepartments(paysId?: number): Observable<RefDataItem[]> {
    const key = paysId ? `depts_${paysId}` : 'depts_all';
    const url = paysId ? `${this.base}/departments?paysId=${paysId}` : `${this.base}/departments`;
    return this.cached(key, this.http.get<RefDataItem[]>(url).pipe(catchError(() => of([]))));
  }

  getBanks(paysId?: number): Observable<RefDataItem[]> {
    const key = paysId ? `banks_${paysId}` : 'banks_all';
    const url = paysId ? `${this.base}/banks?paysId=${paysId}` : `${this.base}/banks`;
    return this.cached(key, this.http.get<RefDataItem[]>(url).pipe(catchError(() => of([]))));
  }

  getNationalities(): Observable<RefDataItem[]> {
    return this.cached('nationalities',
      this.http.get<RefDataItem[]>(`${this.base}/nationalities`).pipe(catchError(() => of([]))));
  }

  create(type: string, req: CreateRefDataRequest): Observable<RefDataItem> {
    this.invalidate(type, req.paysId);
    return this.http.post<RefDataItem>(`${this.base}/${type}`, req);
  }

  delete(type: string, id: number, paysId?: number): Observable<void> {
    this.invalidate(type, paysId);
    return this.http.delete<void>(`${this.base}/${type}/${id}`);
  }

  getItAssetTypes(): Observable<RefDataItem[]> {
    return this.cached('it_asset_types',
      this.http.get<RefDataItem[]>(`${this.base}/it-asset-types`).pipe(catchError(() => of([]))));
  }

  // ── Entity timezones ───────────────────────────────────────────────────────
  //
  // Not a cosmetic setting: everything in the pointage module compares wall-clock times
  // ("08:00", "12:30") that only mean something in a zone, so an entity without one has no
  // presence automation at all.

  /** The full IANA catalogue with current offsets. Cached — it is ~450 entries. */
  getTimezones(): Observable<TimezoneOption[]> {
    if (!this.timezones$) {
      this.timezones$ = this.http.get<TimezoneOption[]>(`${this.base}/timezones`).pipe(
        catchError(() => of([])),
        shareReplay(1),
      );
    }
    return this.timezones$;
  }

  /** Entities with their configured zone. Not cached: the admin panel edits it. */
  getPaysTimezones(): Observable<PaysTimezone[]> {
    return this.http.get<PaysTimezone[]>(`${this.base}/pays`).pipe(catchError(() => of([])));
  }

  /** Sets an entity's zone; a null/empty value clears it (disabling its automation). */
  setPaysTimezone(paysId: number, timezone: string | null): Observable<void> {
    return this.http.put<void>(`${this.base}/pays/${paysId}/timezone`, { timezone });
  }

  /**
   * Sets (or clears, with null) the grade's DEFAULT préavis — V64.
   *
   * This moves only the figure a future negotiation starts from. Contracts already signed
   * carry their own agreed value and are untouched.
   */
  setGradeNoticePeriod(gradeId: number, noticePeriodDays: number | null): Observable<RefDataItem> {
    this.invalidateAll();
    return this.http.put<RefDataItem>(
      `${this.base}/grades/${gradeId}/notice-period`, { noticePeriodDays });
  }

  invalidateAll(): void { this.cache.clear(); this.timezones$ = undefined; }

  private cached(key: string, obs: Observable<RefDataItem[]>): Observable<RefDataItem[]> {
    if (!this.cache.has(key)) this.cache.set(key, obs.pipe(shareReplay(1)));
    return this.cache.get(key)!;
  }

  private invalidate(type: string, paysId?: number): void {
    const key = paysId ? `${type.replace('-','_').replace('-','_')}_${paysId}` : type;
    this.cache.delete(key);
  }
}
