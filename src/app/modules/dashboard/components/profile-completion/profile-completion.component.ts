import { Component, input } from '@angular/core';
import { ProgressBarComponent } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'rh-profile-completion',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [ProgressBarComponent],
  template: `
    <div class="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant
                shadow-sm flex flex-col justify-between h-full">
      <div>
        <p class="text-[11px] text-outline uppercase tracking-wider mb-2">Profile Completion</p>
        <div class="flex items-baseline gap-2 mb-4">
          <p class="text-[20px] font-bold text-on-surface">{{ tauxGlobalPct() }}%</p>
          <p class="text-[12px] text-error font-medium">
            {{ dossiersIncomplets() }} dossiers incomplets
          </p>
        </div>
        <daf-progress-bar
          [value]="tauxGlobalPct()"
          [options]="{ variant: 'teal', animated: true }" />
      </div>
      <button
        type="button"
        class="mt-6 flex items-center gap-1 text-[13px] text-secondary font-bold hover:underline">
        <span class="material-symbols-outlined text-[18px]">notifications_active</span>
        Relancer les employés
      </button>
    </div>
  `,
})
export class ProfileCompletionComponent {
  readonly tauxGlobalPct      = input.required<number>();
  readonly dossiersIncomplets = input.required<number>();
}
