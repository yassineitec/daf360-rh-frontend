import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, FormFieldComponent, FormFieldOptions } from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../../shared/modal.component';
import { KanbanCandidate } from '../services/pipeline.service';

/**
 * The candidate refused the offer — captures the reason. Owns the textarea and
 * the "reason is required" rule; the page owns the request and the error.
 */
@Component({
  selector: 'rh-refuse-offer-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent, FormFieldComponent, TranslatePipe],
  template: `
    <app-modal
      [title]="'PIPELINE.OFFER.REFUSE_TITLE' | translate"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()">

      @if (candidate(); as target) {
        <p class="text-[13px] font-semibold text-on-surface mb-3">{{ target.fullName }}</p>
      }

      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-on-surface">
          {{ 'PIPELINE.OFFER.REJECTION_REASON' | translate }} <span class="text-danger">*</span>
        </label>
        <daf-form-field [value]="reason()" [options]="reasonOpts()"
                        (valueChange)="reason.set($any($event) ?? '')" />
      </div>

      @if (error()) {
        <p class="text-xs text-danger mt-3">{{ error() }}</p>
      }

      <div slot="footer">
        <daf-button
          [options]="{ variant: 'secondary', label: ('PIPELINE.OFFER.CANCEL' | translate) }"
          (onClick)="closed.emit()" />
        <daf-button
          [options]="{
            variant: 'danger',
            label: submitting() ? ('PIPELINE.OFFER.REFUSING' | translate) : ('PIPELINE.OFFER.CONFIRM_REFUSE' | translate),
            iconStart: 'cancel',
            disabled: submitting() || !reason().trim(),
            loading: submitting()
          }"
          (onClick)="submit.emit(reason().trim())" />
      </div>
    </app-modal>
  `,
})
export class RefuseOfferModalComponent {
  private translate = inject(TranslateService);

  readonly visible    = input(false);
  readonly candidate  = input<KanbanCandidate | null>(null);
  readonly submitting = input(false);
  readonly error      = input<string | null>(null);

  readonly closed = output<void>();
  readonly submit = output<string>();

  protected readonly reason = signal('');

  constructor() {
    // Clear the reason each time the modal opens, so it can't carry over.
    effect(() => {
      this.visible();
      this.reason.set('');
    });
  }

  protected readonly reasonOpts = computed<FormFieldOptions>(() => {
    this.translate.currentLang();
    return {
      type: 'textarea',
      placeholder: this.translate.instant('PIPELINE.OFFER.REASON_PLACEHOLDER'),
      rows: 3,
      fullWidth: true,
    };
  });
}
