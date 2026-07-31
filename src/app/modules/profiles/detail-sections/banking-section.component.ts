import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  FormFieldComponent, MultiDatePickerComponent, SelectComponent, SelectOption,
} from '@khalilrebhiitec/daf360';

import { EmployeeProfile, ProfileUpdateDto } from '../models/profile.model';
import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { asText, fmtDate, fromDate, fromSelected, toDate, toSelected } from './field-bridges';

/**
 * Coordonnées bancaires tab — confidential. The page filters this tab out of the
 * strip entirely when `canViewSensitive()` is false; a disabled tab would still
 * advertise that the data exists.
 *
 * Two cards in the Emploi tab's shape: the bank account, and the social /
 * fiscal identifiers, which are different kinds of secret and were previously
 * one undifferentiated list of eight fields.
 */
@Component({
  selector: 'rh-banking-section',
  standalone: true,
  imports: [
    ProfileFieldComponent, SectionCardComponent, FormFieldComponent,
    MultiDatePickerComponent, SelectComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">

      <!-- ── Compte bancaire ── -->
      <rh-section-card
        [title]="'PROFILES.SECTIONS.BANK' | translate" icon="account_balance" tone="text-warning"
        accent="warning">

        @if (!editMode()) {
          <div class="flex flex-col">
            <rh-profile-field variant="row"
              [label]="'PROFILES.FIELDS.BANK' | translate" [value]="profile().bankName" />
            <rh-profile-field variant="row"
              [label]="'PROFILES.FIELDS.IBAN' | translate" [value]="profile().iban" />
            <rh-profile-field variant="row"
              [label]="'PROFILES.FIELDS.ACCOUNT_NUMBER' | translate" [value]="profile().bankAccountNumber" />
            <rh-profile-field variant="row" [last]="true"
              [label]="'PROFILES.FIELDS.RIB' | translate" [value]="profile().rib" />
          </div>
        } @else {
          <div class="flex flex-col gap-4">
            <daf-select [options]="bankOptions()"
              [config]="{ label: ('PROFILES.FIELDS.BANK' | translate), searchable: true }"
              [selected]="toSelected(editForm().bankId)"
              (selectedChange)="patch.emit({ bankId: fromSelected($event) })" />
            <daf-form-field [options]="{ label: ('PROFILES.FIELDS.IBAN' | translate) }"
              [value]="editForm().iban ?? ''" (valueChange)="patch.emit({ iban: asText($event) })" />
            <daf-form-field [options]="{ label: ('PROFILES.FIELDS.ACCOUNT_NUMBER' | translate) }"
              [value]="editForm().bankAccountNumber ?? ''"
              (valueChange)="patch.emit({ bankAccountNumber: asText($event) })" />
            <daf-form-field [options]="{ label: ('PROFILES.FIELDS.RIB' | translate) }"
              [value]="editForm().rib ?? ''" (valueChange)="patch.emit({ rib: asText($event) })" />
          </div>
        }
      </rh-section-card>

      <!-- ── Identifiants sociaux & fiscaux ── -->
      <rh-section-card
        [title]="'PROFILES.SECTIONS.SOCIAL_IDS' | translate" icon="badge" tone="text-tertiary"
        accent="tertiary">

        @if (!editMode()) {
          <div class="flex flex-col">
            <rh-profile-field variant="row"
              [label]="'PROFILES.FIELDS.SOCIAL_INSURANCE' | translate" [value]="profile().socialSecurityNumber" />
            <rh-profile-field variant="row"
              [label]="'PROFILES.FIELDS.NIF' | translate" [value]="profile().taxId" />
            <rh-profile-field variant="row"
              [label]="'PROFILES.FIELDS.CNSS' | translate" [value]="profile().cnssNumber" />
            <rh-profile-field variant="row" [last]="true"
              [label]="'PROFILES.FIELDS.CNSS_AFFILIATION' | translate"
              [value]="fmtDate(profile().cnssAffiliationDate)" />
          </div>
        } @else {
          <div class="flex flex-col gap-4">
            <daf-form-field [options]="{ label: ('PROFILES.FIELDS.SOCIAL_INSURANCE' | translate) }"
              [value]="editForm().socialSecurityNumber ?? ''"
              (valueChange)="patch.emit({ socialSecurityNumber: asText($event) })" />
            <daf-form-field [options]="{ label: ('PROFILES.FIELDS.NIF' | translate) }"
              [value]="editForm().taxId ?? ''" (valueChange)="patch.emit({ taxId: asText($event) })" />
            <daf-form-field [options]="{ label: ('PROFILES.FIELDS.CNSS' | translate) }"
              [value]="editForm().cnssNumber ?? ''" (valueChange)="patch.emit({ cnssNumber: asText($event) })" />
            <daf-multi-date-picker
              [config]="{ label: ('PROFILES.FIELDS.CNSS_AFFILIATION' | translate), selectionMode: 'single' }"
              [value]="toDate(editForm().cnssAffiliationDate)"
              (valueChange)="patch.emit({ cnssAffiliationDate: fromDate($event) })" />
          </div>
        }
      </rh-section-card>

    </div>
  `,
})
export class BankingSectionComponent {
  readonly profile  = input.required<EmployeeProfile>();
  readonly editMode = input(false);
  readonly editForm = input.required<ProfileUpdateDto>();

  readonly bankOptions = input<SelectOption[]>([]);

  readonly patch = output<Partial<ProfileUpdateDto>>();

  protected readonly fmtDate      = fmtDate;
  protected readonly toDate       = toDate;
  protected readonly fromDate     = fromDate;
  protected readonly toSelected   = toSelected;
  protected readonly fromSelected = fromSelected;
  protected readonly asText       = asText;
}
