import {
  Component, inject, input, signal,
} from '@angular/core';
import {
  PdfDownloadService,
  PdfBusinessError,
  PdfServiceUnavailableError,
} from '../../core/pdf/pdf-download.service';
import { NotificationService } from '../../core/notification.service';

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
  private notify = inject(NotificationService);

  // Signal inputs
  label           = input<string>('Telecharger');
  /** Generate endpoint (POST/GET → returns the doc). Only needed when docId is not set. */
  endpoint        = input<string>('');
  body            = input<Record<string, unknown> | null>(null);
  /** When set, the document already exists → download it directly (no generate step). */
  docId           = input<number | null>(null);
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

    // Already-generated document → download straight by id (no spurious generate).
    const existingId = this.docId();
    if (existingId != null) {
      this.download(existingId);
      return;
    }

    // Otherwise generate first, then download the returned document.
    this.pdfSvc.generateDocument(this.endpoint(), this.body()).subscribe({
      next: (doc) => this.download(doc.id),
      error: (err) => {
        this.state.set('idle');
        const message =
          err instanceof PdfBusinessError            ? err.serverMessage
          : err instanceof PdfServiceUnavailableError ? 'Service PDF indisponible. Réessayez plus tard.'
          :                                             'Erreur inattendue lors de la génération du document.';
        this.fail(message);
      },
    });
  }

  private download(id: number): void {
    this.pdfSvc.downloadById(id, this.filename()).subscribe({
      next: () => {
        this.state.set('success');
        this.notify.success(`${this.filename()} — document généré.`);
        setTimeout(() => this.state.set('idle'), 2500);
      },
      error: (err) => {
        this.state.set('idle');
        this.fail(
          err?.status === 503
            ? "Le document n'a pas encore été généré. Générez-le d'abord."
            : 'Erreur lors du téléchargement du fichier.',
        );
      },
    });
  }

  /**
   * One failure path: a toast, plus the inline message the button has always
   * shown. The toast is what gets noticed when the button is inside a drawer or
   * below the fold; the inline text keeps the reason next to the action.
   */
  private fail(message: string): void {
    this.errorMsg.set(message);
    this.notify.error(message);
    setTimeout(() => this.errorMsg.set(null), 7000);
  }
}
