import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { StageView } from '../offboarding-display';

/**
 * The frame around one offboarding stage in the wizard.
 *
 * Replaces `daf-accordion-card`: the case page is now a step-by-step wizard where exactly
 * one stage is on screen and Précédent / Suivant move between them, so a collapsible
 * header is the wrong affordance — there is nothing to collapse into, and a chevron
 * suggested the other six stages were one click away when they are a navigation step away.
 *
 * Presentational only. It keeps the accordion's header anatomy (numbered title, icon disc,
 * data subtitle, state pill) so the wizard reads like the board and the rail, and takes the
 * stage body through `<ng-content>` exactly as the accordion did.
 */
@Component({
  selector: 'rh-stage-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, StatusBadgeComponent],
  host: { class: 'block' },
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }">

      <header class="mb-6 flex items-start gap-4">
        <!-- Icon disc — tinted by state, mirroring the accordion header it replaces. -->
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
             [class]="discClasses()">
          <span class="material-symbols-outlined text-[22px]">{{ view().icon }}</span>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-[17px] font-bold text-on-surface">
              {{ view().index }}. {{ view().title }}
            </h2>
            @if (view().statusLabel) {
              <daf-badge [label]="view().statusLabel" [options]="{ variant: badgeVariant(), size: 'sm' }" />
            }
          </div>
          @if (view().subtitle) {
            <p class="mt-1 text-[13px] text-on-surface-variant">{{ view().subtitle }}</p>
          }
        </div>
      </header>

      <ng-content />
    </daf-card>
  `,
})
export class StagePanelComponent {
  readonly view = input.required<StageView>();

  /**
   * Literal, complete class strings per state — a runtime-assembled class name is never
   * emitted by Tailwind (UI-PLAYBOOK §3).
   */
  protected discClasses(): string {
    switch (this.view().state) {
      case 'done':    return 'bg-teal/10 text-teal';
      case 'blocked': return 'bg-danger/10 text-danger';
      case 'locked':  return 'bg-surface-container-high text-outline';
      default:        return 'bg-primary/10 text-primary';
    }
  }

  protected badgeVariant(): 'teal' | 'danger' | 'neutral' | 'primary' {
    switch (this.view().state) {
      case 'done':    return 'teal';
      case 'blocked': return 'danger';
      case 'locked':  return 'neutral';
      default:        return 'primary';
    }
  }
}
