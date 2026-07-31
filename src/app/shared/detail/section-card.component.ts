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
  host: { class: 'block' },
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
