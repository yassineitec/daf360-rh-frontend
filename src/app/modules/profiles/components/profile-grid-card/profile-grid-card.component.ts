import { Component, input, output, signal } from '@angular/core';
import { EmployeeListItem } from '../../models/profile.model';
import { avatarUrl, getAvatarUrl } from '../../../../shared/utils/avatar.utils';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'rh-profile-grid-card',
  standalone: true,
  template: `
    <div class="bg-white rounded-2xl p-5 hover:shadow-lg transition-all relative cursor-pointer"
         [class.border-2]="selected()"
         [class.shadow-md]="selected()"
         [class.border]="!selected()"
         [class.border-outline-variant]="!selected()"
         [style.border-color]="selected() ? '#50717B' : null"
         [style.background-color]="selected() ? 'rgba(80,113,123,0.05)' : null"
         (mouseenter)="hovered.set(true)"
         (mouseleave)="hovered.set(false)">

      <!-- Checkbox (top-left) -->
      <div class="absolute top-3 left-3 z-10">
        <input
          type="checkbox"
          class="w-4 h-4 rounded accent-[#50717B] cursor-pointer"
          [checked]="selected()"
          (click)="$event.stopPropagation()"
          (change)="handleSelect($any($event.target).checked)" />
      </div>

      <!-- Hover quick actions (top-right) -->
      <div class="absolute top-3 right-3 flex gap-1 z-10
                  bg-white/90 backdrop-blur-sm p-1 rounded-lg
                  border border-outline-variant shadow-sm
                  transition-opacity duration-200"
           [class.opacity-0]="!hovered()"
           [class.opacity-100]="hovered()"
           [class.pointer-events-none]="!hovered()">
        <button
          type="button"
          class="p-1.5 text-outline rounded hover:text-[#50717B]
                 hover:bg-surface-container transition-colors"
          (click)="$event.stopPropagation(); emitEdit()">
          <span class="material-symbols-outlined text-[18px]">edit</span>
        </button>
        <button
          type="button"
          class="p-1.5 text-outline rounded hover:text-error
                 hover:bg-error-container transition-colors"
          (click)="$event.stopPropagation(); emitDelete()">
          <span class="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>

      <!-- Avatar + info -->
      <div class="flex items-start gap-4 mt-1">
        <div class="w-14 h-14 rounded-full border-2 border-[#79d7be] overflow-hidden shrink-0">
          <img
            [src]="getAvatarUrl(employee().profileId, employee().photoUrl, employee().gender)"
            [alt]="employee().fullName"
            class="w-full h-full object-cover" />
        </div>
        <div class="min-w-0">
          <h3 class="text-[15px] font-bold text-on-surface truncate">{{ employee().fullName }}</h3>
          <p class="text-[13px] text-outline truncate">
            {{ employee().roleName ?? '—' }}{{ employee().department ? ' · ' + employee().department : '' }}
          </p>
        </div>
      </div>

      <!-- Location -->
      @if (employee().paysLabel) {
        <div class="flex items-center gap-1 mt-3">
          <span class="material-symbols-outlined text-[14px] text-outline">location_on</span>
          <span class="text-[13px] text-outline">{{ employee().paysLabel }}</span>
        </div>
      }

      <!-- Tags -->
      <div class="flex gap-2 mt-2 flex-wrap">
        @if (employee().paysLabel) {
          <span class="px-2 py-0.5 bg-surface-container rounded text-[10px]
                       font-bold text-on-surface-variant uppercase">
            {{ employee().paysLabel }}
          </span>
        }
        @if (employee().grade) {
          <span class="px-2 py-0.5 bg-surface-container rounded text-[10px]
                       font-bold text-on-surface-variant uppercase">
            {{ employee().grade }}
          </span>
        }
      </div>

      <!-- Buttons -->
      <div class="flex gap-2 mt-4">
        <button
          type="button"
          class="flex-1 py-2 bg-[#617f88] text-white rounded-lg text-[13px]
                 font-semibold hover:opacity-90 transition-opacity"
          (click)="viewProfile.emit(employee().profileId)">
          Voir profil
        </button>
        <button
          type="button"
          class="px-3 py-2 border border-outline-variant rounded-lg
                 hover:bg-surface-container transition-colors"
          (click)="moreActions.emit(employee().profileId)">
          <span class="material-symbols-outlined text-[16px] text-on-surface-variant">
            more_horiz
          </span>
        </button>
      </div>

    </div>
  `,
})
export class ProfileGridCardComponent {
  readonly employee    = input.required<EmployeeListItem>();
  readonly selected    = input<boolean>(false);
  readonly viewProfile = output<number | null>();
  readonly moreActions = output<number | null>();
  readonly onSelect    = output<{ userId: number; checked: boolean }>();
  readonly onEdit      = output<number>();
  readonly onDelete    = output<number>();
  readonly avatarUrl    = avatarUrl;
  readonly getAvatarUrl = getAvatarUrl;

  hovered = signal(false);

  resolvePhoto(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('/api/')) return environment.hrApiUrl + url;
    return url;
  }

  handleSelect(checked: boolean): void {        
    const id = this.employee().userId;
    if (id != null) this.onSelect.emit({ userId: id, checked });
  }

  emitEdit(): void {
    const id = this.employee().userId;
    if (id != null) this.onEdit.emit(id);
  }

  emitDelete(): void {
    const id = this.employee().userId;
    if (id != null) this.onDelete.emit(id);
  }
}
