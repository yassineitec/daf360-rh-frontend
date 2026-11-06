import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CardComponent, ProgressBarComponent } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'rh-profile-completion',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [ProgressBarComponent, TranslatePipe, CardComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl', fullHeight: true, hoverable: true }">
      <div class="flex flex-col justify-between h-full">
      <div>
        <p class="text-[11px] text-outline uppercase tracking-wider mb-2">
          {{ 'HOME.PROFILE_COMPLETION.LABEL' | translate }}
        </p>
        <div class="flex items-baseline gap-2 mb-4">
          <p class="text-[20px] font-bold text-on-surface">{{ tauxGlobalPct() }}%</p>
          <p class="text-[12px] text-error font-medium">
            {{ 'HOME.PROFILE_COMPLETION.INCOMPLETE' | translate:{ count: dossiersIncomplets() } }}
          </p>
        </div>
        <daf-progress-bar
          [value]="tauxGlobalPct()"
          [options]="{ variant: 'tertiary', animated: true }" />
      </div>
      <!-- No « Relancer les employés » button: it had no handler, and the backend has no
           reminder to send. HOME.PROFILE_COMPLETION.REMIND is kept for when it does. -->
      </div>
    </daf-card>
  `,
})
export class ProfileCompletionComponent {
  readonly tauxGlobalPct      = input.required<number>();
  readonly dossiersIncomplets = input.required<number>();
}
