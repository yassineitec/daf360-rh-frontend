import { Component, DestroyRef, input, output, signal, inject, computed, effect, untracked, viewChild, TemplateRef } from '@angular/core';
import { CandidateService } from './candidate.service';
import { FormFieldComponent, FormFieldOptions, ModalButton, ModalRef, ModalService } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

/**
 * Pop-up « Refuser le candidat » — daf modal (ModalService), resizable and maximizable.
 *
 * The inputs/outputs are unchanged, so the three pages that host it (recrutement board,
 * candidate list, candidate detail) still drive it with `visible` / `target`.
 */
@Component({
  selector: 'app-reject-modal',
  standalone: true,
  imports: [FormFieldComponent, TranslatePipe],
  template: `
    <ng-template #bodyTpl>
      @if (candidateName) {
        <p class="text-sm font-semibold text-on-surface mb-4">{{ candidateName }}</p>
      }
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-on-surface">
          {{ 'CANDIDATES.REJECT.REASON_LABEL' | translate }} <span class="text-danger">*</span>
          <span class="font-normal text-outline">{{ 'CANDIDATES.REJECT.MIN_CHARS' | translate }}</span>
        </label>
        <daf-form-field
          [value]="reason()"
          [options]="reasonFieldOptions()"
          (valueChange)="onReasonChange($event)"
        />
        @if (error()) {
          <p class="text-xs text-danger">{{ error() }}</p>
        }
      </div>
    </ng-template>
  `,
})
export class RejectModalComponent {
  visible  = input(false);
  target   = input<{ id: number; firstName: string; lastName: string } | null>(null);
  closed   = output<void>();
  rejected = output<void>();

  private candidateService = inject(CandidateService);
  private translate = inject(TranslateService);
  private modalService = inject(ModalService);

  private bodyTpl = viewChild<TemplateRef<unknown>>('bodyTpl');
  private modalRef: ModalRef | null = null;

  reason  = signal('');
  error   = signal<string | null>(null);
  saving  = signal(false);

  readonly reasonFieldOptions = computed<FormFieldOptions>(() => {
    this.translate.currentLang();
    return {
      type: 'textarea',
      placeholder: this.translate.instant('CANDIDATES.REJECT.PLACEHOLDER'),
      fullWidth: true,
      rows: 4,
    };
  });

  constructor() {
    // The host pages still say "open" / "closed" through `visible`.
    effect(() => {
      const show = this.visible();
      untracked(() => (show ? this.open() : this.modalRef?.close()));
    });
    // The modal lives in <body>: leaving the page must not leave it behind.
    inject(DestroyRef).onDestroy(() => this.modalRef?.close());
  }

  get candidateName(): string {
    const t = this.target();
    return t ? t.firstName + ' ' + t.lastName : '';
  }

  onReasonChange(value: string | number | null): void {
    this.reason.set(typeof value === 'string' ? value : '');
  }

  private open(): void {
    const tpl = this.bodyTpl();
    if (!tpl || this.modalRef) return;

    // Getters, not values: the modal host re-reads them on every check, so the button
    // follows the typed reason and the saving state like the old [options] binding did.
    const self = this;
    const confirm: ModalButton = {
      get label()    { return self.translate.instant(self.saving() ? 'CANDIDATES.REJECT.SUBMITTING' : 'CANDIDATES.REJECT.CONFIRM'); },
      get disabled() { return self.saving() || self.reason().trim().length < 10; },
      variant: 'primary',
      icon:    'cancel',
      action:  () => this.onConfirm(),
    };

    const ref = this.modalService.open({
      title: this.translate.instant('CANDIDATES.REJECT.TITLE'),
      body:  tpl,
      minWidth:    '360px',
      minHeight:   '260px',
      resizable:   true,
      maximizable: true,
      buttons: [
        { label: this.translate.instant('CANDIDATES.COMMON.CANCEL'), variant: 'secondary', action: r => r.close() },
        confirm,
      ],
    });

    // ✕, backdrop and Annuler all end in _destroy(): reset the form there and tell the
    // host page, otherwise its `visible` would stay true on a modal that is gone.
    const destroy = ref._destroy.bind(ref);
    ref._destroy = () => {
      destroy();
      this.modalRef = null;
      this.reason.set('');
      this.error.set(null);
      if (this.visible()) this.closed.emit();
    };
    this.modalRef = ref;
  }

  onConfirm(): void {
    const r = this.reason().trim();
    if (r.length < 10) {
      this.error.set(this.translate.instant('CANDIDATES.REJECT.ERR_MIN'));
      return;
    }
    const t = this.target();
    if (!t) return;
    this.saving.set(true);
    this.candidateService.reject(t.id, r).subscribe({
      next: () => {
        this.saving.set(false);
        this.reason.set('');
        this.rejected.emit();
      },
      error: () => {
        this.saving.set(false);
        this.error.set(this.translate.instant('CANDIDATES.REJECT.ERR'));
      },
    });
  }
}
