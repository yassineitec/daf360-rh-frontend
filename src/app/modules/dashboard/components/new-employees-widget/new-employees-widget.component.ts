import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

export interface NouveauItem {
  profileId:  number | null;
  fullName:   string;
  hireDate:   string | null;
  grade:      string | null;
  department: string | null;
}

@Component({
  selector: 'rh-new-employees-widget',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm">
      <h3 class="flex items-center gap-2 text-[14px] font-bold text-on-surface mb-4">
        <span class="material-symbols-outlined text-[20px]" style="color: #79D7BE;">person_add</span>
        Nouveaux employés
      </h3>
      <div class="space-y-3">
        @for (item of items(); track item.fullName) {
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center
                        text-[10px] font-bold text-on-surface shrink-0">
              {{ initials(item.fullName) }}
            </div>
            <div>
              <p class="text-[13px] font-bold text-on-surface leading-tight">{{ item.fullName }}</p>
              <p class="text-[11px] text-outline">
                {{ item.grade ?? '—' }} • {{ item.hireDate | date:'d MMM' }}
              </p>
            </div>
          </div>
        } @empty {
          <p class="text-[13px] text-outline text-center py-2">Aucun nouvel employé récemment</p>
        }
      </div>
    </div>
  `,
})
export class NewEmployeesWidgetComponent {
  readonly items = input.required<NouveauItem[]>();

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  }
}
