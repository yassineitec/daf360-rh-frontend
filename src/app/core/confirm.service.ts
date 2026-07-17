import { inject, Injectable } from '@angular/core';
import { ModalService } from '@khalilrebhiitec/daf360';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Material Symbol shown on the confirm button. */
  icon?: string;
}

/**
 * Styled replacement for the native `confirm()` dialog, backed by the lib modal.
 * Usage:  if (!(await this.confirm.ask({ title, message }))) return;
 * Backdrop close is disabled so the promise always resolves via a button choice.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private modal = inject(ModalService);

  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.modal.open({
        title: opts.title,
        icon: opts.icon,
        body: opts.message,
        size: 'sm',
        closeOnBackdrop: false,
        buttons: [
          { label: opts.cancelLabel ?? 'Annuler', variant: 'secondary', action: (r) => { r.close(); resolve(false); } },
          { label: opts.confirmLabel ?? 'Confirmer', variant: 'primary', icon: opts.icon, action: (r) => { r.close(); resolve(true); } },
        ],
      });
    });
  }
}
