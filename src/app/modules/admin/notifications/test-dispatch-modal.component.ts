import { Component, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../../shared/modal.component';
import { NotificationEventTypeWithRule, TestDispatchResult } from './notification-routing.model';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-test-dispatch-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, TranslatePipe],
  template: `
    <app-modal [title]="'ADMIN.notifications.previewTitle' | translate:{ name: eventType()?.labelFr ?? '' }" [visible]="visible()" (closed)="closed.emit()" [hasFooter]="false">
      @if (result()) {
        <div class="tdm-tabs">
          <daf-button [label]="'ADMIN.notifications.tabInapp' | translate" variant="toggle" [options]="{ active: activeTab()==='inapp' }" (onClick)="activeTab.set('inapp')" />
          @if (eventType()?.supportsEmail) {
            <daf-button [label]="'ADMIN.notifications.tabEmail' | translate" variant="toggle" [options]="{ active: activeTab()==='email' }" (onClick)="activeTab.set('email')" />
          }
        </div>

        @if (activeTab() === 'inapp') {
          <div class="tdm-section">
            <p class="tdm-label">{{ 'ADMIN.notifications.resolvedTitle' | translate }}</p>
            <p class="tdm-value">{{ result()!.resolvedTitle }}</p>
            <p class="tdm-label">{{ 'ADMIN.notifications.resolvedMessage' | translate }}</p>
            <p class="tdm-value">{{ result()!.resolvedBody }}</p>
            <p class="tdm-label">{{ 'ADMIN.notifications.recipientsCount' | translate:{ count: result()!.inappRecipients.length } }}</p>
            @for (u of result()!.inappRecipients; track u.userId) {
              <div class="tdm-recipient">{{ u.fullName }} — {{ u.email }}</div>
            }
            @if (result()!.inappRecipients.length === 0) {
              <p class="tdm-empty">{{ 'ADMIN.notifications.noRecipient' | translate }}</p>
            }
          </div>
        }

        @if (activeTab() === 'email') {
          <div class="tdm-section">
            <p class="tdm-label">{{ 'ADMIN.notifications.subject' | translate }}</p>
            <p class="tdm-value">{{ result()!.resolvedSubject }}</p>
            <p class="tdm-label">{{ 'ADMIN.notifications.toCount' | translate:{ count: result()!.emailTo.length } }}</p>
            @for (e of result()!.emailTo; track e.email) {
              <div class="tdm-recipient">{{ e.email }} ({{ e.roleName }})</div>
            }
            @if (result()!.emailCc.length) {
              <p class="tdm-label">{{ 'ADMIN.notifications.ccCount' | translate:{ count: result()!.emailCc.length } }}</p>
              @for (e of result()!.emailCc; track e.email) {
                <div class="tdm-recipient">{{ e.email }}</div>
              }
            }
            <p class="tdm-label">{{ 'ADMIN.notifications.emailBodyLabel' | translate }}</p>
            <div class="tdm-html-preview" [innerHTML]="result()!.resolvedEmailBody"></div>
          </div>
        }
      } @else {
        <p class="tdm-loading">{{ 'ADMIN.notifications.loadingTest' | translate }}</p>
      }
    </app-modal>
  `,
  styles: [`
    .tdm-tabs{display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--color-border);padding-bottom:8px}
    .tdm-section{display:flex;flex-direction:column;gap:6px}
    .tdm-label{font-size:var(--text-label-caps);font-weight:700;text-transform:uppercase;color:var(--color-text-muted);margin:8px 0 2px}
    .tdm-value{font-size:var(--text-body-md);color:var(--color-text);background:var(--color-bg);border-radius:6px;padding:8px;margin:0}
    .tdm-recipient{font-size:var(--text-label-sm);color:var(--color-text-muted);padding:3px 0}
    .tdm-empty{font-size:var(--text-label-sm);color:var(--color-text-muted);font-style:italic}
    .tdm-html-preview{border:1px solid var(--color-border);border-radius:8px;padding:12px;font-size:var(--text-body-sm);background:var(--color-surface-container-low);max-height:200px;overflow-y:auto}
    .tdm-loading{font-size:var(--text-body-sm);color:var(--color-text-muted);text-align:center;padding:24px}
  `],
})
export class TestDispatchModalComponent {
  visible   = input(false);
  result    = input<TestDispatchResult | null>(null);
  eventType = input<NotificationEventTypeWithRule | null>(null);

  closed = output<void>();

  activeTab = signal<'inapp' | 'email'>('inapp');
}
