import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CardComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EmployeeListItem } from '../../models/profile.model';
import { getInitials, isFemale } from '../../../../shared/utils/avatar.utils';
import {
  contractLabel, lifecycleDotColor, lifecycleDotGlow, lifecycleLabel,
} from '../../profile-labels';

@Component({
  selector: 'rh-profile-grid-card',
  standalone: true,
  imports: [CardComponent, TranslatePipe],
  template: `
    <daf-card
      [options]="{
        variant: 'glass',
        padding: 'none',
        radius: 'xl',
        hoverable: true,
        clickable: true,
      }"
      [style.box-shadow]="selected() ? '0 0 0 2px #3a6567' : null"
      (mouseenter)="hovered.set(true)"
      (mouseleave)="hovered.set(false)"
      (cardClick)="toggleSelected()"
    >
      <div
        class="relative p-5 h-80 flex flex-col overflow-hidden"
        [style.background-color]="selected() ? 'rgba(58,101,103,0.05)' : null"
      >
        <!-- Checkbox -->
        <div class="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            class="w-4 h-4 rounded cursor-pointer accent-[#3a6567]"
            [checked]="selected()"
            (click)="$event.stopPropagation()"
            (change)="handleSelect($any($event.target).checked)"
          />
        </div>

        <!-- Hover actions -->
        <div
          class="absolute top-3 right-3 flex gap-1 z-10
             bg-white/90 backdrop-blur-sm p-1 rounded-lg
             border border-outline-variant shadow-sm
             transition-opacity duration-200"
          [class.opacity-0]="!hovered()"
          [class.opacity-100]="hovered()"
          [class.pointer-events-none]="!hovered()"
        >
          <button
            type="button"
            class="p-1.5 text-outline rounded hover:text-[#3a6567]
               hover:bg-surface-container transition-colors"
            (click)="$event.stopPropagation(); viewProfile.emit(employee().profileId)"
          >
            <span class="material-symbols-outlined text-[18px]">visibility</span>
          </button>
          <button
            type="button"
            class="p-1.5 text-outline rounded hover:text-[#3a6567]
               hover:bg-surface-container transition-colors"
            (click)="$event.stopPropagation(); emitEdit()"
          >
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </div>

        <!-- Body row -->
        <div class="flex gap-5 flex-1 min-h-0 mt-4">
          <!-- LEFT: Avatar + Name + Grade -->
          <div
            class="w-[44%] shrink-0 flex flex-col items-center justify-center text-center overflow-hidden"
          >
            <!-- Circular: shape only — the size, border and fallback behaviour
                 below are unchanged. -->
            <div
              class="w-28 h-28 rounded-full overflow-hidden border border-outline-variant bg-surface-container shrink-0"
            >
              @if (photoSrc() !== null) {
                <!-- object-contain, not object-cover: "cover" fills the circle by
                     cropping whatever doesn't fit the square, which cut off the
                     edges of the photo. "contain" fits the whole image inside the
                     circle instead — nothing is cropped. The shape is unchanged;
                     the container still clips to a circle. -->
                <img
                  [src]="photoSrc()!"
                  [alt]="employee().fullName"
                  class="w-full h-full object-contain"
                  (error)="onImgError()"
                />
              } @else {
                <div
                  class="w-full h-full flex items-center justify-center"
                  [style.background-color]="initialsColor()"
                >
                  <span class="text-white text-2xl font-bold select-none">{{ initials() }}</span>
                </div>
              }
            </div>

            <h3
              class="mt-3 text-[15px] font-bold text-on-surface leading-tight line-clamp-2 w-full px-1"
            >
              {{ employee().fullName || '-' }}
            </h3>

            <span
              class="mt-1 text-label-caps font-bold text-on-surface-variant uppercase tracking-wider truncate w-full px-1"
            >
              {{ employee().grade || employee().roleName || '-' }}
            </span>
          </div>

          <!-- Vertical divider -->
          <div class="w-px self-stretch bg-outline-variant/40 shrink-0"></div>

          <!-- RIGHT: 4 data fields -->
          <div class="flex-1 flex flex-col justify-center overflow-hidden space-y-3">
            <div>
              <p
                class="text-label-caps font-bold uppercase tracking-wider text-on-surface-variant mb-0.5"
              >
                {{ 'PROFILES.CARD.PAYS' | translate }}
              </p>
              <p class="font-semibold text-[13px] text-on-surface truncate">
                {{ employee().paysLabel || '-' }}
              </p>
            </div>

            <div>
              <p
                class="text-label-caps font-bold uppercase tracking-wider text-on-surface-variant mb-0.5"
              >
                {{ 'PROFILES.CARD.CONTRACT_TYPE' | translate }}
              </p>
              <p class="font-semibold text-[13px] text-on-surface truncate">
                {{ contractLabel() }}
              </p>
            </div>

            <div>
              <p
                class="text-label-caps font-bold uppercase tracking-wider text-on-surface-variant mb-0.5"
              >
                {{ 'PROFILES.CARD.STATUS' | translate }}
              </p>
              <div class="flex items-center gap-1.5">
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  [style.background-color]="statusColor()"
                  [style.box-shadow]="statusGlow()"
                ></span>
                <p class="font-semibold text-[13px] text-on-surface uppercase truncate">
                  {{ statusLabel() }}
                </p>
              </div>
            </div>

            <div>
              <p
                class="text-label-caps font-bold uppercase tracking-wider text-on-surface-variant mb-0.5"
              >
                {{ 'PROFILES.CARD.HIRE_DATE' | translate }}
              </p>
              <p class="font-semibold text-[13px] text-on-surface">
                {{ employee().hireDate || '-' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </daf-card>
  `,
})
export class ProfileGridCardComponent {
  readonly employee = input.required<EmployeeListItem>();
  readonly selected = input<boolean>(false);
  readonly viewProfile = output<number | null>();
  readonly onSelect = output<{ userId: number; checked: boolean }>();
  readonly onEdit = output<number>();

