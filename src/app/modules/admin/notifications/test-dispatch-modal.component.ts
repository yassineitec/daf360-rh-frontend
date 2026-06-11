import { Component, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../shared/modal.component';
import { NotificationEventTypeWithRule, TestDispatchResult } from './notification-routing.model';

@Component({
  selector: 'app-test-dispatch-modal',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [title]="'Aperçu — ' + (eventType()?.labelFr ?? '')" [visible]="visible()" (closed)="closed.emit()" [hasFooter]="false">
      @if (result()) {
        <div class="tdm-tabs">
          <button class="tdm-tab" [class.tdm-tab-active]="activeTab()==='inapp'" (click)="activeTab.set('inapp')">Notification in-app</button>
          @if (eventType()?.supportsEmail) {
            <button class="tdm-tab" [class.tdm-tab-active]="activeTab()==='email'" (click)="activeTab.set('email')">Email</button>
          }
        </div>

        @if (activeTab() === 'inapp') {
          <div class="tdm-section">
            <p class="tdm-label">Titre résolu</p>
            <p class="tdm-value">{{ result()!.resolvedTitle }}</p>
            <p class="tdm-label">Message résolu</p>
            <p class="tdm-value">{{ result()!.resolvedBody }}</p>
            <p class="tdm-label">Destinataires ({{ result()!.inappRecipients.length }})</p>
            @for (u of result()!.inappRecipients; track u.userId) {
              <div class="tdm-recipient">{{ u.fullName }} — {{ u.email }}</div>
            }
            @if (result()!.inappRecipients.length === 0) {
              <p class="tdm-empty">Aucun destinataire trouvé pour cette entité.</p>
            }
          </div>
        }

        @if (activeTab() === 'email') {
          <div class="tdm-section">
            <p class="tdm-label">Objet</p>
            <p class="tdm-value">{{ result()!.resolvedSubject }}</p>
            <p class="tdm-label">À ({{ result()!.emailTo.length }})</p>
            @for (e of result()!.emailTo; track e.email) {
              <div class="tdm-recipient">{{ e.email }} ({{ e.roleName }})</div>
            }
            @if (result()!.emailCc.length) {
              <p class="tdm-label">CC ({{ result()!.emailCc.length }})</p>
              @for (e of result()!.emailCc; track e.email) {
                <div class="tdm-recipient">{{ e.email }}</div>
              }
            }
            <p class="tdm-label">Corps de l'email</p>
            <div class="tdm-html-preview" [innerHTML]="result()!.resolvedEmailBody"></div>
          </div>
        }
      } @else {
        <p class="tdm-loading">Chargement du test…</p>
      }
    </app-modal>
  `,
  styles: [`
    .tdm-tabs{display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--color-border);padding-bottom:8px}
    .tdm-tab{background:none;border:none;cursor:pointer;font-size:13px;padding:6px 14px;border-radius:6px;color:var(--color-text-muted)}
    .tdm-tab.tdm-tab-active{background:#1a6b7c;color:#fff;font-weight:600}
    .tdm-section{display:flex;flex-direction:column;gap:6px}
    .tdm-label{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--color-text-muted);margin:8px 0 2px}
    .tdm-value{font-size:13px;color:var(--color-text);background:var(--color-bg);border-radius:6px;padding:8px;margin:0}
    .tdm-recipient{font-size:12px;color:var(--color-text-muted);padding:3px 0}
    .tdm-empty{font-size:12px;color:var(--color-text-muted);font-style:italic}
    .tdm-html-preview{border:1px solid var(--color-border);border-radius:8px;padding:12px;font-size:13px;background:#fafafa;max-height:200px;overflow-y:auto}
    .tdm-loading{font-size:13px;color:var(--color-text-muted);text-align:center;padding:24px}
  `],
})
export class TestDispatchModalComponent {
  visible   = input(false);
  result    = input<TestDispatchResult | null>(null);
  eventType = input<NotificationEventTypeWithRule | null>(null);

  closed = output<void>();

  activeTab = signal<'inapp' | 'email'>('inapp');
}
