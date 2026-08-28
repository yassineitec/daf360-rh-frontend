import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CardComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EmployeeListItem } from '../../models/profile.model';
import { getInitials, isFemale, profilePhotoUrl } from '../../../../shared/utils/avatar.utils';
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
              class="relative w-28 h-28 rounded-full overflow-hidden border border-outline-variant bg-surface-container shrink-0"
            >
              <!-- Shimmer UNDER the image, not instead of it: the <img> is in the DOM from the
                   start (so the request begins immediately) and simply fades in over this once
                   it decodes. Rendering the image only after load would delay the request by a
                   change-detection cycle and cost more than it saves. -->
              @if (photoSrc() !== null && !imgLoaded()) {
                <!-- bg-on-surface/10, NOT bg-surface-container-high: styles.css aliases that
                     token to --color-surface-container, which is this circle's own background,
                     so the shimmer would have pulsed invisibly. A translucent ink tone works
                     against both themes' surfaces. -->
                <div class="absolute inset-0 animate-pulse bg-on-surface/10"></div>
              }
              @if (photoSrc() !== null) {
                <!-- object-cover object-top, and both halves matter.
                     NOT object-contain: that fits the whole photo inside the circle, which
                     letterboxes a portrait into a rectangle and exposes bg-surface-container
                     around it — grey bars that read as a rendering fault whenever the photo's
                     own background is a different colour.
                     NOT a centred or 25%-biased crop either: the photos here vary from tight
                     ID headshots to full-body shots, and any fixed midpoint crops the head off
                     whichever ones are taller than that guess. Anchoring to the TOP edge cannot
                     do that — "cover" only ever crops the far edge, so the top of the frame,
                     which is where a face is, always survives. What gets sacrificed is the
                     bottom: shoulders and chest, which no one identifies a colleague by. -->
                <!-- The 3 fallback phases below (photo → gendered avatar → initials) and the
                     shimmer above are unchanged by this. -->
                <img
                  [src]="photoSrc()!"
                  [alt]="employee().fullName"
                  decoding="async"
                  class="w-full h-full object-cover object-top transition-opacity duration-300"
                  [class.opacity-0]="!imgLoaded()"
                  (load)="imgLoaded.set(true)"
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

  /** Whether the current `photoSrc()` has decoded. Drives the shimmer and the fade — the photo
   *  arrives from SharePoint on a cold cache, so an empty circle is the honest default state,
   *  not an error. Reset on every phase change: the fallback avatar is a new request and has to
   *  earn its own reveal, otherwise it pops in without the transition. */
  readonly imgLoaded = signal(false);

  readonly photoSrc = computed((): string | null => {
    const emp = this.employee();
    const phase = this.imgPhase();
    // Through the shared helper, not built inline: it adds ?size=sm (the circle is 112px and the
    // cached master 512px) AND carries the `v=` cache-busting token out of photo_url. Building
    // the URL here by hand dropped that token, so a replaced photo kept showing the old face in
    // the grid for the seven days the endpoint's Cache-Control advertises.
    const photoUrl = profilePhotoUrl(emp.profileId, emp.photoUrl, 'sm');
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
    this.imgLoaded.set(false);
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
