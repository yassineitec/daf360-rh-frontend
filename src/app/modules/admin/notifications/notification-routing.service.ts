import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  NotificationEventTypeWithRule,
  RoutingRuleDetail,
  UpdateRoutingRuleRequest,
  PermissionOption,
  RecipientDraft,
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

  /**
   * Creates the (global) routing rule for an event type that has none yet.
   * Returns the same detail payload getRoutingRule does, so the editor opens straight into it.
   */
  createRoutingRule(eventTypeId: number): Observable<RoutingRuleDetail> {
    return this.http.post<RoutingRuleDetail>(
      `${this.base}/notification-rules/event-type/${eventTypeId}`, {},
    );
  }

  /** Sets (or clears, with null) the deep-link kind an event points at. */
  setDefaultEntityType(eventTypeId: number, defaultEntityType: string | null): Observable<void> {
    return this.http.patch<void>(
      `${this.base}/notification-event-types/${eventTypeId}/entity-type`,
      { defaultEntityType },
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

  addInappRecipient(ruleId: number, draft: RecipientDraft): Observable<RecipientItem> {
    return this.http.post<RecipientItem>(
      `${this.base}/notification-rules/${ruleId}/inapp-recipients`,
      draft
    );
  }

  removeInappRecipient(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/notification-rules/inapp-recipients/${id}`
    );
  }

  addEmailRecipient(ruleId: number, field: string, draft: RecipientDraft): Observable<RecipientItem> {
    return this.http.post<RecipientItem>(
      `${this.base}/notification-rules/${ruleId}/email-recipients`,
      { ...draft, field }
    );
  }

  /** Permission codes selectable for a PERMISSION recipient. */
  getAssignablePermissions(): Observable<PermissionOption[]> {
    return this.http.get<PermissionOption[]>(`${this.base}/notification-permissions`);
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
