import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** How a read-only field renders. All three shapes come from `design/profile-detail.html`. */
export type ProfileFieldVariant =
  /** Label above value, in a responsive field grid. The original page's shape. */
  | 'stacked'
  /** Label left, value right, divider under — the contract/salary cards. */
  | 'row'
  /** Micro-label over a bold value on a tinted panel — the "Affectation & Structure" tiles. */
  | 'tile';

/**
 * Read-only label + value pair — the display half of every field on a detail
 * page. Was `app-field`, declared inline in `profile-detail.component.ts`.
 *
 * Shared by `/rh/profiles/:id` and `/rh/candidates/:id`, which is why it lives in
 * `shared/detail/` rather than in the profiles module. The selector keeps its
 * original `rh-profile-field` name — it is used 40+ times and renaming it buys
 * nothing; read it as "detail field".
 *
 * Stays app-local: the lib has no read-only field display. Three variants rather
 * than three components because they differ only in chrome, and one place to
 * change means the tabs can't drift apart.
 */
@Component({
  selector: 'rh-profile-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClasses()' },
  template: `
    @switch (variant()) {

      @case ('row') {
        <span class="min-w-0 text-[12px] font-medium text-on-surface-variant">{{ label() }}</span>
        <span class="min-w-0 wrap-break-word text-right text-[14px] font-bold"
              [class]="valueClass() || 'text-on-surface'">
          {{ value() ?? '—' }}
        </span>
      }

      @case ('tile') {
        <span class="mb-1 wrap-break-word text-[10px] font-bold uppercase tracking-widest text-outline">{{ label() }}</span>
        <span class="wrap-break-word text-[14px] font-bold text-on-surface">{{ value() ?? '—' }}</span>
      }

      @default {
        <span class="wrap-break-word text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          {{ label() }}
        </span>
        <span class="wrap-break-word text-[13px] text-on-surface">{{ value() ?? '—' }}</span>
      }
    }
  `,
})
export class ProfileFieldComponent {
  label   = input.required<string>();
  value   = input<string | null | undefined>(null);
  variant = input<ProfileFieldVariant>('stacked');
  /** Span both columns of a `stacked` field grid. Ignored by the other variants. */
  wide    = input(false);
  /** `row` only — a full literal text-* class to accent the value (e.g. `text-primary`). */
  valueClass = input<string>('');
  /** `row` only — drop the divider, for the last row in a card. */
  last    = input(false);

  /**
   * `min-w-0` on every variant, and `wrap-break-word` on the spans above, is what keeps
   * a long unbreakable value (a work email, an IBAN, a passport number) inside the
   * card. A flex/grid item's default `min-width: auto` lets it grow past its track,
   * so in the narrow identity card's `grid-cols-2` one long value used to widen its
   * column and push the text out of the card.
   */
  protected readonly hostClasses = computed(() => {
    switch (this.variant()) {
      case 'row':
        return 'flex min-w-0 items-center justify-between gap-3 py-2'
          + (this.last() ? '' : ' border-b border-outline-variant/40');
      case 'tile':
        return 'flex min-w-0 flex-col rounded-xl bg-surface-container-high/50 p-4';
      default:
        return (this.wide() ? 'col-span-2 ' : '') + 'flex min-w-0 flex-col gap-0.5';
    }
  });
}
