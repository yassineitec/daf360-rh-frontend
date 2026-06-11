import {
  Component, input, output, signal,
  HostListener, ViewChild, ElementRef,
} from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="overlay" (click)="onOverlayClick($event)">
        <div
          class="dialog"
          role="dialog"
          [attr.aria-label]="title()"
          #dialog
        >
          <header class="dialog-header">
            <h2 class="dialog-title">{{ title() }}</h2>
            <button class="dialog-close" (click)="closed.emit()" aria-label="Fermer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6"  y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>
          <div class="dialog-body">
            <ng-content />
          </div>
          @if (hasFooter()) {
            <footer class="dialog-footer">
              <ng-content select="[slot=footer]" />
            </footer>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,.4);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn .15s ease;
    }
    .dialog {
      background: var(--color-surface, #fff);
      border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.18);
      width: min(560px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      overflow: auto;
      animation: slideUp .2s ease;
    }
    .dialog-header {
      display: flex; align-items: center;
      padding: 18px 20px 16px;
      border-bottom: 1px solid var(--color-border, #E0E7E9);
    }
    .dialog-title {
      flex: 1; font-size: 15px; font-weight: 600;
      color: var(--color-text, #1A1C1E); margin: 0;
    }
    .dialog-close {
      background: none; border: none; cursor: pointer;
      color: var(--color-text-muted, #6B7280);
      padding: 4px; border-radius: 4px;
      display: flex; transition: background .15s;
      &:hover { background: var(--color-bg-secondary, #EEF2F5); }
    }
    .dialog-body    { padding: 20px; }
    .dialog-footer  {
      padding: 14px 20px;
      border-top: 1px solid var(--color-border, #E0E7E9);
      display: flex; gap: 10px; justify-content: flex-end;
    }
    @keyframes fadeIn   { from { opacity: 0; } }
    @keyframes slideUp  { from { transform: translateY(16px); opacity: 0; } }
  `],
})
export class ModalComponent {
  title     = input('');
  visible   = input(false);
  hasFooter = input(false);

  closed = output<void>();

  @ViewChild('dialog') dialogEl?: ElementRef<HTMLElement>;

  onOverlayClick(e: MouseEvent) {
    if (!this.dialogEl?.nativeElement.contains(e.target as Node)) {
      this.closed.emit();
    }
  }

  @HostListener('keydown.escape')
  onEsc() { this.closed.emit(); }
}
