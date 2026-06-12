import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

export interface AnniversaireItem {
  profileId:   number | null;
  fullName:    string;
  dateOfBirth: string | null;
}

@Component({
  selector: 'rh-anniversary-widget',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm">
      <h3 class="flex items-center gap-2 text-[14px] font-bold text-on-surface mb-4">
        <span class="material-symbols-outlined text-[20px]" style="color: #79D7BE;">cake</span>
        Anniversaires du mois
      </h3>
      <ul class="space-y-3">
        @for (item of items(); track item.fullName) {
          <li class="flex items-center justify-between">
            <span class="text-[14px] text-on-surface">{{ item.fullName }}</span>
            <span class="text-[12px] font-medium text-outline">
              {{ item.dateOfBirth | date:'d MMM' }}
            </span>
          </li>
        } @empty {
          <li class="text-[13px] text-outline text-center py-2">
            Aucun anniversaire ce mois
          </li>
        }
      </ul>
    </div>
  `,
})
export class AnniversaryWidgetComponent {
  readonly items = input.required<AnniversaireItem[]>();
}
