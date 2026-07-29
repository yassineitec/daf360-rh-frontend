import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeeListItem, PageResponse } from '../models/profile.model';

export interface EmployeeListParams {
  page:          number;
  size:          number;
  search?:       string;
  /** `pays` is the numeric pays_id, not the label — see FilterOptionsDto. */
  pays?:         string;
  department?:   string;
  grade?:        string;
  status?:       string;
  contract?:     string;
  /** ISO `yyyy-MM-dd`; the backend parses with @DateTimeFormat(ISO.DATE). */
  hireDateFrom?: string;
  hireDateTo?:   string;
  sort?:         string;
}

/**
 * A dropdown entry: `value` is what /employees expects, `label` what we show.
 * Structurally assignable to the lib's `FilterOption`, so these go straight into
 * a `FilterField.options` without mapping — named distinctly to avoid shadowing it.
 */
export interface ProfileFilterOption {
  value: string;
  label: string;
}

export interface FilterOptions {
  departments:   ProfileFilterOption[];
  grades:        ProfileFilterOption[];
  pays:          ProfileFilterOption[];
  /** Raw contract_type codes; translated client-side via PROFILES.CONTRACT_TYPE.*. */
  contractTypes: string[];
}

const EMPTY_OPTIONS: FilterOptions = {
  departments: [], grades: [], pays: [], contractTypes: [],
};

@Injectable({ providedIn: 'root' })
export class ProfileListService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr`;

  getEmployees(params: EmployeeListParams): Observable<PageResponse<EmployeeListItem>> {
    let p = new HttpParams()
      .set('page', params.page)
      .set('size', params.size);
    if (params.search)       p = p.set('search',       params.search);
    if (params.pays)         p = p.set('pays',         params.pays);
    if (params.department)   p = p.set('department',   params.department);
    if (params.grade)        p = p.set('grade',        params.grade);
    if (params.status)       p = p.set('status',       params.status);
    if (params.contract)     p = p.set('contract',     params.contract);
    if (params.hireDateFrom) p = p.set('hireDateFrom', params.hireDateFrom);
    if (params.hireDateTo)   p = p.set('hireDateTo',   params.hireDateTo);
    if (params.sort)         p = p.set('sort',         params.sort);
    return this.http.get<PageResponse<EmployeeListItem>>(
      `${this.base}/profiles/employees`, { params: p });
  }

  getFilterOptions(): Observable<FilterOptions> {
    return this.http.get<FilterOptions>(`${this.base}/profiles/filter-options`).pipe(
      // A dead reference-data call must not take the whole page down — the filter
      // panel just renders with empty dropdowns.
      catchError(() => of(EMPTY_OPTIONS)),
    );
  }
}
