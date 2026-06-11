import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Employee, EmployeeRequest } from '../models/employee.model';
import { Page, PageParams } from '../models/page.model';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private base = `${environment.hrApiUrl}/employes`;

  constructor(private http: HttpClient) {}

  list(params: PageParams = {}): Observable<Page<Employee>> {
    let p = new HttpParams()
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 20);
    if (params.sort) p = p.set('sort', params.sort);
    return this.http.get<Page<Employee>>(this.base, { params: p });
  }

  get(id: number): Observable<Employee> {
    return this.http.get<Employee>(`${this.base}/${id}`);
  }

  create(dto: EmployeeRequest): Observable<Employee> {
    return this.http.post<Employee>(this.base, dto);
  }

  update(id: number, dto: EmployeeRequest): Observable<Employee> {
    return this.http.put<Employee>(`${this.base}/${id}`, dto);
  }

  disable(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/disable`);
  }
}
