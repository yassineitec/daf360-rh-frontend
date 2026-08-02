import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CardComponent, CardVariant } from '@khalilrebhiitec/daf360';

/** Icon-tile + head tint preset. Whole literal classes only (UI-PLAYBOOK §3). */
export type WizardAccent = 'primary' | 'tertiary';

/**
 * The shell a wizard step sits in: a `daf-card` with an icon tile, the step title
 * and sub-label, the step's own fields through `<ng-content>`, and a `[stepFooter]`
 * slot for whatever the page puts under them (an action bar, a validation hint).
 *
 * Shared by the two RH wizards — `/rh/it-provisioning/:id` and
 * `/rh/candidates/new` — which had built the same construct twice and already
 * drifted: different icon-tile sizes, different title treatments (bold 15px vs a
 * 10px uppercase eyebrow), and three raw `rgba()` values on the candidate side
 * that no token backs. One shell, two knobs.
 *
 * ⚠️ `hoverable` defaults to **false**. `daf-card`'s hover is
 * `hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:bg-white/95` plus
 * `cursor-pointer`, on a 300ms `transition-all` — built for a clickable tile in a
 * grid. On a form card it reads as "the card has an inside hover": pointing at a
 * text input lifts and grows the whole card, sliding the field out from under the
 * cursor and showing a pointer cursor over every input.
 */
@Component({
  selector: 'rh-wizard-step-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  host: { class: 'block' },
  template: `
    <daf-card
      class="block overflow-hidden"
      [options]="{ variant: variant(), padding: 'none', radius: 'xl', hoverable: hoverable() }">

      <!-- Step head -->
      <div [class]="headClasses()">
        <div [class]="tileClasses()">
          <span class="material-symbols-outlined" [class]="tileIconSize()">{{ icon() }}</span>
        </div>
        <div class="min-w-0">
          <h2 class="truncate text-[0.9rem] font-bold leading-snug text-on-surface sm:text-[1.05rem]">
            {{ title() }}
          </h2>
          @if (subtitle()) {
            <p class="truncate text-[12px] text-outline sm:text-[13px]">{{ subtitle() }}</p>
          }
        </div>
      </div>

      <!-- Step body -->
      <div [class]="bodyClasses()">
        <ng-content />
      </div>

      <!--
        Footer, full-bleed so an action bar can carry its own border-top.
        The host element must be a STATIC root node of the projected content: an
        element nested inside an @if lives in an embedded view and ng-content's
        selector never matches it (UI-PLAYBOOK §10f).
      -->
      <ng-content select="[stepFooter]" />
    </daf-card>
  `,
})
export class WizardStepCardComponent {
  readonly icon     = input.required<string>();
  readonly title    = input.required<string>();
  readonly subtitle = input('');

  readonly variant = input<CardVariant>('glass');
  readonly accent  = input<WizardAccent>('primary');
  /** Tighter tile + padding, for a wizard card that shares its row with a sidebar. */
  readonly dense   = input(false);
  readonly hoverable = input(false);

  protected readonly headClasses = computed(() => {
    const pad = this.dense()
      ? 'gap-3.5 px-5 py-4 sm:px-8'
      : 'gap-3 px-4 py-5 sm:gap-4 sm:px-8 sm:py-6';
    // Only the tertiary preset tints the head — replaces a raw rgba(121,215,190,0.06).
    const tint = this.accent() === 'tertiary' ? 'bg-tertiary/5' : '';
    return `flex items-center border-b border-outline-variant ${pad} ${tint}`.trim();
  });

  protected readonly tileClasses = computed(() => {
    const size = this.dense() ? 'h-11 w-11 rounded-xl' : 'h-12 w-12 rounded-2xl sm:h-16 sm:w-16';
    const tone = this.accent() === 'tertiary'
      ? 'bg-tertiary/10 text-tertiary'
      : 'bg-primary/10 text-primary';
    return `flex shrink-0 items-center justify-center ${size} ${tone}`;
  });

  protected readonly tileIconSize = computed(() =>
    this.dense() ? 'text-[20px]' : 'text-[24px] sm:text-[32px]',
  );

  protected readonly bodyClasses = computed(() =>
    this.dense() ? 'p-5 sm:p-8' : 'px-4 py-5 sm:px-8 sm:py-7',
  );
}
