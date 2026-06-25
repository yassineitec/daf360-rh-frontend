import { Component, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { CardComponent } from '@khalilrebhiitec/daf360';
import { getAvatarUrl } from '../../../../shared/utils/avatar.utils';

export interface NouveauItem {
  profileId:  number | null;
  fullName:   string;
  hireDate:   string | null;
  grade:      string | null;
  department: string | null;
  photoUrl:   string | null;
  gender:     string | null;
}

@Component({
  selector: 'rh-new-employees-widget',
  standalone: true,
  imports: [DatePipe, TranslatePipe, CardComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'md', radius: 'xl' }">
      <h3 class="flex items-center gap-2 text-[14px] font-bold text-on-surface mb-4">
        <span class="material-symbols-outlined text-[20px]" style="color: #79D7BE;">person_add</span>
        {{ 'DASHBOARD.NEW_EMPLOYEES.TITLE' | translate }}
      </h3>
      <div class="space-y-3">
        @for (item of items(); track item.fullName) {
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center
                        text-[10px] font-bold text-on-surface shrink-0 overflow-hidden">
              @if (!failed().has(item.profileId ?? item.fullName)) {
                <img [src]="getAvatarUrl(item.profileId, item.photoUrl, item.gender)"
                     [alt]="item.fullName"
                     class="w-full h-full object-cover"
                     (error)="onError(item.profileId ?? item.fullName)" />
              } @else {
                {{ initials(item.fullName) }}
              }
            </div>
            <div>
              <p class="text-[13px] font-bold text-on-surface leading-tight">{{ item.fullName }}</p>
              <p class="text-[11px] text-outline">
                {{ item.grade ?? '—' }} • {{ item.hireDate | date:'d MMM' }}
              </p>
            </div>
          </div>
        } @empty {
          <p class="text-[13px] text-outline text-center py-2">
            {{ 'DASHBOARD.NEW_EMPLOYEES.EMPTY' | translate }}
          </p>
        }
      </div>
    </daf-card>
  `,
})
export class NewEmployeesWidgetComponent {
  readonly items       = input.required<NouveauItem[]>();
  readonly getAvatarUrl = getAvatarUrl;
  readonly failed       = signal(new Set<number | string>());

  onError(key: number | string): void {
    this.failed.update(s => new Set(s).add(key));
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  }
}
