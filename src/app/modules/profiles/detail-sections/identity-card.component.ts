import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ButtonComponent, CardComponent, SelectOption, StatusBadgeComponent, BadgeVariant,
} from '@khalilrebhiitec/daf360';

import { EmployeeProfile, ProfileUpdateDto } from '../models/profile.model';
import { IdentitySectionComponent } from './identity-section.component';
import { avatarUrl } from '../../../shared/utils/avatar.utils';

export interface IdentityPill {
  label: string;
  variant: BadgeVariant;
}

/**
 * Left column of `/rh/profiles/:id` — the sticky identity card from
 * `design/profile-detail.html`: photo, name, status pills, then *État civil &
 * Identité* inline.
 *
 * Identité is the one section that is **not** a tab: the design keeps it on
 * screen at all times next to whichever tab is open.
 *
 * The photo affordance is the design's circular FAB over the avatar, not the old
 * full-cover hover overlay — same upload logic, different trigger. The name is a
 * `<p>`, not a heading: `daf-page-header` owns the page's single `h1`.
 */
@Component({
  selector: 'rh-identity-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent, ButtonComponent, StatusBadgeComponent,
    IdentitySectionComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <daf-card [options]="{ variant: 'glass', radius: 'xl', padding: 'none' }">

      <!-- Photo · nom · pills -->
      <div class="flex flex-col items-center gap-1 p-8 text-center">
        <div class="relative mb-3">
          <!-- p-1.5 pulls the photo in from the rim: object-cover always fills the
               circle at the smallest scale that can, so it cannot be zoomed out —
               insetting the image is what shows a little more of it. object-top
               then crops from the bottom rather than the middle, which keeps the
               face in frame on portrait shots. -->
          <div class="h-32 w-32 overflow-hidden rounded-full border-4 border-surface-container-lowest
                      bg-surface-container p-1.5 shadow-xl ring-1 ring-primary/10">
            <!-- Three-step fallback: uploaded photo → gender avatar → initials.
                 Each step also degrades on a load error, so a broken or deleted
                 file on disk still lands on something rather than a torn image. -->
            @if (imageSrc(); as src) {
              <img [src]="src" [alt]="'PROFILES.DETAIL.PHOTO_ALT' | translate"
                   class="h-full w-full rounded-full object-cover object-top"
                   (error)="onImageError()" />
            } @else {
              <span class="flex h-full w-full items-center justify-center rounded-full bg-primary/10
                           text-[28px] font-bold text-primary">{{ initials() }}</span>
            }
          </div>

          @if (canEdit()) {
            <!-- The button opens the picker programmatically. It used to be a
                 daf-button *inside* a <label>: a nested <button> swallows the
                 click, so label activation never reached the input and nothing
                 happened. Translucent so it sits on the photo rather than
                 punching a solid disc through it. -->
            <daf-button
              class="absolute -bottom-1 -right-1 opacity-70 transition-opacity hover:opacity-100"
              [options]="{
                variant: 'primary', pill: true, size: 'sm',
                iconStart: uploading() ? 'progress_activity' : 'photo_camera',
                loading: uploading(), disabled: uploading()
              }"
              [title]="(uploading() ? 'PROFILES.DETAIL.PHOTO_UPLOADING' : 'PROFILES.DETAIL.PHOTO_CHANGE') | translate"
              (onClick)="fileInput.click()" />
            <input #fileInput type="file" accept="image/jpeg,image/png,image/webp" hidden
                   [disabled]="uploading()" (change)="onFilePicked($event)" />
          }
        </div>

        <p class="text-[20px] font-black leading-tight text-on-surface">{{ profile().fullName ?? '—' }}</p>
        @if (profile().grade) {
          <p class="text-[14px] font-medium text-outline">{{ profile().grade }}</p>
        }

        @if (pills().length) {
          <div class="mt-3 flex flex-wrap justify-center gap-2">
            @for (pill of pills(); track pill.label) {
              <daf-badge [label]="pill.label" [options]="{ variant: pill.variant, size: 'sm', pill: true }" />
            }
          </div>
        }

      </div>

      <!-- État civil & identité -->
      <div class="border-t border-outline-variant/40 px-8 pb-8 pt-5">
        <h2 class="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-outline">
          <span class="material-symbols-outlined text-[16px]">badge</span>
          {{ 'PROFILES.SECTIONS.IDENTITY' | translate }}
        </h2>

        <rh-identity-section
          [profile]="profile()"
          [editMode]="editMode()"
          [editForm]="editForm()"
          [columns]="2"
          [genderOptions]="genderOptions()"
          [maritalStatusOptions]="maritalStatusOptions()"
          [nationalityOptions]="nationalityOptions()"
          (patch)="patch.emit($event)" />

        <!-- Actions, at the foot of the card as in the design. -->
        @if (canTransition() || canEdit()) {
          <div class="mt-8 flex gap-3">
            @if (canTransition()) {
              <daf-button class="flex-1"
                [options]="{ variant: 'primary', fullWidth: true, size: 'sm',
                             label: ('PROFILES.DETAIL.CHANGE_STATUS' | translate) }"
                (onClick)="changeStatus.emit()" />
            }
            @if (canEdit()) {
              <!-- One button, two states: Modifier while viewing, Annuler while
                   editing — and the save bar only exists in the second state. -->
              <daf-button
                [options]="{
                  variant: editMode() ? 'ghost' : 'teal', size: 'sm',
                  label: (editMode() ? 'PROFILES.COMMON.CANCEL' : 'PROFILES.COMMON.EDIT') | translate
                }"
                (onClick)="toggleEdit.emit()" />
            }
          </div>
        }

      </div>

    </daf-card>
  `,
})
export class IdentityCardComponent {
  readonly profile   = input.required<EmployeeProfile>();
  readonly editMode  = input(false);
  readonly editForm  = input.required<ProfileUpdateDto>();
  readonly photoSrc  = input<string | null>(null);
  readonly canEdit   = input(false);
  readonly uploading = input(false);
  readonly pills     = input<IdentityPill[]>([]);
  readonly canTransition = input(false);

  readonly genderOptions        = input<SelectOption[]>([]);
  readonly maritalStatusOptions = input<SelectOption[]>([]);
  readonly nationalityOptions   = input<SelectOption[]>([]);

  readonly photoChange  = output<Event>();
  readonly patch        = output<Partial<ProfileUpdateDto>>();
  readonly changeStatus = output<void>();
  readonly toggleEdit   = output<void>();

  /** Which step of the photo → avatar → initials chain has failed to load. */
  private readonly photoFailed  = signal(false);
  private readonly avatarFailed = signal(false);

  /** The gender avatar, or null when gender is unknown so we fall through to initials. */
  private readonly genderAvatar = computed(() => {
    const g = this.profile().gender?.trim().toUpperCase();
    return !g || g === 'UNSPECIFIED' ? null : avatarUrl(this.profile().gender);
  });

  protected readonly imageSrc = computed(() => {
    const photo = this.photoSrc();
    if (photo && !this.photoFailed()) return photo;
    const avatar = this.genderAvatar();
    return avatar && !this.avatarFailed() ? avatar : null;
  });

  /**
   * Re-emits the picked file, then clears the input so choosing the *same* file
   * twice still fires `change` (the browser suppresses it otherwise, which reads
   * as "the button stopped working" after a failed upload).
   */
  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.photoChange.emit(event);
    input.value = '';
  }

  protected onImageError(): void {
    if (this.photoSrc() && !this.photoFailed()) this.photoFailed.set(true);
    else this.avatarFailed.set(true);
  }

  protected readonly initials = computed(() => {
    const p = this.profile();
    const parts = (p.fullName ?? '').trim().split(/\s+/);
    const from = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return from ? from.toUpperCase() : 'P' + p.id;
  });
}
