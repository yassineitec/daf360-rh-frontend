import { Component, input, output, signal, inject, computed } from '@angular/core';
import { ModalComponent } from '../../shared/modal.component';
import { CandidateService } from './candidate.service';
import { ButtonComponent, FormFieldComponent, FormFieldOptions } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-reject-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, FormFieldComponent, TranslatePipe],
  template: `
    <app-modal
      [title]="'CANDIDATES.REJECT.TITLE' | translate"
      [visible]="visible()"
      (closed)="onClose()"
      [hasFooter]="true"
    >
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
      <div slot="footer">
        <daf-button
          [label]="'CANDIDATES.COMMON.CANCEL' | translate"
          variant="secondary"
          (onClick)="onClose()"
        />
        <daf-button
          [label]="saving() ? ('CANDIDATES.REJECT.SUBMITTING' | translate) : ('CANDIDATES.REJECT.CONFIRM' | translate)"
          variant="danger"
          [options]="{ iconStart: 'cancel', disabled: saving() || reason().trim().length < 10, loading: saving() }"
          (onClick)="onConfirm()"
        />
      </div>
    </app-modal>
  `,
})
export class RejectModalComponent {
  visible  = input(false);
  target   = input<{ id: number; firstName: string; lastName: string } | null>(null);
  closed   = output<void>();
  rejected = output<void>();

  private candidateService = inject(CandidateService);
  private translate = inject(TranslateService);

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

  get candidateName(): string {
    const t = this.target();
    return t ? t.firstName + ' ' + t.lastName : '';
  }

  onReasonChange(value: string | number | null): void {
    this.reason.set(typeof value === 'string' ? value : '');
  }

  onClose(): void {
    this.reason.set('');
    this.error.set(null);
    this.closed.emit();
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
