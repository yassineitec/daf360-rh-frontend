import {
  Component, inject, input, signal,
} from '@angular/core';
import {
  PdfDownloadService,
  PdfBusinessError,
  PdfServiceUnavailableError,
} from '../../core/pdf/pdf-download.service';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';
type Variant = 'primary' | 'outline' | 'icon';

@Component({
  selector: 'app-pdf-download-button',
  standalone: true,
  imports: [],
  template: `
    <div class="pdf-btn-wrap">
      <button
        type="button"
        class="pdf-btn"
        [class.pdf-btn-primary]="variant() === 'primary'"
        [class.pdf-btn-outline]="variant() === 'outline'"
        [class.pdf-btn-icon]="variant() === 'icon'"
        [class.pdf-btn-loading]="state() === 'loading'"
        [class.pdf-btn-success]="state() === 'success'"
        [class.pdf-btn-disabled]="disabled()"
        [disabled]="disabled() || state() === 'loading'"
        [title]="disabled() && disabledTooltip() ? disabledTooltip() : ''"
        (click)="onClick()"
      >
        @if (state() === 'loading') {
          <span class="pdf-spinner"></span>
          <span>Generation...</span>
        } @else if (state() === 'success') {
          <span>&#10003;</span>
          <span>{{ label() }}</span>
        } @else {
          <span>&#128196;</span>
          <span>{{ label() }}</span>
        }
      </button>
      @if (errorMsg()) {
        <div class="pdf-error-msg" role="alert">{{ errorMsg() }}</div>
      }
    </div>
  `,
  styles: [`
    .pdf-btn-wrap { display: inline-flex; flex-direction: column; gap: 6px; }

    .pdf-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 16px; border-radius: 8px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: all .15s; border: none; white-space: nowrap;
    }

    .pdf-btn-primary {
      background: #1a6b7c; color: #fff; border: none;
    }
    .pdf-btn-primary:hover:not(:disabled) { opacity: .85; }

    .pdf-btn-outline {
      background: transparent; color: #1a6b7c;
      border: 1px solid #1a6b7c;
    }
    .pdf-btn-outline:hover:not(:disabled) { background: #f0f9fb; }

    .pdf-btn-icon {
      background: transparent; color: #1a6b7c;
      border: 1px solid transparent; padding: 6px 10px;
    }
    .pdf-btn-icon:hover:not(:disabled) { background: #f0f9fb; border-color: #99d6e0; }

    .pdf-btn-loading { opacity: .75; cursor: wait; }
    .pdf-btn-success { background: #16a34a; color: #fff; border-color: #16a34a; }
    .pdf-btn-disabled, .pdf-btn:disabled { opacity: .45; cursor: not-allowed; }

    .pdf-spinner {
      display: inline-block;
      width: 12px; height: 12px;
      border: 2px solid rgba(255,255,255,.35);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: pdf-spin .6s linear infinite;
      flex-shrink: 0;
    }
    @keyframes pdf-spin { to { transform: rotate(360deg); } }

    .pdf-error-msg {
      font-size: 11px; color: #dc2626;
      background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 6px; padding: 5px 10px;
      max-width: 280px; line-height: 1.4;
    }
  `],
})
export class PdfDownloadButtonComponent {
  private pdfSvc = inject(PdfDownloadService);

  // Signal inputs
  label           = input<string>('Telecharger');
  endpoint        = input.required<string>();
  body            = input<Record<string, unknown> | null>(null);
  filename        = input<string>('document.pdf');
  disabled        = input<boolean>(false);
  disabledTooltip = input<string>('');
  variant         = input<Variant>('primary');

  // State
  state    = signal<ButtonState>('idle');
  errorMsg = signal<string | null>(null);

  onClick(): void {
    if (this.disabled() || this.state() === 'loading') return;

    this.state.set('loading');
    this.errorMsg.set(null);

    this.pdfSvc.generateDocument(this.endpoint(), this.body()).subscribe({
      next: (doc) => {
        this.pdfSvc.downloadById(doc.id, this.filename()).subscribe({
          next: () => {
            this.state.set('success');
            setTimeout(() => this.state.set('idle'), 2500);
          },
          error: (err) => {
            this.state.set('idle');
            this.errorMsg.set('Erreur lors du telechargement du fichier.');
            setTimeout(() => this.errorMsg.set(null), 7000);
          },
        });
      },
      error: (err) => {
        this.state.set('idle');
        if (err instanceof PdfBusinessError) {
          this.errorMsg.set(err.serverMessage);
        } else if (err instanceof PdfServiceUnavailableError) {
          this.errorMsg.set('Service PDF indisponible. Reessayez plus tard.');
        } else {
          this.errorMsg.set('Erreur inattendue lors de la generation du document.');
        }
        setTimeout(() => this.errorMsg.set(null), 7000);
      },
    });
  }
}
