import { Component, computed, input, signal } from '@angular/core';

export interface DonutSegment {
  key:   string;
  label: string;
  value: number;
  /** Hex colour. Categorical slots come from DONUT_COLORS; "non défini" uses DONUT_NEUTRAL. */
  color: string;
}

/**
 * Categorical slots, in fixed order — never cycled. Checked with the dataviz palette
 * validator against the light surface (lightness band, chroma, CVD and normal-vision
 * separation on every pair, 3:1 contrast): all pass.
 *
 * `--color-teal` (#2D5D6E) was tried first and fails the chroma floor — it reads as grey
 * next to a real hue — so slot 1 is a brighter teal-green in the same family. Slot 2 is
 * the library's own `--color-secondary`.
 */
export const DONUT_COLORS = ['#0e9f8f', '#4648d4', '#d0602a'] as const;
/** "Non défini" is not a category, so it takes a neutral, not a hue. */
export const DONUT_NEUTRAL = '#c5c6cd';

interface Arc extends DonutSegment {
  pct:    number;
  dash:   string;
  offset: number;
}

/**
 * Multi-segment ring — what `daf-gauge` (one value) can't draw. Same geometry rules as
 * the gauge: radius derived from size and thickness, svg rotated −90° so the first
 * segment starts at 12 o'clock, centre text as a SIBLING of the svg (inside it, the
 * rotation would lay the text on its side).
 *
 * Hover or focus a segment (or its legend row, owned by the caller) and the centre
 * reads that segment out; otherwise it shows the total.
 */
@Component({
  selector: 'rh-donut-chart',
  standalone: true,
  host: { class: 'inline-block' },
  template: `
    <div class="relative" [style.width.px]="size()" [style.height.px]="size()">
      <svg class="-rotate-90" [attr.width]="size()" [attr.height]="size()"
           [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
           role="img" [attr.aria-label]="ariaLabel()">
        <circle [attr.cx]="centre()" [attr.cy]="centre()" [attr.r]="radius()"
                fill="none" stroke="var(--color-surface-container)"
                [attr.stroke-width]="thickness()" />
        @for (arc of arcs(); track arc.key) {
          <circle class="cursor-pointer outline-none transition-[stroke-width] duration-150"
                  [attr.cx]="centre()" [attr.cy]="centre()" [attr.r]="radius()"
                  fill="none" [attr.stroke]="arc.color"
                  [attr.stroke-width]="active() === arc.key ? thickness() + 6 : thickness()"
                  [attr.stroke-dasharray]="arc.dash"
                  [attr.stroke-dashoffset]="arc.offset"
                  tabindex="0"
                  [attr.aria-label]="arc.label + ' : ' + arc.value + ' (' + arc.pct + ' %)'"
                  (mouseenter)="hovered.set(arc.key)" (mouseleave)="hovered.set(null)"
                  (focus)="hovered.set(arc.key)" (blur)="hovered.set(null)" />
        }
      </svg>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
           aria-hidden="true">
        @if (activeArc(); as a) {
          <span class="text-headline-lg font-bold leading-none text-on-surface">{{ a.value }}</span>
          <span class="mt-1 text-label-sm text-on-surface-variant">{{ a.label }}</span>
          <span class="text-[11px] font-semibold text-outline">{{ a.pct }} %</span>
        } @else {
          <span class="text-headline-lg font-bold leading-none text-on-surface">{{ total() }}</span>
          <span class="mt-1 text-label-sm text-on-surface-variant">{{ centerLabel() }}</span>
        }
      </div>
    </div>
  `,
})
export class DonutChartComponent {
  readonly segments    = input<DonutSegment[]>([]);
  readonly centerLabel = input<string>('');
  readonly ariaLabel   = input<string>('');
  readonly size        = input<number>(176);
  readonly thickness   = input<number>(22);
  /** Segment highlighted from outside — the caller's legend row under the pointer. */
  readonly highlight   = input<string | null>(null);

  protected readonly hovered = signal<string | null>(null);
  protected readonly active  = computed(() => this.hovered() ?? this.highlight());

  protected readonly centre = computed(() => this.size() / 2);
  /** Room for the +6px hover stroke so the grown segment isn't clipped by the viewBox. */
  protected readonly radius = computed(() => (this.size() - this.thickness() - 6) / 2);

  readonly total = computed(() => this.segments().reduce((s, x) => s + Math.max(0, x.value), 0));

  protected readonly arcs = computed<Arc[]>(() => {
    const total = this.total();
    if (total === 0) return [];
    const c = 2 * Math.PI * this.radius();
    const drawn = this.segments().filter(s => s.value > 0);
    // 2px surface gap between neighbours; none when one segment fills the ring.
    const gap = drawn.length > 1 ? 2 : 0;
    let start = 0;
    return drawn.map(s => {
      const len = (s.value / total) * c;
      const arc: Arc = {
        ...s,
        pct:    Math.round((s.value / total) * 1000) / 10,
        dash:   `${Math.max(len - gap, 0.5)} ${c}`,
        offset: -start,
      };
      start += len;
      return arc;
    });
  });

  protected readonly activeArc = computed(() => this.arcs().find(a => a.key === this.active()) ?? null);
}
