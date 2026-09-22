import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ButtonComponent, CardComponent, FormFieldComponent, StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';

import { EmployeeListItem } from '../models/profile.model';
import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { asText } from './field-bridges';

/**
 * Left column of `/rh/profiles/user/:userId` — the sticky identity card, for a person who
 * has no `employee_profiles` row yet.
 *
 * A near-twin of {@link IdentityCardComponent} by design, not by accident: the two pages
 * sit at the same level of the same section and must read as one place, so this keeps its
 * sibling's chrome exactly — `daf-card` glass/xl/none, the `p-8` photo block, the 128px
 * ringed circle with the camera FAB over it, the name as a `<p>` (never an `h1` — that
 * belongs to `daf-page-header`), the pills row, then a divided `px-8 pb-8 pt-5` block.
 *
 * It cannot simply BE that component: `rh-identity-card` takes an `EmployeeProfile`, which
 * is the one thing that does not exist here. What differs beyond the input type is only
 * what the missing record forces:
 *
 * - **The photo is staged, not uploaded.** `POST /profiles/{id}/photo` is keyed by profile
 *   id, so there is nothing to upload to until the dossier exists. The circle previews a
 *   local `blob:` URL and the page sends the file immediately after creating the profile.
 * - **The name is editable here.** It lives on `Users.fullName`, not on the profile, so it
 *   is not one of the fields the creation form on the right can carry — and this card is
 *   where a name belongs on both pages.
 * - **Email and rôle are read-only.** Both are account fields: the email IS the login, and
 *   the rôle is changed from the users admin screen, which is gated on `GET_ROLES` /
 *   `HR_ADMIN_ROLES` — permissions someone creating a dossier need not hold.
 */
@Component({
  selector: 'rh-new-profile-identity-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent, ButtonComponent, FormFieldComponent, StatusBadgeComponent,
    ProfileFieldComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <daf-card [options]="{ variant: 'glass', radius: 'xl', padding: 'none' }">

      <!-- Photo · nom · pill -->
      <div class="flex flex-col items-center gap-1 p-8 text-center">
        <div class="relative mb-3">
          <div class="h-32 w-32 overflow-hidden rounded-full border-4 border-surface-container-lowest
                      bg-surface-container p-1.5 shadow-xl ring-1 ring-primary/10">
            @if (photoPreview(); as src) {
              <img [src]="src" [alt]="'PROFILES.DETAIL.PHOTO_ALT' | translate"
                   class="h-full w-full rounded-full object-cover object-top" />
            } @else {
              <!-- Initials, never the gendered placeholder: gender lives on the profile
                   too, so it is null for everyone on this page and the fallback would be
                   a coin flip drawn at 128px. (No backticks in an inline template's HTML
                   comments — they close the template literal; UI-PLAYBOOK §10f.) -->
              <span class="flex h-full w-full items-center justify-center rounded-full bg-primary/10
                           text-[28px] font-bold text-primary">{{ initials() }}</span>
            }
          </div>

          @if (canEdit()) {
            <!-- Same FAB as the dossier's. The <input> is a sibling the button clicks, not
                 a wrapping <label>: a nested <button> swallows label activation. -->
            <daf-button
              class="absolute -bottom-1 -right-1 opacity-70 transition-opacity hover:opacity-100"
              [options]="{ variant: 'primary', pill: true, size: 'sm', iconStart: 'photo_camera' }"
              [title]="'PROFILES.CREATE.PHOTO_PICK' | translate"
              (onClick)="fileInput.click()" />
            <input #fileInput type="file" accept="image/jpeg,image/png,image/webp" hidden
                   (change)="onFilePicked($event)" />
          }
        </div>

        @if (canEdit()) {
          <!-- The name is a form control here, so it gets no <p> twin above it — two
               renderings of one value is how they drift. -->
          <daf-form-field class="w-full text-left"
            [options]="{
              label: ('PROFILES.CREATE.FULL_NAME' | translate),
              placeholder: ('PROFILES.CREATE.FULL_NAME_PH' | translate),
              error: nameError() || undefined
            }"
            [value]="fullName()"
            (valueChange)="fullNameChange.emit(asText($event))" />
        } @else {
          <p class="max-w-full wrap-break-word text-headline-lg font-black leading-tight text-on-surface">
            {{ fullName() || '—' }}
          </p>
        }

        @if (user().roleName) {
          <p class="max-w-full wrap-break-word text-[14px] font-medium text-outline">{{ user().roleName }}</p>
        }

        <div class="mt-3 flex flex-wrap justify-center gap-2">
          <daf-badge
            [label]="'PROFILES.CREATE.NO_PROFILE_BADGE' | translate"
            [options]="{ variant: 'warning', size: 'sm', pill: true }" />
          @if (user().paysLabel) {
            <daf-badge [label]="user().paysLabel!" [options]="{ variant: 'neutral', size: 'sm', pill: true }" />
          }
        </div>

        @if (photoPreview()) {
          <p class="mt-3 text-[11px] leading-snug text-outline">
            {{ 'PROFILES.CREATE.PHOTO_PENDING' | translate }}
          </p>
        }
      </div>

      <!-- Compte — what already exists for this person, and cannot be changed from here -->
      <div class="border-t border-outline-variant/40 px-8 pb-8 pt-5">
        <h2 class="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-outline">
          <span class="material-symbols-outlined text-body-lg">badge</span>
          {{ 'PROFILES.CREATE.SECTION_ACCOUNT' | translate }}
        </h2>

        <div class="flex flex-col">
          <rh-profile-field variant="row"
            [label]="'PROFILES.CREATE.ACCOUNT_EMAIL' | translate" [value]="user().email" />
          <rh-profile-field variant="row"
            [label]="'PROFILES.CREATE.ACCOUNT_ROLE' | translate" [value]="user().roleName" />
          <rh-profile-field variant="row" [last]="true"
            [label]="'PROFILES.CREATE.ACCOUNT_USER_ID' | translate" [value]="String(user().userId)" />
        </div>

        <p class="mt-5 text-[11px] leading-snug text-outline">
          {{ 'PROFILES.CREATE.ACCOUNT_HINT' | translate }}
        </p>
      </div>

    </daf-card>
  `,
})
export class NewProfileIdentityCardComponent {
  readonly user     = input.required<EmployeeListItem>();
  readonly fullName = input<string>('');
  /** A `blob:` URL for the staged file, or null while none is chosen. */
  readonly photoPreview = input<string | null>(null);
  readonly nameError = input<string | null>(null);
  /** `HR_CREATE_PROFILE` — without it the card is a read-only summary. */
  readonly canEdit = input(false);

  readonly fullNameChange = output<string>();
  /** The raw picked file; the page validates type/size and owns the object URL. */
  readonly photoPicked = output<File>();

  protected readonly asText = asText;
  /** `String` is not in a template's scope; `userId` is a number and the field takes text. */
  protected readonly String = String;

  protected readonly initials = computed(() => {
    const parts = (this.fullName() || this.user().fullName || '').trim().split(/\s+/);
    const from = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return from ? from.toUpperCase() : '?';
  });

  /**
   * Re-emits the picked file, then clears the input so choosing the *same* file twice still
   * fires `change` — the browser suppresses it otherwise, which reads as a dead button
   * after a file the page rejected for size or type.
   */
  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.photoPicked.emit(file);
    input.value = '';
  }
}
