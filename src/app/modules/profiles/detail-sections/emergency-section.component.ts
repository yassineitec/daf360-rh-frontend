import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormFieldComponent } from '@khalilrebhiitec/daf360';

import { EmployeeProfile, ProfileUpdateDto } from '../models/profile.model';
import { ProfileFieldComponent } from './profile-field.component';
import { SectionCardComponent } from './section-card.component';
import { asText } from './field-bridges';

/** Contact d'urgence tab. */
@Component({
  selector: 'rh-emergency-section',
  standalone: true,
  imports: [ProfileFieldComponent, SectionCardComponent, FormFieldComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-section-card
      [title]="'PROFILES.SECTIONS.EMERGENCY' | translate" icon="emergency" tone="text-danger"
      accent="danger">

      @if (!editMode()) {
        <div class="flex flex-col">
          <rh-profile-field variant="row"
            [label]="'PROFILES.FIELDS.NAME' | translate" [value]="profile().emergencyContactName" />
          <rh-profile-field variant="row"
            [label]="'PROFILES.FIELDS.RELATION' | translate" [value]="profile().emergencyContactRelation" />
          <rh-profile-field variant="row" [last]="true"
            [label]="'PROFILES.FIELDS.PHONE' | translate" [value]="profile().emergencyContactPhone" />
        </div>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2">
          <daf-form-field [options]="{ label: ('PROFILES.FIELDS.NAME' | translate) }"
            [value]="editForm().emergencyContactName ?? ''"
            (valueChange)="patch.emit({ emergencyContactName: asText($event) })" />
          <daf-form-field
            [options]="{ label: ('PROFILES.FIELDS.RELATION' | translate),
                         placeholder: ('PROFILES.PLACEHOLDERS.RELATION' | translate) }"
            [value]="editForm().emergencyContactRelation ?? ''"
            (valueChange)="patch.emit({ emergencyContactRelation: asText($event) })" />
          <daf-form-field [options]="{ label: ('PROFILES.FIELDS.PHONE' | translate) }"
            [value]="editForm().emergencyContactPhone ?? ''"
            (valueChange)="patch.emit({ emergencyContactPhone: asText($event) })" />
        </div>
      }

    </rh-section-card>
  `,
})
export class EmergencySectionComponent {
  readonly profile  = input.required<EmployeeProfile>();
  readonly editMode = input(false);
  readonly editForm = input.required<ProfileUpdateDto>();

  readonly patch = output<Partial<ProfileUpdateDto>>();

  protected readonly asText = asText;
}
