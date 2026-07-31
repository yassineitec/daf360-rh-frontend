import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  FormFieldComponent, MultiDatePickerComponent, SelectComponent, SelectOption,
} from '@khalilrebhiitec/daf360';

import { EmployeeProfile, ProfileUpdateDto } from '../models/profile.model';
import { ProfileFieldComponent } from './profile-field.component';
import { asNumber, asText, fmtDate, fromDate, fromSelected, toDate, toSelected } from './field-bridges';
import { genderLabel } from '../../../shared/utils/gender.utils';

/**
 * Identité tab. Stateless: it reads `editForm` and emits a partial on every
 * change — it never mutates the object it was handed, so the page stays the
 * single owner of the pending edit and can derive per-tab dirty markers from it.
 *
 * Default change detection on purpose. These sections host live form controls
 * whose values come from a plain DTO on the page; OnPush plus an input object
 * that changes identity only on `startEdit()` is a staleness trap for no gain on
 * a page this size.
 */
@Component({
  selector: 'rh-identity-section',
  standalone: true,
  imports: [
    ProfileFieldComponent, FormFieldComponent, MultiDatePickerComponent,
    SelectComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <div [class]="gridClass()">

      @if (!editMode()) {
        <rh-profile-field [label]="'PROFILES.FIELDS.DOB' | translate" [value]="fmtDate(profile().dateOfBirth)" />
      } @else {
        <daf-multi-date-picker
          [config]="{ label: ('PROFILES.FIELDS.DOB' | translate), selectionMode: 'single' }"
          [value]="toDate(editForm().dateOfBirth)"
          (valueChange)="patch.emit({ dateOfBirth: fromDate($event) })" />
      }

      @if (!editMode()) {
        <rh-profile-field [label]="'PROFILES.FIELDS.GENDER' | translate" [value]="genderLabel(profile().gender)" />
      } @else {
        <daf-select [options]="genderOptions()"
          [config]="{ label: ('PROFILES.FIELDS.GENDER' | translate), searchable: true }"
          [selected]="editForm().gender ? [editForm().gender!] : []"
          (selectedChange)="patch.emit({ gender: $event[0] })" />
      }

      @if (!editMode()) {
        <rh-profile-field [label]="'PROFILES.FIELDS.NATIONALITY' | translate" [value]="profile().nationality" />
      } @else {
        <daf-select [options]="nationalityOptions()"
          [config]="{ label: ('PROFILES.FIELDS.NATIONALITY' | translate), searchable: true }"
          [selected]="toSelected(editForm().nationalityId)"
          (selectedChange)="patch.emit({ nationalityId: fromSelected($event) })" />
      }

      @if (!editMode()) {
        <rh-profile-field [label]="'PROFILES.FIELDS.NATIONAL_ID' | translate" [value]="profile().nationalId" />
      } @else {
        <daf-form-field [options]="{ label: ('PROFILES.FIELDS.NATIONAL_ID' | translate) }"
          [value]="editForm().nationalId ?? ''"
          (valueChange)="patch.emit({ nationalId: asText($event) })" />
      }

      @if (!editMode()) {
        <rh-profile-field [label]="'PROFILES.FIELDS.PASSPORT' | translate" [value]="profile().passportNumber" />
      } @else {
        <daf-form-field [options]="{ label: ('PROFILES.FIELDS.PASSPORT' | translate) }"
          [value]="editForm().passportNumber ?? ''"
          (valueChange)="patch.emit({ passportNumber: asText($event) })" />
      }

      @if (!editMode()) {
        <rh-profile-field [label]="'PROFILES.FIELDS.MARITAL' | translate" [value]="profile().maritalStatus" />
      } @else {
        <daf-select [options]="maritalStatusOptions()"
          [config]="{ label: ('PROFILES.FIELDS.MARITAL' | translate), searchable: true }"
          [selected]="editForm().maritalStatus ? [editForm().maritalStatus!] : []"
          (selectedChange)="patch.emit({ maritalStatus: $event[0] })" />
      }

      @if (!editMode()) {
        <rh-profile-field [label]="'PROFILES.FIELDS.CHILDREN' | translate"
          [value]="profile().numberOfChildren?.toString()" />
      } @else {
        <daf-form-field [options]="{ label: ('PROFILES.FIELDS.CHILDREN' | translate), type: 'number' }"
          [value]="editForm().numberOfChildren ?? null"
          (valueChange)="patch.emit({ numberOfChildren: asNumber($event) })" />
      }

    </div>
  `,
})
export class IdentitySectionComponent {
  readonly profile  = input.required<EmployeeProfile>();
  readonly editMode = input(false);
  readonly editForm = input.required<ProfileUpdateDto>();

  readonly genderOptions        = input<SelectOption[]>([]);
  readonly maritalStatusOptions = input<SelectOption[]>([]);
  readonly nationalityOptions   = input<SelectOption[]>([]);

  /**
   * `2` for the narrow left card (the design pairs the fields two-up); anything
   * else auto-fits. Whole literal classes — a runtime-built `grid-cols-${n}`
   * would never survive the consuming app's Tailwind scan.
   */
  readonly columns = input<number>(0);

  readonly patch = output<Partial<ProfileUpdateDto>>();

  protected readonly gridClass = computed(() =>
    this.columns() === 2
      ? 'grid grid-cols-2 gap-x-4 gap-y-4'
      : 'grid gap-x-6 gap-y-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]',
  );

  protected readonly fmtDate      = fmtDate;
  protected readonly toDate       = toDate;
  protected readonly fromDate     = fromDate;
  protected readonly toSelected   = toSelected;
  protected readonly fromSelected = fromSelected;
  protected readonly asText       = asText;
  protected readonly asNumber     = asNumber;
  protected readonly genderLabel  = genderLabel;
}
