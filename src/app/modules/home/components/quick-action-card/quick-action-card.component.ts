import { Component, computed, input, output } from '@angular/core';
import { CardComponent, CardOptions } from '@khalilrebhiitec/daf360';

export type QuickActionColor = 'secondary' | 'tertiary' | 'teal' | 'amber';

// 'amber' matches the exact "Affaires" tile color from daf360-facturation-frontend
// (rgba(255,221,184,0.30) bg / #4c2e00 icon), via Tailwind arbitrary-value classes.
const COLOR_CLASSES: Record<QuickActionColor, { bg: string; color: string; hoverBg: string }> = {
  secondary: { bg: 'bg-secondary/10', color: 'text-secondary', hoverBg: 'bg-secondary' },
  tertiary:  { bg: 'bg-tertiary/10',  color: 'text-tertiary',  hoverBg: 'bg-tertiary' },
  teal:      { bg: 'bg-teal/10',      color: 'text-teal',      hoverBg: 'bg-teal' },
  amber:     { bg: 'bg-[rgba(255,221,184,0.30)]', color: 'text-[#4c2e00]', hoverBg: 'bg-[#4c2e00]' },
};

@Component({
  selector: 'rh-quick-action-card',
  standalone: true,
  host: { class: 'block h-40' },
  imports: [CardComponent],
  template: `
    <daf-card [options]="cardOptions()" (cardClick)="clicked.emit(route())">
      <h4 class="text-[22px] font-bold text-on-surface mb-2 leading-snug">{{ label() }}</h4>
      <p class="text-body-sm text-on-surface-variant leading-relaxed">{{ sublabel() }}</p>
    </daf-card>
  `,
})
export class QuickActionCardComponent {
  readonly icon     = input.required<string>();
  readonly label    = input.required<string>();
  readonly sublabel = input.required<string>();
  readonly route    = input<string | undefined>(undefined);
  readonly color    = input<QuickActionColor>('teal');
  readonly clicked  = output<string | undefined>();

  readonly cardOptions = computed<CardOptions>(() => {
    const c = COLOR_CLASSES[this.color()];
    return {
      variant: 'glass',
      padding: 'md',
      radius: 'xl',
      icon: this.icon(),
      iconBg: c.bg,
      iconColor: c.color,
      iconHoverBg: c.hoverBg,
      iconHoverColor: 'text-white',
      clickable: true,
      hoverable: true,
      fullHeight: true,
    };
  });
}
