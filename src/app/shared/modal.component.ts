import {
  Component, input, output,
  HostListener, ViewChild, ElementRef,
} from '@angular/core';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_WIDTH: Record<ModalSize, string> = {
  sm: '440px',
  md: '580px',
  lg: '740px',
  xl: '960px',
};

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
          [style.max-width]="sizes[size()]"
          #dialog
        >
          <!-- Decorative depth circles matching daf-modal-host -->
          <div class="deco-top"></div>
          <div class="deco-bottom"></div>

          <header class="dialog-header">
            <h2 class="dialog-title">{{ title() }}</h2>
            <button class="dialog-close" (click)="closed.emit()" aria-label="Fermer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5">
                <path d="M6 18L18 6M6 6l12 12"/>
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
      background: rgba(0,0,0,.3);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
      animation: fadeIn .28s ease;
    }
    .dialog {
      position: relative;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,.25);
      width: 100%;
      max-height: 90vh;
      display: flex; flex-direction: column;
      overflow: hidden;
      animation: slideUp .32s cubic-bezier(.34,1.56,.64,1);
    }
    .deco-top {
      position: absolute; top: -48px; right: -48px;
      width: 192px; height: 192px;
      background: rgba(29,43,62,.05);
      border-radius: 9999px;
      filter: blur(40px);
      pointer-events: none; z-index: 0;
    }
    .deco-bottom {
      position: absolute; bottom: -80px; left: -80px;
      width: 256px; height: 256px;
      background: rgba(70,72,212,.04);
      border-radius: 9999px;
      filter: blur(40px);
      pointer-events: none; z-index: 0;
    }
    .dialog-header {
      position: relative; z-index: 10;
      display: flex; align-items: center;
      padding: 24px 32px;
      border-bottom: 1px solid rgba(197,198,205,.2);
      flex-shrink: 0;
    }
    .dialog-title {
      flex: 1; font-size: 18px; font-weight: 700;
      color: #191c1e; margin: 0; line-height: 1.3;
    }
    .dialog-close {
      background: none; border: none; cursor: pointer;
      color: #44474c;
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px;
      transition: background .15s, color .15s;
      flex-shrink: 0; margin-left: 12px;
    }
    .dialog-close:hover { background: #eceef0; color: #191c1e; }
    .dialog-body {
      position: relative; z-index: 10;
      overflow-y: auto; overflow-x: hidden;
      flex: 1;
      padding: 24px 32px;
      font-size: 14px; color: #44474c;
    }
    .dialog-footer {
      position: relative; z-index: 10;
      padding: 20px 32px;
      border-top: 1px solid rgba(197,198,205,.2);
      display: flex; gap: 12px; justify-content: flex-end;
      flex-shrink: 0;
    }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px) scale(.97); }
      to   { opacity: 1; transform: none; }
    }
  `],
})
export class ModalComponent {
  title     = input('');
  visible   = input(false);
  hasFooter = input(false);
  size      = input<ModalSize>('md');

  readonly sizes = SIZE_WIDTH;

  closed = output<void>();

  @ViewChild('dialog') dialogEl?: ElementRef<HTMLElement>;

  onOverlayClick(e: MouseEvent): void {
    if (!this.dialogEl?.nativeElement.contains(e.target as Node)) {
      this.closed.emit();
    }
  }

  @HostListener('keydown.escape')
  onEsc(): void { this.closed.emit(); }
}
