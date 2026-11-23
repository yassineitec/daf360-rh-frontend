import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { CardAccent, CardComponent } from '@khalilrebhiitec/daf360';

/**
 * The shell every tab panel sits in: a glass `daf-card` with the design's
 * micro-label heading and an optional left accent stripe.
 *
 * Shared by `/rh/profiles/:id` and `/rh/candidates/:id`, which is why it lives in
 * `shared/detail/` rather than in the profiles module: one component so no tab on
 * either page can drift apart on padding, heading size or icon placement — and so
 * "restyle the sections" stays a one-file change.
 * `accent` takes whole literal classes: a runtime-built `border-${colour}` would
 * never survive the consuming app's Tailwind scan (UI-PLAYBOOK §3).
 */
@Component({
  selector: 'rh-section-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  /**
   * The styles block below neutralises a lib rule this shell must not obey.
   *
   * The lib's `.glass-card:hover` (styles.css) applies `translateY(-4px) scale(1.02)` as plain
   * CSS on the class — NOT through the `hover:` utilities `daf-card` adds only when `hoverable`
   * is set. So every glass card lifts and grows on hover whether or not it asked to. On a
   * full-width tab panel that is ~10px of growth each side, sliding over the `daf-tabs` strip
   * above it, and a scaled layer carrying `backdrop-filter` is re-rasterised: the whole panel,
   * text included, goes visibly blurry while hovered (the Entretiens tab, with glass cards
   * nested in it, made that obvious).
   *
   * Why a component style and not the Tailwind arbitrary variant this used to be
   * (`[&_.glass-card:hover]:transform-none` on the host): the lib's styles.css is imported
   * UNLAYERED in src/styles.css, and unlayered CSS beats everything in Tailwind's
   * `@layer utilities` regardless of specificity, so that utility was generated and never won.
   * A component style is unlayered too, and its selector is more specific than the lib's.
   *
   * Scoped here rather than fixed in the lib on purpose — the lib fix changes behaviour for
   * every consumer and needs its own release. Only `transform` is dropped: the background and
   * shadow shifts are harmless and still read as "you are over this panel".
   *
   * Two rules:
   * - Cards NESTED in the panel never lift — a card growing inside a card that may itself be
   *   growing is what blurred the Entretiens tab.
   * - The panel itself does not lift either, unless the caller opts in with `hoverLift`
   *   (the Entretiens tab does). Off by default because the growth slid the Documents panel
   *   over the tab strip.
   */
  host: { class: 'block', '[class.rh-section-lift]': 'hoverLift()' },
  styles: [`
    :host ::ng-deep .glass-card .glass-card:hover { transform: none; }
    :host(:not(.rh-section-lift)) ::ng-deep .glass-card:hover { transform: none; }
  `],
  template: `
    <daf-card [options]="{ variant: 'glass', radius: 'xl', padding: 'md', accent: accent() }">
      @if (title()) {
        <!-- Collapsible: the whole header row is the toggle, so it must be a
             <button>. Non-collapsible: a plain row, because a button that does
             nothing is still focusable and still announced as one. -->
        @if (collapsible()) {
          <button type="button"
            class="flex w-full items-center justify-between gap-3 text-left"
            [class.mb-5]="open()"
            [attr.aria-expanded]="open()"
            (click)="open.set(!open())">
            <h3 [class]="headingClass()">
              @if (icon()) { <span class="material-symbols-outlined text-[18px]">{{ icon() }}</span> }
              {{ title() }}
            </h3>
            <span class="material-symbols-outlined text-[20px] text-outline transition-transform duration-300"
                  [class.rotate-180]="open()">expand_more</span>
          </button>
        } @else {
          <div class="mb-5 flex items-center justify-between gap-3">
            <h3 [class]="headingClass()">
              @if (icon()) { <span class="material-symbols-outlined text-[18px]">{{ icon() }}</span> }
              {{ title() }}
            </h3>
            <ng-content select="[sectionAction]" />
          </div>
        }
      }

      @if (!collapsible() || open()) {
        <ng-content />
      }
    </daf-card>
  `,
})
export class SectionCardComponent {
  title = input<string>('');
  icon  = input<string>('');
  /** Heading colour, e.g. `text-primary`. Defaults to the muted body tone. */
  tone  = input<string>('text-on-surface-variant');
  /**
   * Left accent stripe. Native to `daf-card` since 4.12.0 — this used to be a
   * hand-rolled `border-l-4` on the host, which fought the card's own rounding.
   */
  accent = input<CardAccent>('none');
  /** Header toggles the body, with the design's rotating chevron. */
  collapsible = input(false);
  /** Keep the lib's glass lift on hover for the panel itself (nested cards never lift). */
  hoverLift = input(false);
  /** Only meaningful with `collapsible`; the design opens the Régime card closed. */
  startOpen = input(false);

  protected readonly open = signal(false);

  constructor() {
    // `startOpen` is a seed, not a binding: once the user has toggled the card,
    // a parent re-render must not slam it back open.
    queueMicrotask(() => { if (this.startOpen()) this.open.set(true); });
  }

  protected headingClass(): string {
    return 'flex items-center gap-2 text-[11px] font-black uppercase tracking-widest ' + this.tone();
  }
}
