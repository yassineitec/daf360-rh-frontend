import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  RoleListItem,
  RoleUserItem,
  PermissionGroup,
  CreateRoleRequest,
  UpdateRoleRequest,
} from './role.model';

@Injectable({ providedIn: 'root' })
export class RoleManagementService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/admin`;

  private catalogCache: PermissionGroup[] | null = null;

  getRoles(): Observable<RoleListItem[]> {
    return this.http.get<RoleListItem[]>(`${this.base}/roles`);
  }

  updateAllPermissions(roleId: number, codes: string[]): Observable<void> {
    return this.http.patch<void>(
      `${this.base}/roles/${roleId}/permissions`,
      { permissions: codes },
    );
  }

  createRole(dto: CreateRoleRequest): Observable<RoleListItem> {
    return this.http.post<RoleListItem>(`${this.base}/roles`, dto);
  }

  updateRole(id: number, dto: UpdateRoleRequest): Observable<RoleListItem> {
    return this.http.patch<RoleListItem>(`${this.base}/roles/${id}`, dto);
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/roles/${id}`);
  }

  addPermission(roleId: number, code: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/roles/${roleId}/permissions/${encodeURIComponent(code)}`,
      null,
    );
  }

  removePermission(roleId: number, code: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/roles/${roleId}/permissions/${encodeURIComponent(code)}`,
    );
  }

  // ── User management ──────────────────────────────────────────────────────

  getRoleUsers(roleId: number): Observable<RoleUserItem[]> {
    return this.http.get<RoleUserItem[]>(`${this.base}/roles/${roleId}/users`);
  }

  searchUsersForRole(roleId: number, q: string): Observable<RoleUserItem[]> {
    return this.http.get<RoleUserItem[]>(
      `${this.base}/roles/${roleId}/users/search`, { params: { q } }
    );
  }

  assignUserToRole(roleId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/roles/${roleId}/users/${userId}`, null);
  }

  removeUserFromRole(roleId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/roles/${roleId}/users/${userId}`);
  }

  getPermissionCatalog(): Observable<PermissionGroup[]> {
    if (this.catalogCache) {
      return of(this.catalogCache);
    }
    return this.http
      .get<PermissionGroup[]>(`${this.base}/permissions/catalog`)
      .pipe(tap(data => (this.catalogCache = data)));
  }
}
