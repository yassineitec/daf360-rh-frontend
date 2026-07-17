import { Component, input, output, signal } from '@angular/core';
import { CardComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe } from '@ngx-translate/core';
import { EmployeeListItem } from '../../models/profile.model';
import { avatarUrl, getAvatarUrl } from '../../../../shared/utils/avatar.utils';
import { statusBadge } from '../../../../shared/status-badge.utils';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'rh-profile-list-card',
  standalone: true,
  imports: [StatusBadgeComponent, CardComponent, TranslatePipe],
  template: `
    <daf-card
      [options]="{ variant: 'glass', padding: 'none', radius: 'xl', hoverable: true }"
      [style.box-shadow]="selected() ? '0 0 0 2px #50717B' : null"
      (mouseenter)="hovered.set(true)"
      (mouseleave)="hovered.set(false)"
    >
      <div
        class="p-4 flex items-center gap-4 relative"
        [style.background-color]="selected() ? 'rgba(80,113,123,0.05)' : null"
      >
        <!-- Checkbox -->
        <div class="shrink-0">
          <input
            type="checkbox"
            class="w-4 h-4 rounded accent-teal cursor-pointer"
            [checked]="selected()"
            (click)="$event.stopPropagation()"
            (change)="handleSelect($any($event.target).checked)"
          />
        </div>

        <!-- Avatar -->
        <div class="w-12 h-12 rounded-full border border-[#79D7BE] overflow-hidden shrink-0">
          <img
            [src]="getAvatarUrl(employee().profileId, employee().photoUrl, employee().gender)"
            [alt]="employee().fullName"
            class="w-full h-full object-cover"
          />
        </div>

        <!-- Info block -->
        <div class="flex-1 min-w-0">
          <!-- Row 1: name + tags -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[14px] font-bold text-on-surface">{{ employee().fullName }}</span>
            @if (employee().paysLabel) {
              <span
                class="px-2 py-0.5 bg-surface-container rounded text-label-caps
                           font-bold text-on-surface-variant uppercase"
              >
                {{ employee().paysLabel }}
              </span>
            }
            @if (employee().grade) {
              <span
                class="px-2 py-0.5 bg-surface-container rounded text-label-caps
                           font-bold text-on-surface-variant uppercase"
              >
                {{ employee().grade }}
              </span>
            }
          </div>
          <!-- Row 2: role · dept -->
          <p class="text-[13px] text-outline truncate mt-0.5">
            {{ employee().roleName ?? '—'
            }}{{ employee().department ? ' · ' + employee().department : '' }}
          </p>
          <!-- Row 3: meta -->
          <div class="flex flex-wrap gap-4 mt-1">
            @if (employee().paysLabel) {
              <span class="flex items-center gap-1 text-[12px] text-outline">
                <span class="material-symbols-outlined text-[14px]">location_on</span>
                {{ employee().paysLabel }}
              </span>
            }
            @if (employee().email) {
              <span class="flex items-center gap-1 text-[12px] text-outline max-w-45 truncate">
                <span class="material-symbols-outlined text-[14px]">mail</span>
                {{ employee().email }}
              </span>
            }
            @if (employee().hireDate) {
              <span class="flex items-center gap-1 text-[12px] text-outline">
                <span class="material-symbols-outlined text-[14px]">calendar_today</span>
                {{ formatDate(employee().hireDate) }}
              </span>
            }
          </div>
        </div>

        <!-- Status badge -->
        <div class="shrink-0">
          @if (employee().lifecycleStatus) {
            <daf-badge
              [label]="statusBadge(employee().lifecycleStatus!).label"
              [options]="statusBadge(employee().lifecycleStatus!).options"
            />
          }
        </div>

        <!-- Actions -->
        <div class="flex gap-2 shrink-0 items-center">
          <!-- Hover quick actions (edit + delete) -->
          <div
            class="flex gap-1 transition-opacity duration-200"
            [class.opacity-0]="!hovered()"
            [class.opacity-100]="hovered()"
            [class.pointer-events-none]="!hovered()"
          >
            <button
              type="button"
              class="p-2 rounded-lg border border-outline-variant text-outline
                     hover:text-teal hover:border-teal transition-colors"
              (click)="$event.stopPropagation(); emitEdit()"
            >
              <span class="material-symbols-outlined text-body-lg">edit</span>
            </button>
            <button
              type="button"
              class="p-2 rounded-lg border border-outline-variant text-outline
                     hover:text-danger hover:border-danger transition-colors"
              (click)="$event.stopPropagation(); emitDelete()"
            >
              <span class="material-symbols-outlined text-body-lg">delete</span>
            </button>
          </div>

          <!-- Primary actions -->
          <button
            type="button"
            class="px-4 py-2 bg-[#1b3a4b] text-white rounded-lg text-[13px]
                   font-semibold hover:opacity-90 transition-opacity"
            (click)="viewProfile.emit(employee().profileId)"
          >
            {{ 'PROFILES.CARD.VIEW_PROFILE' | translate }}
          </button>
          <button
            type="button"
            class="px-3 py-2 border border-outline-variant rounded-lg
                   hover:bg-surface-container transition-colors"
            (click)="moreActions.emit(employee().profileId)"
          >
            <span class="material-symbols-outlined text-body-lg text-on-surface-variant">
              more_horiz
            </span>
          </button>
        </div>
      </div>
    </daf-card>
  `,
})
export class ProfileListCardComponent {
  readonly employee = input.required<EmployeeListItem>();
  readonly selected = input<boolean>(false);
  readonly viewProfile = output<number | null>();
  readonly moreActions = output<number | null>();
  readonly onSelect = output<{ userId: number; checked: boolean }>();
  readonly onEdit = output<number>();
  readonly onDelete = output<number>();
  readonly avatarUrl = avatarUrl;
  readonly getAvatarUrl = getAvatarUrl;
  readonly statusBadge = statusBadge;

  hovered = signal(false);

  handleSelect(checked: boolean): void {
    const id = this.employee().userId;
    if (id != null) this.onSelect.emit({ userId: id, checked });
  }

  emitEdit(): void {
    const id = this.employee().profileId;
    if (id != null) this.onEdit.emit(id);
  }

  emitDelete(): void {
    const id = this.employee().profileId;
    if (id != null) this.onDelete.emit(id);
  }

  resolvePhoto(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('/api/')) return environment.hrApiUrl + url;
    return url;
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
