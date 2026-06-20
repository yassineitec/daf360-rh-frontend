import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HrNotification {
  id:        number;
  type:      string;
  message:   string;
  isRead:    boolean;
  createdAt: string;
  profileId: number | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  private base = `${environment.hrApiUrl}/api/hr/notifications`;

  getAll(): Observable<HrNotification[]> {
    return this.http.get<HrNotification[]>(this.base);
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/unread-count`);
  }

  markAsRead(id: number): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/read`, null);
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/read-all`, null);
  }
}
