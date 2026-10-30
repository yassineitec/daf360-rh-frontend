import {
  Component, DestroyRef, TemplateRef, effect, inject, input, output, untracked, viewChild,
} from '@angular/core';
import { ModalConfig, ModalRef, ModalService } from '@khalilrebhiitec/daf360';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Drop-in replacement for `app-modal` that renders through the library's ModalService
 * (daf modal), resizable and maximizable.
 *
 * Same API as `app-modal` — `title`, `visible`, `hasFooter`, `size`, `(closed)`, default
 * content plus a `[slot=footer]` block — so a pop-up switches by renaming the tag.
 *
 * The projected content is wrapped in an <ng-template> handed to ModalService as the body.
 * The footer sits at the end of that body, sticky to the bottom, because ModalConfig only
 * takes plain buttons and the callers' footers carry their own daf-buttons and states.
 */
@Component({
  selector: 'app-daf-modal',
  standalone: true,
  template: `
    <ng-template #bodyTpl>
      <ng-content />
      @if (hasFooter()) {
        <div class="daf-modal-footer">
          <ng-content select="[slot=footer]" />
        </div>
      }
    </ng-template>
  `,
  styles: [`
    /* Pulled out to the panel edges (the body pads 24px 32px) and pinned to its bottom,
       so the actions stay in view while the body scrolls or the user resizes. */
    .daf-modal-footer {
      position: sticky; bottom: -24px; z-index: 10;
      margin: 24px -32px -24px;
      padding: 20px 32px;
      background: #ffffff;
      border-top: 1px solid rgba(197,198,205,.2);
      display: flex; gap: 12px; justify-content: flex-end;
    }
    .daf-modal-footer ::ng-deep [slot="footer"] {
      display: flex;
      align-items: center;
      gap: 12px;
      justify-content: flex-end;
      width: 100%;
    }
  `],
})
export class DafModalComponent {
  title     = input('');
  visible   = input(false);
  hasFooter = input(false);
  size      = input<ModalSize>('md');

  closed = output<void>();

  private readonly modalService = inject(ModalService);
  private readonly bodyTpl = viewChild<TemplateRef<unknown>>('bodyTpl');
  private modalRef: ModalRef | null = null;

  constructor() {
    effect(() => {
      const show = this.visible();
      untracked(() => (show ? this.open() : this.modalRef?.close()));
    });
    // The modal lives in <body>: leaving the page must not leave it behind.
    inject(DestroyRef).onDestroy(() => this.modalRef?.close());
  }

  private open(): void {
    const tpl = this.bodyTpl();
    if (!tpl || this.modalRef) return;

    // Getter, not a value: the modal host re-reads it, so a title that depends on the
    // caller's state (approve / reject, add / edit) follows it like the old binding did.
    const self = this;
    const config: ModalConfig = {
      get title() { return self.title(); },
      body:        tpl,
      size:        this.size(),
      minWidth:    '360px',
      minHeight:   '260px',
      resizable:   true,
      maximizable: true,
    };
    const ref = this.modalService.open(config);

    // ✕, backdrop and close() all end in _destroy(): tell the caller there, otherwise its
    // `visible` would stay true on a modal that is gone.
    const destroy = ref._destroy.bind(ref);
    ref._destroy = () => {
      destroy();
      this.modalRef = null;
      if (this.visible()) this.closed.emit();
    };
    this.modalRef = ref;
  }
}
