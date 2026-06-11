import { Component, input, output, signal, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/modal.component';
import { CandidateService } from './candidate.service';

@Component({
  selector: 'app-reject-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  styleUrl: './reject-modal.component.scss',
  template: `
    <app-modal
      [title]="'Rejeter le candidat'"
      [visible]="visible()"
      (closed)="onClose()"
      [hasFooter]="true"
    >
      <p class="reject-name">{{ candidateName }}</p>
      <div class="form-group">
        <label class="form-label">Motif du rejet <span class="required">*</span> (min. 10 car.)</label>
        <textarea
          class="reason-textarea"
          rows="4"
          placeholder="Expliquez le motif du rejet…"
          [value]="reason()"
          (input)="onReasonChange($any($event.target).value)"
        ></textarea>
        @if (error()) { <p class="field-error">{{ error() }}</p> }
      </div>
      <div slot="footer">
        <button type="button" (click)="onClose()" class="btn-cancel">Annuler</button>
        <button type="button" (click)="onConfirm()" [disabled]="saving() || reason().trim().length < 10" class="btn-reject">
          @if (saving()) { Rejet en cours… } @else { Confirmer le rejet }
        </button>
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

  get candidateName(): string {
    const t = this.target();
    return t ? t.firstName + ' ' + t.lastName : '';
  }

  onReasonChange(value: string): void {
    this.reason.set(value);
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
