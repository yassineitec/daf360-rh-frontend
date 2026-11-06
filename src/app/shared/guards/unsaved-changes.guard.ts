import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { ConfirmService } from '../../core/confirm.service';

/** A page whose typed values are lost when the user leaves it before saving. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Asks before leaving a page that has unsaved changes (the IT file, the onboarding file).
 * In-app navigation only — closing the tab or reloading is the page's own `beforeunload`.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component => {
  if (!component?.hasUnsavedChanges?.()) return true;
  const t = inject(TranslateService);
  return inject(ConfirmService).ask({
    title:        t.instant('UNSAVED.TITLE'),
    message:      t.instant('UNSAVED.MESSAGE'),
    confirmLabel: t.instant('UNSAVED.LEAVE'),
    cancelLabel:  t.instant('UNSAVED.STAY'),
    icon:         'logout',
  });
};
