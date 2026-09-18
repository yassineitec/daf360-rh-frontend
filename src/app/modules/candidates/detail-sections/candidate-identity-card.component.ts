import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeVariant, ButtonComponent, CardComponent, FormFieldComponent,
  MultiDatePickerComponent, SelectComponent, SelectOption, StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';

import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import {
  asText, fromDate, fromSelected, toDate, toSelected,
} from '../../../shared/detail/field-bridges';
import { genderLabel } from '../../../shared/utils/gender.utils';
import { CandidateDetail, UpdateCandidateRequest } from '../candidate.model';
import { candidateAvatar, candidateInitials, formatDate } from '../candidate-display';

export interface CandidatePill {
  label: string;
  variant: BadgeVariant;
}

/**
 * Left column of `/rh/candidates/:id` — the sticky identity card, mirroring
 * `rh-identity-card` on `/rh/profiles/:id`: avatar, name, position, status pills,
 * then the candidate's own details inline.
 *
 * Coordonnées is the one section that is **not** a tab, exactly as *État civil &
 * Identité* isn't one on the profile page: it stays on screen next to whichever
 * tab is open — and so, like there, it is editable in place.
 *
 * No photo FAB — a candidate has no photo endpoint, so the avatar is the gender
 * illustration with an initials fallback and nothing to upload.
 *
 * The name is a `<p>`, not a heading: `daf-page-header` owns the page's single `h1`.
 *
 * Stateless: it reads `editForm` and emits a partial on every change, never
 * mutating what it was handed, so the page stays the single owner of the pending
 * edit. Default change detection for the same reason the profile sections use it —
 * these host live controls bound to a plain DTO.
 */
