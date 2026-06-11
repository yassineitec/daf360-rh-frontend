import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateListValueRequest, ListType, ListValue, UpdateListValueRequest,
} from './configurable-list.model';

@Injectable({ providedIn: 'root' })
export class ConfigurableListService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/lists`;

  // ── In-memory cache (TTL = 10 min) ────────────────────────────────────────
  private cache   = new Map<string, ListValue[]>();
  private cacheTs = new Map<string, number>();
  private readonly TTL_MS = 600_000;

  private currentMs(): number {
    const d = new Date();
    return +d;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getListTypes(): Observable<ListType[]> {
    return this.http.get<ListType[]>(`${this.base}/types`);
  }

  getListValues(listTypeCode: string, paysId?: number | null): Observable<ListValue[]> {
    const key = `${listTypeCode}_${paysId ?? 'all'}`;
    const ts  = this.cacheTs.get(key);

    if (ts !== undefined && this.currentMs() - ts < this.TTL_MS) {
      const cached = this.cache.get(key);
      if (cached) return of(cached);
    }

    let params = new HttpParams();
    if (paysId) params = params.set('pays', paysId);

    return this.http
      .get<ListValue[]>(`${this.base}/${listTypeCode}`, { params })
      .pipe(tap(values => {
        this.cache.set(key, values);
        this.cacheTs.set(key, this.currentMs());
      }));
  }

  getAllValuesForAdmin(listTypeId: number): Observable<ListValue[]> {
    return this.http.get<ListValue[]>(`${this.base}/${listTypeId}/values/all`);
  }

  createValue(dto: CreateListValueRequest): Observable<ListValue> {
    return this.http.post<ListValue>(`${this.base}/values`, dto).pipe(
      tap(() => this.clearAll())
    );
  }

  updateValue(id: number, dto: UpdateListValueRequest): Observable<ListValue> {
    return this.http.patch<ListValue>(`${this.base}/values/${id}`, dto).pipe(
      tap(() => this.clearAll())
    );
  }

  deleteValue(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/values/${id}`).pipe(
      tap(() => this.clearAll())
    );
  }

  reorder(listTypeId: number, orderedIds: number[]): Observable<void> {
    return this.http.patch<void>(`${this.base}/${listTypeId}/reorder`, { orderedIds }).pipe(
      tap(() => this.clearAll())
    );
  }

  invalidateCache(listTypeCode: string): void {
    [...this.cache.keys()]
      .filter(k => k.startsWith(listTypeCode))
      .forEach(k => { this.cache.delete(k); this.cacheTs.delete(k); });
  }

  clearAll(): void {
    this.cache.clear();
    this.cacheTs.clear();
  }
}
