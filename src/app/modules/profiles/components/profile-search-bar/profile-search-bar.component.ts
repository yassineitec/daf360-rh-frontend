import { Component, input, output } from '@angular/core';

@Component({
  selector: 'rh-profile-search-bar',
  standalone: true,
  template: `
    <div class="relative w-full">
      <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2
                   text-[18px] text-outline pointer-events-none">search</span>
      <input
        type="search"
        [value]="value()"
        [placeholder]="placeholder()"
        (input)="searchChange.emit($any($event.target).value)"
        class="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl
               text-[14px] bg-white focus:outline-none focus:border-[#1b3a4b]
               placeholder:text-outline/50 transition-colors" />
    </div>
  `,
})
export class ProfileSearchBarComponent {
  readonly value       = input('');
  readonly placeholder = input('Rechercher par nom, email…');
  readonly searchChange = output<string>();
}
