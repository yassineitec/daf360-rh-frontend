import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormFieldComponent } from '@khalilrebhiitec/daf360';

import { EmployeeProfile, ProfileUpdateDto } from '../models/profile.model';
import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { asText } from './field-bridges';

/** Contact & adresse tab. */
@Component({
  selector: 'rh-contact-section',
  standalone: true,
  imports: [ProfileFieldComponent, SectionCardComponent, FormFieldComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-section-card
      [title]="'PROFILES.SECTIONS.CONTACT' | translate" icon="contact_mail" tone="text-primary"
      accent="primary">

      @if (!editMode()) {
        <!-- Same label ⟷ value rows as the Emploi card. -->
        <div class="flex flex-col">
          <rh-profile-field variant="row"
            [label]="'PROFILES.FIELDS.PERSONAL_EMAIL' | translate" [value]="profile().personalEmail" />
          <rh-profile-field variant="row"
            [label]="'PROFILES.FIELDS.PERSONAL_PHONE' | translate" [value]="profile().personalPhone" />
          @if (showProPhone()) {
            <rh-profile-field variant="row"
              [label]="'PROFILES.FIELDS.PRO_PHONE' | translate" [value]="profile().phone" />
          }
          <rh-profile-field variant="row" [last]="true"
            [label]="'PROFILES.FIELDS.ADDRESS' | translate" [value]="profile().personalAddress" />
        </div>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2">
          <daf-form-field [options]="{ label: ('PROFILES.FIELDS.PERSONAL_EMAIL' | translate), type: 'email' }"
            [value]="editForm().personalEmail ?? ''"
            (valueChange)="patch.emit({ personalEmail: asText($event) })" />
          <daf-form-field [options]="{ label: ('PROFILES.FIELDS.PERSONAL_PHONE' | translate) }"
            [value]="editForm().personalPhone ?? ''"
            (valueChange)="patch.emit({ personalPhone: asText($event) })" />
          @if (showProPhone()) {
            <daf-form-field [options]="{ label: ('PROFILES.FIELDS.PRO_PHONE' | translate) }"
              [value]="editForm().phone ?? ''"
              (valueChange)="patch.emit({ phone: asText($event) })" />
          }
          <daf-form-field class="sm:col-span-2"
            [options]="{ label: ('PROFILES.FIELDS.ADDRESS' | translate), type: 'textarea', rows: 2 }"
            [value]="editForm().personalAddress ?? ''"
            (valueChange)="patch.emit({ personalAddress: asText($event) })" />
        </div>
      }

    </rh-section-card>
  `,
})
export class ContactSectionComponent {
  readonly profile  = input.required<EmployeeProfile>();
  readonly editMode = input(false);
  readonly editForm = input.required<ProfileUpdateDto>();

  readonly patch = output<Partial<ProfileUpdateDto>>();

  /**
   * Le numéro professionnel n'existe qu'une fois l'onboarding terminé : il est attribué
   * avec le poste, et la ligne reste vide tant que le collaborateur n'est pas ACTIVE.
   * Masqué — et non grisé — pour qu'un dossier en cours n'affiche qu'un seul téléphone.
   */
  protected readonly showProPhone = computed(
    () => this.profile().lifecycleStatus !== 'PRE_ONBOARDING',
  );

  protected readonly asText = asText;
}
