import {
  Component, effect, inject, input, signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, FormFieldComponent, ToggleComponent } from '@khalilrebhiitec/daf360';
import { NotificationRoutingService } from './notification-routing.service';
import { UserStore } from '../../../core/user.store';
import {
  NotificationEventTypeWithRule,
  RoutingRuleDetail,
  TestDispatchResult,
  TEMPLATE_PLACEHOLDERS,
} from './notification-routing.model';
import { RecipientTagsComponent } from './recipient-tags.component';
import { TestDispatchModalComponent } from './test-dispatch-modal.component';

@Component({
  selector: 'app-routing-rule-editor',
  standalone: true,
  imports: [
    FormsModule,
    RecipientTagsComponent,
    TestDispatchModalComponent,
    ButtonComponent,
    FormFieldComponent,
    ToggleComponent,
  ],
  templateUrl: './routing-rule-editor.component.html',
  styleUrl: './routing-rule-editor.component.scss',
})
export class RoutingRuleEditorComponent {
  // ── Inputs ──────────────────────────────────────────────────────────────
  readonly eventType = input.required<NotificationEventTypeWithRule>();

  // ── Services ────────────────────────────────────────────────────────────
  private readonly svc = inject(NotificationRoutingService);
  private readonly userStore = inject(UserStore);

  // ── Server state ────────────────────────────────────────────────────────
  readonly detail     = signal<RoutingRuleDetail | null>(null);
  readonly loading    = signal(false);
  readonly saving     = signal(false);
  readonly error      = signal<string | null>(null);
  readonly success    = signal<string | null>(null);

  // ── Test modal ──────────────────────────────────────────────────────────
  readonly showTestModal = signal(false);
  readonly testResult    = signal<TestDispatchResult | null>(null);
  readonly testLoading   = signal(false);

  // ── Local edit signals ──────────────────────────────────────────────────
  readonly sendInapp     = signal(false);
  readonly sendEmail     = signal(false);
  readonly inappTitle    = signal('');
  readonly inappBody     = signal('');
  readonly emailSubject  = signal<string>('');
  readonly emailBody     = signal<string>('');

  // ── Constants ────────────────────────────────────────────────────────────
  readonly PLACEHOLDERS = TEMPLATE_PLACEHOLDERS;

  // ── Effect: reload when eventType changes ───────────────────────────────
  constructor() {
    effect(() => {
      const type = this.eventType();
      if (type?.ruleId != null) {
        // ruleId is the guard (null = no rule yet); pass event TYPE id to the backend
        this.loadDetail(type.id);
      } else {
        this.detail.set(null);
      }
    });
  }

  // ── Data loading ─────────────────────────────────────────────────────────
  loadDetail(eventTypeId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getRoutingRule(eventTypeId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.sendInapp.set(d.sendInapp);
        this.sendEmail.set(d.sendEmail);
        this.inappTitle.set(d.inappTitleTemplate ?? '');
        this.inappBody.set(d.inappBodyTemplate ?? '');
        this.emailSubject.set(d.emailSubjectTemplate ?? '');
        this.emailBody.set(d.emailBodyTemplate ?? '');
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Erreur lors du chargement de la règle.');
        this.loading.set(false);
      },
    });
  }

  // ── Save templates ───────────────────────────────────────────────────────
  saveTemplates(): void {
    const d = this.detail();
    if (!d) return;
    this.saving.set(true);
    this.success.set(null);
    this.error.set(null);
    this.svc.updateRoutingRule(d.ruleId, {
      sendInapp:            this.sendInapp(),
      sendEmail:            this.sendEmail(),
      inappTitleTemplate:   this.inappTitle(),
      inappBodyTemplate:    this.inappBody(),
      emailSubjectTemplate: this.emailSubject() || null,
      emailBodyTemplate:    this.emailBody()    || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set('Modèles enregistrés avec succès.');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
      },
    });
  }

  // ── In-app recipients ────────────────────────────────────────────────────
  onInappRecipientAdded(roleId: number): void {
    const d = this.detail();
    if (!d) return;
    this.svc.addInappRecipient(d.ruleId, roleId).subscribe({
      next: (item) => {
        this.detail.set({ ...d, inappRecipients: [...d.inappRecipients, item] });
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Erreur ajout destinataire in-app.'),
    });
  }

  onInappRecipientRemoved(id: number): void {
    const d = this.detail();
    if (!d) return;
    this.svc.removeInappRecipient(id).subscribe({
      next: () => {
        this.detail.set({
          ...d,
          inappRecipients: d.inappRecipients.filter(r => r.id !== id),
        });
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Erreur suppression destinataire in-app.'),
    });
  }

  // ── Email recipients ─────────────────────────────────────────────────────
  onEmailRecipientAdded(payload: { roleId: number; field: string }): void {
    const d = this.detail();
    if (!d) return;
    this.svc.addEmailRecipient(d.ruleId, payload.roleId, payload.field).subscribe({
      next: (item) => {
        const updated = { ...d };
        if (payload.field === 'TO')  updated.emailToRecipients  = [...d.emailToRecipients,  item];
        if (payload.field === 'CC')  updated.emailCcRecipients  = [...d.emailCcRecipients,  item];
        if (payload.field === 'BCC') updated.emailBccRecipients = [...d.emailBccRecipients, item];
        this.detail.set(updated);
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Erreur ajout destinataire email.'),
    });
  }

  onEmailRecipientRemoved(payload: { id: number; field: string }): void {
    const d = this.detail();
    if (!d) return;
    this.svc.removeEmailRecipient(payload.id).subscribe({
      next: () => {
        const updated = { ...d };
        if (payload.field === 'TO')  updated.emailToRecipients  = d.emailToRecipients.filter(r => r.id !== payload.id);
        if (payload.field === 'CC')  updated.emailCcRecipients  = d.emailCcRecipients.filter(r => r.id !== payload.id);
        if (payload.field === 'BCC') updated.emailBccRecipients = d.emailBccRecipients.filter(r => r.id !== payload.id);
        this.detail.set(updated);
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Erreur suppression destinataire email.'),
    });
  }

  // ── Test dispatch ─────────────────────────────────────────────────────────
  runTest(): void {
    const d = this.detail();
    const user = this.userStore.currentUser();
    if (!d || !user) return;
    this.testLoading.set(true);
    this.svc.testDispatch(d.ruleId, user.paysId).subscribe({
      next: (result) => {
        this.testResult.set(result);
        this.showTestModal.set(true);
        this.testLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Erreur lors du test.');
        this.testLoading.set(false);
      },
    });
  }

  // ── Placeholder insertion ─────────────────────────────────────────────────
  insertPlaceholder(fieldSignal: WritableSignal<string>, placeholder: string): void {
    fieldSignal.set(fieldSignal() + placeholder);
  }
}
