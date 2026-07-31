import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectComponent, SelectOption } from '@khalilrebhiitec/daf360';

import { EmployeeProfile, ProfileUpdateDto } from '../models/profile.model';
import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { fromSelected, toSelected } from './field-bridges';

/**
 * Poste tab — "Affectation & Structure" from `design/profile-detail.html`: the
 * four reference-data assignments as tinted tiles in read mode, as lib selects in
 * edit mode.
 */
@Component({
  selector: 'rh-position-section',
  standalone: true,
  imports: [ProfileFieldComponent, SectionCardComponent, SelectComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-section-card [title]="'PROFILES.SECTIONS.POSITION' | translate" icon="account_tree">

      @if (!editMode()) {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <rh-profile-field variant="tile"
            [label]="'PROFILES.FIELDS.DEPARTMENT' | translate" [value]="profile().department" />
          <rh-profile-field variant="tile"
            [label]="'PROFILES.FIELDS.GRADE' | translate" [value]="profile().grade" />
          <rh-profile-field variant="tile"
            [label]="'PROFILES.FIELDS.DISCIPLINE' | translate" [value]="profile().discipline" />
          <rh-profile-field variant="tile"
            [label]="'PROFILES.FIELDS.NOG_LEVEL' | translate" [value]="profile().nogLevel" />
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <daf-select [options]="departmentOptions()"
            [config]="{ label: ('PROFILES.FIELDS.DEPARTMENT' | translate), searchable: true }"
            [selected]="toSelected(editForm().departmentId)"
            (selectedChange)="patch.emit({ departmentId: fromSelected($event) })" />
          <daf-select [options]="gradeOptions()"
            [config]="{ label: ('PROFILES.FIELDS.GRADE' | translate), searchable: true }"
            [selected]="toSelected(editForm().gradeId)"
            (selectedChange)="patch.emit({ gradeId: fromSelected($event) })" />
          <daf-select [options]="disciplineOptions()"
            [config]="{ label: ('PROFILES.FIELDS.DISCIPLINE' | translate), searchable: true }"
            [selected]="toSelected(editForm().disciplineId)"
            (selectedChange)="patch.emit({ disciplineId: fromSelected($event) })" />
          <daf-select [options]="nogLevelOptions()"
            [config]="{ label: ('PROFILES.FIELDS.NOG_LEVEL' | translate), searchable: true }"
            [selected]="toSelected(editForm().nogLevelId)"
            (selectedChange)="patch.emit({ nogLevelId: fromSelected($event) })" />
        </div>
      }
    </rh-section-card>
  `,
})
export class PositionSectionComponent {
  readonly profile  = input.required<EmployeeProfile>();
  readonly editMode = input(false);
  readonly editForm = input.required<ProfileUpdateDto>();

  readonly departmentOptions = input<SelectOption[]>([]);
  readonly gradeOptions      = input<SelectOption[]>([]);
  readonly disciplineOptions = input<SelectOption[]>([]);
  readonly nogLevelOptions   = input<SelectOption[]>([]);

  readonly patch = output<Partial<ProfileUpdateDto>>();

  protected readonly toSelected   = toSelected;
  protected readonly fromSelected = fromSelected;
}