@Component({
  selector: 'rh-candidate-identity-card',
  standalone: true,
  imports: [
    CardComponent, ButtonComponent, StatusBadgeComponent, ProfileFieldComponent,
    FormFieldComponent, MultiDatePickerComponent, SelectComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <daf-card [options]="{ variant: 'glass', radius: 'xl', padding: 'none' }">

      <!-- Avatar · nom · pills -->
      <div class="flex flex-col items-center gap-1 p-8 text-center">
        <div class="mb-3">
          <div class="h-32 w-32 overflow-hidden rounded-full border-4 border-surface-container-lowest
                      bg-surface-container p-1.5 shadow-xl ring-1 ring-primary/10">
            @if (avatar(); as src) {
              <img [src]="src" [alt]="candidate().firstName + ' ' + candidate().lastName"
                   class="h-full w-full rounded-full object-cover object-top" />
            } @else {
              <span class="flex h-full w-full items-center justify-center rounded-full bg-primary/10
                           text-[28px] font-bold text-primary">{{ initials() }}</span>
            }
          </div>
        </div>

        <!-- The name is a heading while reading and two fields while editing. It is
             the only piece of the card that changes SHAPE in edit mode: everything
             else swaps a value for a control in place. -->
        @if (!editMode()) {
          <p class="max-w-full wrap-break-word text-[20px] font-black leading-tight text-on-surface">
            {{ candidate().firstName }} {{ candidate().lastName }}
          </p>
          @if (candidate().appliedPosition) {
            <p class="max-w-full wrap-break-word text-[14px] font-medium text-outline">
              {{ candidate().appliedPosition }}
            </p>
          }
        } @else {
          <div class="mt-2 grid w-full grid-cols-2 gap-3 text-left">
            <daf-form-field
              [options]="{ label: ('CANDIDATES.DETAIL.FIRST_NAME' | translate) }"
              [value]="editForm().firstName ?? ''"
              (valueChange)="patch.emit({ firstName: asText($event) })" />
            <daf-form-field
              [options]="{ label: ('CANDIDATES.DETAIL.LAST_NAME' | translate) }"
              [value]="editForm().lastName ?? ''"
              (valueChange)="patch.emit({ lastName: asText($event) })" />
          </div>
        }

        @if (pills().length) {
          <div class="mt-3 flex flex-wrap justify-center gap-2">
            @for (pill of pills(); track pill.label) {
              <daf-badge [label]="pill.label" [options]="{ variant: pill.variant, size: 'sm', pill: true }" />
            }
          </div>
        }
      </div>

      <!-- Coordonnées & identité -->
      <div class="border-t border-outline-variant/40 px-8 pb-8 pt-5">
        <h2 class="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-outline">
          <span class="material-symbols-outlined text-[16px]">contact_page</span>
          {{ 'CANDIDATES.DETAIL.CONTACT' | translate }}
        </h2>

        <div class="grid grid-cols-2 gap-x-4 gap-y-5">

          @if (!editMode()) {
            <rh-profile-field [wide]="true"
              [label]="'CANDIDATES.DETAIL.EMAIL' | translate"
              [value]="candidate().emailPersonal" />
          } @else {
            <daf-form-field class="col-span-2 block"
              [options]="{ label: ('CANDIDATES.DETAIL.EMAIL' | translate), type: 'email' }"
              [value]="editForm().emailPersonal ?? ''"
              (valueChange)="patch.emit({ emailPersonal: asText($event) })" />
          }

          @if (!editMode()) {
            <rh-profile-field
              [label]="'CANDIDATES.DETAIL.PHONE' | translate"
              [value]="candidate().phone" />
          } @else {
            <daf-form-field
              [options]="{ label: ('CANDIDATES.DETAIL.PHONE' | translate) }"
              [value]="editForm().phone ?? ''"
              (valueChange)="patch.emit({ phone: asText($event) })" />
          }

          @if (!editMode()) {
            <!-- Formatted now, not the raw ISO string the card used to print:
                 the same field is a date picker two lines below in edit mode, and
                 "1994-03-07" next to a picker showing 07/03/1994 reads as two
                 different values. -->
            <rh-profile-field
              [label]="'CANDIDATES.DETAIL.DOB' | translate"
              [value]="dob()" />
          } @else {
            <daf-multi-date-picker
              [config]="{ label: ('CANDIDATES.DETAIL.DOB' | translate), selectionMode: 'single' }"
              [value]="toDate(editForm().dateOfBirth)"
              (valueChange)="patch.emit({ dateOfBirth: fromDate($event) })" />
          }

          @if (!editMode()) {
            <rh-profile-field
              [label]="'CANDIDATES.DETAIL.GENDER' | translate"
              [value]="gender()" />
          } @else {
            <daf-select [options]="genderOptions()"
              [config]="{ label: ('CANDIDATES.DETAIL.GENDER' | translate), searchable: true }"
              [selected]="editForm().gender ? [editForm().gender!] : []"
              (selectedChange)="patch.emit({ gender: $event[0] })" />
          }

          @if (!editMode()) {
            <rh-profile-field
              [label]="'CANDIDATES.DETAIL.NATIONALITY' | translate"
              [value]="candidate().nationality" />
          } @else {
            <daf-select [options]="nationalityOptions()"
              [config]="{ label: ('CANDIDATES.DETAIL.NATIONALITY' | translate), searchable: true }"
              [selected]="toSelected(editForm().nationalityId)"
              (selectedChange)="patch.emit({ nationalityId: fromSelected($event) })" />
          }

          @if (!editMode()) {
            <rh-profile-field
              [label]="'CANDIDATES.DETAIL.NATIONAL_ID' | translate"
              [value]="candidate().nationalId" />
          } @else {
            <daf-form-field
              [options]="{ label: ('CANDIDATES.DETAIL.NATIONAL_ID' | translate) }"
              [value]="editForm().nationalId ?? ''"
              (valueChange)="patch.emit({ nationalId: asText($event) })" />
          }

          <!-- Hidden when empty while reading, always shown while editing —
               otherwise a candidate with no location has no way to gain one. -->
          @if (!editMode()) {
            @if (candidate().location) {
              <rh-profile-field
                [label]="'CANDIDATES.DETAIL.LOCATION' | translate"
                [value]="candidate().location" />
            }
          } @else {
            <daf-form-field
              [options]="{ label: ('CANDIDATES.DETAIL.LOCATION' | translate) }"
              [value]="editForm().location ?? ''"
              (valueChange)="patch.emit({ location: asText($event) })" />
          }
        </div>

        <!-- Action, at the foot of the card as on the profile page. One button,
             two states: Modifier while viewing, Annuler while editing — and the
             save bar only exists in the second state. -->
        @if (canEdit()) {
          <div class="mt-8 flex gap-3">
            <daf-button class="flex-1"
              [options]="{
                variant: editMode() ? 'ghost' : 'teal', size: 'sm', fullWidth: true,
                iconStart: editMode() ? 'close' : 'edit',
                label: (editMode() ? 'CANDIDATES.COMMON.CANCEL' : 'CANDIDATES.COMMON.EDIT') | translate
              }"
              (onClick)="toggleEdit.emit()" />
          </div>
        }
      </div>

    </daf-card>
  `,
})
export class CandidateIdentityCardComponent {
  private translate = inject(TranslateService);

  readonly candidate = input.required<CandidateDetail>();
  readonly pills     = input<CandidatePill[]>([]);

  readonly editMode = input(false);
  readonly editForm = input.required<UpdateCandidateRequest>();
  readonly canEdit  = input(false);

  readonly genderOptions      = input<SelectOption[]>([]);
  readonly nationalityOptions = input<SelectOption[]>([]);

  readonly patch      = output<Partial<UpdateCandidateRequest>>();
  readonly toggleEdit = output<void>();

  protected readonly avatar   = computed(() => candidateAvatar(this.candidate().gender));
  protected readonly initials = computed(() =>
    candidateInitials(this.candidate().firstName, this.candidate().lastName),
  );
  protected readonly gender = computed(() => {
    const g = this.candidate().gender;
    return g ? genderLabel(g) : null;
  });

  /** Locale-aware, like every other date on this page — `formatDate` is the page's helper. */
  protected readonly dob = computed(() =>
    formatDate(this.candidate().dateOfBirth,
               this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR'),
  );

  protected readonly toDate       = toDate;
  protected readonly fromDate     = fromDate;
  protected readonly toSelected   = toSelected;
  protected readonly fromSelected = fromSelected;
  protected readonly asText       = asText;
}
