import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeeListItem, PageResponse } from '../models/profile.model';

export interface EmployeeListParams {
  page:        number;
  size:        number;
  search?:     string;
  department?: string;
  pays?:       string;
  grade?:      string;
  sort?:       string;
}

export interface FilterOptions {
  departments: string[];
  grades:      string[];
  pays:        string[];
}

@Injectable({ providedIn: 'root' })
export class ProfileListService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr`;

  getEmployees(params: EmployeeListParams): Observable<PageResponse<EmployeeListItem>> {
    let p = new HttpParams()
      .set('page', params.page)
      .set('size', params.size);
    if (params.search)     p = p.set('search',     params.search);
    if (params.department) p = p.set('department', params.department);
    if (params.pays)       p = p.set('paysId',     params.pays);
    if (params.grade)      p = p.set('grade',       params.grade);
    if (params.sort)       p = p.set('sort',         params.sort);
    return this.http.get<PageResponse<EmployeeListItem>>(`${this.base}/profiles/employees`, { params: p });
  }

  getFilterOptions(): Observable<FilterOptions> {
    return this.http.get<FilterOptions>(`${this.base}/profiles/filter-options`).pipe(
      catchError(() => of({ departments: [], grades: [], pays: [] })),
    );
  }
}
