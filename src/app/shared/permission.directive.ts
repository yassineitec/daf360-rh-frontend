import {
  Directive,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { UserStore } from '../core/user.store';

/**
 * Structural directive that conditionally renders its host element
 * based on whether the current user has the given permission.
 *
 * Usage:
 *   <button *appHasPermission="'RESPONSE_LEAVE'">Approve</button>
 *
 * The view is re-evaluated reactively whenever UserStore.permissions() changes
 * (e.g. after a user reload).
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class PermissionDirective {
  readonly appHasPermission = input.required<string>();

  private vcr   = inject(ViewContainerRef);
  private tpl   = inject(TemplateRef<unknown>);
  private store = inject(UserStore);

  constructor() {
    effect(() => {
      this.vcr.clear();
      if (this.store.permissions().includes(this.appHasPermission())) {
        this.vcr.createEmbeddedView(this.tpl);
      }
    });
  }
}
