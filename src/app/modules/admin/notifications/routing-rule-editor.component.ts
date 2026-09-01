import {
  Component, effect, inject, input, signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent, CardComponent, FormFieldComponent, SelectComponent, ToggleComponent,
  type SelectOption,
} from '@khalilrebhiitec/daf360';
import { NotificationRoutingService } from './notification-routing.service';
import { UserStore } from '../../../core/user.store';
import {
  ENTITY_TYPES,
  NotificationEventTypeWithRule,
  PermissionOption,
  RecipientDraft,
  RoutingRuleDetail,
  TestDispatchResult,
  TEMPLATE_PLACEHOLDERS,
} from './notification-routing.model';
import { RecipientTagsComponent } from './recipient-tags.component';
import { TestDispatchModalComponent } from './test-dispatch-modal.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
    CardComponent,
    SelectComponent,
    TranslatePipe,
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
  private readonly translate = inject(TranslateService);

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
    this.svc.getAssignablePermissions().subscribe({
      next: (perms) => this.availablePerms.set(perms),
      // A failed catalogue must not break the editor: role-based recipients still work,
      // the permission picker is simply empty.
      error: () => this.availablePerms.set([]),
    });

    effect(() => {
      const type = this.eventType();
      this.entityType.set(type?.defaultEntityType ?? null);
      if (type?.ruleId != null) {
        // ruleId is the guard (null = no rule yet); pass event TYPE id to the backend
        this.needsRule.set(false);
        this.loadDetail(type.id);
      } else {
        // No rule: offer to create one instead of rendering an empty, unusable editor.
        this.detail.set(null);
        this.needsRule.set(true);
      }
    });
  }

  // ── Create rule / entity type ────────────────────────────────────────────

  /** True when this event has no routing rule yet — nothing is configurable until it does. */
  readonly needsRule = signal(false);
  readonly creating  = signal(false);

  /** Deep-link kind, edited independently of the rule (it lives on the event type). */
  readonly entityType = signal<string | null>(null);
  readonly savingEntityType = signal(false);
  readonly ENTITY_TYPES = ENTITY_TYPES;

  /**
   * Permission codes for the PERMISSION recipient picker. Loaded once per editor: it is a
   * static catalogue, not per-rule data.
   */
  readonly availablePerms = signal<PermissionOption[]>([]);

  /** Select options: an explicit "none" entry, since clearing the kind is a real choice. */
  readonly entityTypeOptions: SelectOption[] = [
    { value: '', label: 'Aucun (non cliquable)' },
    ...ENTITY_TYPES.map(code => ({ value: code, label: code })),
  ];

  /**
   * Creates the missing rule, then drops straight into the editor for it.
   *
   * Without this an event type added to the catalogue was permanently unconfigurable from
   * the UI: the editor shows nothing when ruleId is null, and rules could only be created
   * with hand-written SQL.
   */
  createRule(): void {
    const type = this.eventType();
    if (!type || this.creating()) return;

    this.creating.set(true);
    this.error.set(null);
    this.svc.createRoutingRule(type.id).subscribe({
      next: (d) => {
        this.applyDetail(d);
        this.needsRule.set(false);
        this.creating.set(false);
        this.success.set(this.translate.instant('ADMIN.notifications.ruleCreated'));
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.notifications.ruleCreateError'));
        this.creating.set(false);
      },
    });
  }

  onEntityTypeChange(value: string): void {
    const next = value === '' ? null : value;
    this.entityType.set(next);
    this.savingEntityType.set(true);
    this.svc.setDefaultEntityType(this.eventType().id, next).subscribe({
      next: () => this.savingEntityType.set(false),
      error: (err) => {
        this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.notifications.entityTypeError'));
        this.savingEntityType.set(false);
      },
    });
  }


  /** Single place that pushes a loaded/created rule into the edit signals. */
  private applyDetail(d: RoutingRuleDetail): void {
    this.detail.set(d);
    this.sendInapp.set(d.sendInapp);
    this.sendEmail.set(d.sendEmail);
    this.inappTitle.set(d.inappTitleTemplate ?? '');
    this.inappBody.set(d.inappBodyTemplate ?? '');
    this.emailSubject.set(d.emailSubjectTemplate ?? '');
    this.emailBody.set(d.emailBodyTemplate ?? '');
  }
  // ── Data loading ─────────────────────────────────────────────────────────
  loadDetail(eventTypeId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getRoutingRule(eventTypeId).subscribe({
      next: (d) => {
        this.applyDetail(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.notifications.ruleLoadError'));
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
        this.success.set(this.translate.instant('ADMIN.notifications.saveSuccess'));
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.notifications.saveError'));
      },
    });
  }

  // ── In-app recipients ────────────────────────────────────────────────────
  onInappRecipientAdded(draft: RecipientDraft): void {
    const d = this.detail();
    if (!d) return;
    this.svc.addInappRecipient(d.ruleId, draft).subscribe({
      next: (item) => {
        this.detail.set({ ...d, inappRecipients: [...d.inappRecipients, item] });
      },
      error: (err) => this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.notifications.addInappError')),
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
      error: (err) => this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.notifications.removeInappError')),
    });
  }

  // ── Email recipients ─────────────────────────────────────────────────────
  onEmailRecipientAdded(payload: { draft: RecipientDraft; field: string }): void {
    const d = this.detail();
    if (!d) return;
    this.svc.addEmailRecipient(d.ruleId, payload.field, payload.draft).subscribe({
      next: (item) => {
        const updated = { ...d };
        if (payload.field === 'TO')  updated.emailToRecipients  = [...d.emailToRecipients,  item];
        if (payload.field === 'CC')  updated.emailCcRecipients  = [...d.emailCcRecipients,  item];
        if (payload.field === 'BCC') updated.emailBccRecipients = [...d.emailBccRecipients, item];
        this.detail.set(updated);
      },
      error: (err) => this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.notifications.addEmailError')),
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
      error: (err) => this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.notifications.removeEmailError')),
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
        this.error.set(err?.error?.message ?? this.translate.instant('ADMIN.notifications.testError'));
        this.testLoading.set(false);
      },
    });
  }

  // ── Placeholder insertion ─────────────────────────────────────────────────
  insertPlaceholder(fieldSignal: WritableSignal<string>, placeholder: string): void {
    fieldSignal.set(fieldSignal() + placeholder);
  }
}
