import { Component, computed, input, output } from '@angular/core';
import { CardComponent, CardOptions } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'rh-quick-action-card',
  standalone: true,
  imports: [CardComponent],
  template: `
    <daf-card [options]="cardOptions()" (cardClick)="clicked.emit(route())" />
  `,
})
export class QuickActionCardComponent {
  readonly icon     = input.required<string>();
  readonly label    = input.required<string>();
  readonly sublabel = input.required<string>();
  readonly route    = input<string | undefined>(undefined);
  readonly clicked  = output<string | undefined>();

  readonly cardOptions = computed<CardOptions>(() => ({
    variant: 'glass',
    padding: 'md',
    radius: 'xl',
    icon: this.icon(),
    iconBg: 'bg-teal/10',
    iconColor: 'text-teal',
    iconHoverBg: 'bg-teal',
    iconHoverColor: 'text-white',
    title: this.label(),
    description: this.sublabel(),
    clickable: true,
    hoverable: true,
  }));
}
