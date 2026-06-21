import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { RefDataItem, CreateRefDataRequest } from './ref-data.model';

@Injectable({ providedIn: 'root' })
export class RefDataService {
  private http = inject(HttpClient);
  private base = environment.hrApiUrl + '/api/hr/ref';
  private cache = new Map<string, Observable<RefDataItem[]>>();

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

  invalidateAll(): void { this.cache.clear(); }

  private cached(key: string, obs: Observable<RefDataItem[]>): Observable<RefDataItem[]> {
    if (!this.cache.has(key)) this.cache.set(key, obs.pipe(shareReplay(1)));
    return this.cache.get(key)!;
  }

  private invalidate(type: string, paysId?: number): void {
    const key = paysId ? `${type.replace('-','_').replace('-','_')}_${paysId}` : type;
    this.cache.delete(key);
  }
}
