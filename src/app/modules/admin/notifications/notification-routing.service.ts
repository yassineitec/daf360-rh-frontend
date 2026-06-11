import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  NotificationEventTypeWithRule,
  RoutingRuleDetail,
  UpdateRoutingRuleRequest,
  RecipientItem,
  TestDispatchResult,
} from './notification-routing.model';

@Injectable({ providedIn: 'root' })
export class NotificationRoutingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.hrApiUrl}/api/hr/admin`;

  getEventTypes(): Observable<NotificationEventTypeWithRule[]> {
    return this.http.get<NotificationEventTypeWithRule[]>(
      `${this.base}/notification-event-types`
    );
  }

  getRoutingRule(eventTypeId: number): Observable<RoutingRuleDetail> {
    return this.http.get<RoutingRuleDetail>(
      `${this.base}/notification-rules/${eventTypeId}`
    );
  }

  updateRoutingRule(ruleId: number, dto: UpdateRoutingRuleRequest): Observable<void> {
    return this.http.patch<void>(
      `${this.base}/notification-rules/${ruleId}`,
      dto
    );
  }

  addInappRecipient(ruleId: number, roleId: number): Observable<RecipientItem> {
    return this.http.post<RecipientItem>(
      `${this.base}/notification-rules/${ruleId}/inapp-recipients`,
      { roleId }
    );
  }

  removeInappRecipient(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/notification-rules/inapp-recipients/${id}`
    );
  }

  addEmailRecipient(ruleId: number, roleId: number, field: string): Observable<RecipientItem> {
    return this.http.post<RecipientItem>(
      `${this.base}/notification-rules/${ruleId}/email-recipients`,
      { roleId, field }
    );
  }

  removeEmailRecipient(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/notification-rules/email-recipients/${id}`
    );
  }

  testDispatch(ruleId: number, paysId: number): Observable<TestDispatchResult> {
    return this.http.post<TestDispatchResult>(
      `${this.base}/notification-rules/${ruleId}/test?pays=${paysId}`,
      {}
    );
  }
}
