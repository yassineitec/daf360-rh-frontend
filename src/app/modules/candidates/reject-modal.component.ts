import { Component, input, output, signal, inject } from '@angular/core';
import { ModalComponent } from '../../shared/modal.component';
import { CandidateService } from './candidate.service';
import { ButtonComponent, FormFieldComponent, FormFieldOptions } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-reject-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, FormFieldComponent],
  template: `
    <app-modal
      [title]="'Rejeter le candidat'"
      [visible]="visible()"
      (closed)="onClose()"
      [hasFooter]="true"
    >
      @if (candidateName) {
        <p class="text-sm font-semibold text-on-surface mb-4">{{ candidateName }}</p>
      }
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-on-surface">
          Motif du rejet <span class="text-danger">*</span>
          <span class="font-normal text-outline"> (min. 10 car.)</span>
        </label>
        <daf-form-field
          [value]="reason()"
          [options]="reasonFieldOptions"
          (valueChange)="onReasonChange($event)"
        />
        @if (error()) {
          <p class="text-xs text-danger">{{ error() }}</p>
        }
      </div>
      <div slot="footer" class="flex justify-end gap-2">
        <daf-button
          label="Annuler"
          variant="ghost"
          [options]="{ size: 'md' }"
          (onClick)="onClose()"
        />
        <daf-button
          [label]="saving() ? 'Rejet en cours…' : 'Confirmer le rejet'"
          variant="danger"
          [options]="{ iconStart: 'cancel', size: 'md', disabled: saving() || reason().trim().length < 10 }"
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

  reason  = signal('');
  error   = signal<string | null>(null);
  saving  = signal(false);

  readonly reasonFieldOptions: FormFieldOptions = {
    type: 'textarea',
    placeholder: 'Expliquez le motif du rejet…',
    fullWidth: true,
    rows: 4,
  };

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
      this.error.set('Le motif doit comporter au moins 10 caractères.');
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
        this.error.set('Erreur lors du rejet. Veuillez réessayer.');
      },
    });
  }
}
