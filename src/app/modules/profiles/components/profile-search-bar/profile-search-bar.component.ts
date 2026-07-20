import { Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

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
        [placeholder]="resolvedPlaceholder()"
        (input)="searchChange.emit($any($event.target).value)"
        class="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg
               text-[14px] bg-white focus:outline-none focus:border-[#1b3a4b]
               placeholder:text-outline/50 transition-colors" />
    </div>
  `,
})
export class ProfileSearchBarComponent {
  private translate = inject(TranslateService);

  readonly value       = input('');
  readonly placeholder = input('');
  readonly searchChange = output<string>();

  readonly resolvedPlaceholder = computed(() => {
    this.translate.currentLang();
    return this.placeholder() || this.translate.instant('PROFILES.LIST.SEARCH_PLACEHOLDER');
  });
}
