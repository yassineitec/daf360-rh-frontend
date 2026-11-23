import { Component, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, FormFieldComponent, FormFieldOptions, ModalRef, ModalService } from '@khalilrebhiitec/daf360';
import { OfferEmailPreview } from '../pipeline/services/offer.service';

/**
 * « Email à envoyer au candidat » (V134) — the offer email, rendered from the entity's
 * template (« Administration > Modèles d'emails candidats »), shown before it goes.
 *
 * Same behaviour as the finance WIP email preview: RH may edit the subject and the body for
 * this one send — the template itself is unchanged. Mounted once, opened with `.open(...)`;
 * `onConfirm` receives the (possibly edited) text and a `done()` to close or show an error.
 */
@Component({
  selector: 'app-offer-email-modal',
  standalone: true,
  imports: [TranslatePipe, ButtonComponent, FormFieldComponent],
  template: `
    <ng-template #tpl>
      <div class="oem">
        <p class="oem-intro">{{ 'CANDIDATES.OFFER_EMAIL.INTRO' | translate }}</p>

        <div class="oem-to">
          <span class="oem-label">{{ 'CANDIDATES.OFFER_EMAIL.TO' | translate }}</span>
          <span class="oem-to-value">{{ to() || '—' }}</span>
        </div>

        <daf-form-field
          [value]="subject()"
          (valueChange)="subject.set($any($event) ?? '')"
          [options]="subjectOpts()" />

        <daf-form-field
          class="oem-body"
          [value]="body()"
          (valueChange)="body.set($any($event) ?? '')"
          [options]="bodyOpts()" />

        @if (error()) {
          <div class="oem-error">{{ error() }}</div>
        }

        <div class="oem-actions">
          <daf-button
            [label]="'CANDIDATES.OFFER_EMAIL.CANCEL' | translate"
            variant="secondary"
            [options]="{ disabled: sending() }"
            (onClick)="cancel()" />
          <daf-button
            [label]="'CANDIDATES.OFFER_EMAIL.SEND' | translate"
            variant="teal"
            [options]="{ iconStart: 'send', loading: sending(), disabled: sending() || !canSend() }"
            (onClick)="send()" />
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .oem        { display:flex; flex-direction:column; gap:16px; min-height:100%; }
    .oem-intro  { margin:0; font-size:var(--text-body-sm); color:var(--color-on-surface-variant); }
    .oem-to     { display:flex; align-items:baseline; gap:8px; padding:10px 14px; border-radius:12px;
                  background:var(--color-surface-container-low); }
    .oem-label  { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
                  color:var(--color-on-surface-variant); }
    .oem-to-value { font-size:var(--text-body-sm); font-weight:600; color:var(--color-on-surface); }
    .oem-body   { flex:1 1 auto; }
    .oem-error  { padding:8px 12px; border-radius:8px; font-size:var(--text-body-sm); color:var(--color-danger);
                  background:color-mix(in srgb, var(--color-danger) 10%, transparent); }
    .oem-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:auto; padding-top:4px; }
  `],
})
export class OfferEmailModalComponent {
  @ViewChild('tpl', { static: true }) private tpl!: TemplateRef<unknown>;

  private readonly modal     = inject(ModalService);
  private readonly translate = inject(TranslateService);
  private modalRef?: ModalRef;

  readonly to      = signal<string | null>(null);
  readonly subject = signal('');
  readonly body    = signal('');
  readonly sending = signal(false);
  readonly error   = signal<string | null>(null);

  readonly canSend = computed(() => !!this.subject().trim() && !!this.body().trim());

  // Computed, not literals: daf-form-field must see the same object until the language changes.
  readonly subjectOpts = computed<FormFieldOptions>(() => {
    this.translate.currentLang();
    return { label: this.translate.instant('CANDIDATES.OFFER_EMAIL.SUBJECT'), maxLength: 500, fullWidth: true, required: true };
  });
  readonly bodyOpts = computed<FormFieldOptions>(() => {
    this.translate.currentLang();
    return { label: this.translate.instant('CANDIDATES.OFFER_EMAIL.BODY'), type: 'textarea', rows: 14, fullWidth: true, required: true };
  });

  private onConfirm?: (subject: string, body: string, done: (errorMessage?: string) => void) => void;

  open(preview: OfferEmailPreview,
       onConfirm: (subject: string, body: string, done: (errorMessage?: string) => void) => void): void {
    this.to.set(preview.to);
    this.subject.set(preview.subject ?? '');
    this.body.set(preview.body ?? '');
    this.sending.set(false);
    this.error.set(null);
    this.onConfirm = onConfirm;

    this.modalRef = this.modal.open({
      title: this.translate.instant('CANDIDATES.OFFER_EMAIL.TITLE'),
      icon: 'mail',
      body: this.tpl,
      width: 'min(1000px, 80vw)',
      height: '75vh',
      closeOnBackdrop: false,
      minWidth: '360px',
      minHeight: '260px',
      resizable: true,
      maximizable: true,
    });
  }

  send(): void {
    if (this.sending() || !this.onConfirm || !this.canSend()) return;
    this.sending.set(true);
    this.error.set(null);
    this.onConfirm(this.subject().trim(), this.body(), errorMessage => {
      this.sending.set(false);
      if (errorMessage) { this.error.set(errorMessage); return; }
      this.modalRef?.close();
    });
  }

  cancel(): void {
    this.modalRef?.close();
  }
}
