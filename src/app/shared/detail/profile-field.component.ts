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
        <span class="text-[12px] font-medium text-on-surface-variant">{{ label() }}</span>
        <span class="text-[14px] font-bold" [class]="valueClass() || 'text-on-surface'">
          {{ value() ?? '—' }}
        </span>
      }

      @case ('tile') {
        <span class="mb-1 text-[10px] font-bold uppercase tracking-widest text-outline">{{ label() }}</span>
        <span class="text-[14px] font-bold text-on-surface">{{ value() ?? '—' }}</span>
      }

      @default {
        <span class="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          {{ label() }}
        </span>
        <span class="text-[13px] text-on-surface">{{ value() ?? '—' }}</span>
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

  protected readonly hostClasses = computed(() => {
    switch (this.variant()) {
      case 'row':
        return 'flex items-center justify-between gap-3 py-2'
          + (this.last() ? '' : ' border-b border-outline-variant/40');
      case 'tile':
        return 'flex flex-col rounded-xl bg-surface-container-high/50 p-4';
      default:
        return (this.wide() ? 'col-span-2 ' : '') + 'flex flex-col gap-0.5';
    }
  });
}
