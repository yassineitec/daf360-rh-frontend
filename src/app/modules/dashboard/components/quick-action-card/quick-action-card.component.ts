import { Component, input, output } from '@angular/core';

@Component({
  selector: 'rh-quick-action-card',
  standalone: true,
  template: `
    <button
      type="button"
      class="w-full p-4 bg-surface-container-lowest border border-outline-variant rounded-xl
             shadow-sm hover:border-primary-container hover:shadow-md transition-all
             flex flex-col gap-2 cursor-pointer text-left"
      (click)="clicked.emit(route())"
    >
      <span class="material-symbols-outlined text-teal text-[28px]">{{ icon() }}</span>
      <p class="text-[14px] font-semibold text-on-surface">{{ label() }}</p>
      <p class="text-[10px] text-outline uppercase font-bold tracking-wide">{{ sublabel() }}</p>
    </button>
  `,
})
export class QuickActionCardComponent {
  readonly icon     = input.required<string>();
  readonly label    = input.required<string>();
  readonly sublabel = input.required<string>();
  readonly route    = input<string | undefined>(undefined);
  readonly clicked  = output<string | undefined>();
}