  hovered = signal(false);

  private translate = inject(TranslateService);

  readonly contractLabel = computed((): string => {
    this.translate.currentLang();
    return contractLabel(this.employee().contractType, this.translate);
  });

  // 0 = try real photo, 1 = try gender avatar, 2 = show initials
  private readonly imgPhase = signal<0 | 1 | 2>(0);

  readonly photoSrc = computed((): string | null => {
    const emp = this.employee();
    const phase = this.imgPhase();
    const photoUrl =
      emp.photoUrl && emp.profileId ? `/api/hr/profiles/${emp.profileId}/photo` : null;
    const genderUrl = emp.gender
      ? isFemale(emp.gender)
        ? '/images/avatars/female.png'
        : '/images/avatars/male.png'
      : null;

    if (phase === 0) return photoUrl ?? genderUrl ?? null;
    if (phase === 1) return genderUrl ?? null;
    return null;
  });

  readonly initials = computed(() => getInitials(this.employee().fullName || '??'));
  readonly initialsColor = computed(() => {
    const palette = ['#3a6567', '#617f88', '#4a7c8f', '#2d5a6b', '#5a8a96', '#3d6b72'];
    const code = (this.employee().fullName || '').charCodeAt(0) || 0;
    return palette[code % palette.length];
  });

  readonly statusColor = computed(() => lifecycleDotColor(this.employee().lifecycleStatus));
  readonly statusGlow  = computed(() => lifecycleDotGlow(this.employee().lifecycleStatus));
  readonly statusLabel = computed(() => {
    this.translate.currentLang();
    return lifecycleLabel(this.employee().lifecycleStatus, this.translate);
  });

  onImgError(): void {
    const emp = this.employee();
    const hasRealPhoto = !!(emp.photoUrl && emp.profileId);
    this.imgPhase.update((p) => (p === 0 && hasRealPhoto ? 1 : 2));
  }

  handleSelect(checked: boolean): void {
    const id = this.employee().userId;
    if (id != null) this.onSelect.emit({ userId: id, checked });
  }

  /**
   * Clicking anywhere on the card toggles selection — it does NOT open the profile.
   * The profile is reached through the hover `visibility` button, which stops
   * propagation so it can't do both.
   */
  toggleSelected(): void {
    this.handleSelect(!this.selected());
  }

  emitEdit(): void {
    const id = this.employee().profileId;
    if (id != null) this.onEdit.emit(id);
  }
}
