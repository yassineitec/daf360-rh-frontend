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

  getGrades(paysId: number): Observable<RefDataItem[]> {
    return this.cached(`grades_${paysId}`,
      this.http.get<RefDataItem[]>(`${this.base}/grades?paysId=${paysId}`).pipe(catchError(() => of([]))));
  }

  getDisciplines(paysId: number): Observable<RefDataItem[]> {
    return this.cached(`disciplines_${paysId}`,
      this.http.get<RefDataItem[]>(`${this.base}/disciplines?paysId=${paysId}`).pipe(catchError(() => of([]))));
  }

  getNogLevels(paysId: number): Observable<RefDataItem[]> {
    return this.cached(`nog_${paysId}`,
      this.http.get<RefDataItem[]>(`${this.base}/nog-levels?paysId=${paysId}`).pipe(catchError(() => of([]))));
  }

  getDepartments(paysId: number): Observable<RefDataItem[]> {
    return this.cached(`depts_${paysId}`,
      this.http.get<RefDataItem[]>(`${this.base}/departments?paysId=${paysId}`).pipe(catchError(() => of([]))));
  }

  getBanks(paysId: number): Observable<RefDataItem[]> {
    return this.cached(`banks_${paysId}`,
      this.http.get<RefDataItem[]>(`${this.base}/banks?paysId=${paysId}`).pipe(catchError(() => of([]))));
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
