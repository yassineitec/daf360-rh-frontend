import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  FormFieldComponent, MultiDatePickerComponent, SelectComponent, SelectOption,
} from '@khalilrebhiitec/daf360';

import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import {
  asNumber, asText, fromDate, fromSelected, toDate, toSelected,
} from '../../../shared/detail/field-bridges';
import { CandidateDetail, UpdateCandidateRequest } from '../candidate.model';
import { formatDate } from '../candidate-display';

/**
 * "Profil" tab of `/rh/candidates/:id` — position & contract, the application
 * dates, free-text notes and, when there is one, the rejection reason.
 *
 * Same shape as `/rh/profiles/:id`'s Emploi tab: several `rh-section-card`s
 * stacked in a `flex flex-col gap-6`, fields through `rh-profile-field` so the two
 * pages cannot drift on label size or spacing — and, like there, each field swaps
 * for its control in edit mode rather than opening a separate form.
 *
 * Stateless: it reads `editForm` and emits a partial on every change, so the page
 * remains the single owner of the pending edit. Default change detection for the
 * same reason the profile sections use it — live controls bound to a plain DTO.
 */
@Component({
  selector: 'rh-candidate-profile-section',
  standalone: true,
  imports: [
    SectionCardComponent, ProfileFieldComponent, FormFieldComponent,
    MultiDatePickerComponent, SelectComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-6">

      <!-- Poste & contrat -->
      <rh-section-card
        [title]="'CANDIDATES.DETAIL.POSITION_CONTRACT' | translate"
        icon="work">

        @if (!editMode()) {
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.DESIRED_POSITION' | translate"
              [value]="candidate().appliedPosition" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.CONTRACT_TYPE' | translate"
              [value]="candidate().employmentTypeLabel" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.DEPARTMENT' | translate"
              [value]="candidate().department" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.GRADE' | translate"
              [value]="candidate().appliedGrade" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.DISCIPLINE' | translate"
              [value]="candidate().appliedDiscipline" />
            @if (candidate().experienceYears != null) {
              <rh-profile-field variant="tile"
                [label]="'CANDIDATES.DETAIL.EXPERIENCE' | translate"
                [value]="experience()" />
            }
            <!-- The vacancy this candidature answers. Read-only it is a tile like the
                 rest; a spontaneous application says so rather than showing a dash,
                 because "no vacancy" is a real, common state here, not a gap. -->
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.VACANCY' | translate"
              [value]="candidate().recruitmentDemandJobTitle
                       ?? ('CANDIDATES.DETAIL.VACANCY_SPONTANEOUS' | translate)" />
          </div>
        } @else {
          <div class="grid gap-x-6 gap-y-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            <daf-form-field
              [options]="{ label: ('CANDIDATES.DETAIL.DESIRED_POSITION' | translate) }"
              [value]="editForm().appliedPosition ?? ''"
              (valueChange)="patch.emit({ appliedPosition: asText($event) })" />

            <!-- No blank option: an unset contract type resolves to CDI downstream
                 (ContractTypeBridge), so an empty choice would be a hidden default.
                 The server refuses this field once the candidate is HIRED — which is
                 also when the page stops offering edit at all. -->
            <daf-select [options]="employmentTypeOptions()"
              [config]="{ label: ('CANDIDATES.DETAIL.CONTRACT_TYPE' | translate), searchable: true }"
              [selected]="toSelected(editForm().employmentTypeId)"
              (selectedChange)="patch.emit({ employmentTypeId: fromSelected($event) })" />

            <!-- Blank here DOES mean something — it detaches the candidature from its
                 vacancy, which is how a spontaneous application wrongly attached to a
                 demand is put back. The page sends the key only when it changed. -->
            <daf-select [options]="demandOptions()"
              [config]="{ label: ('CANDIDATES.DETAIL.VACANCY' | translate), searchable: true }"
              [selected]="toSelected(editForm().recruitmentDemandId)"
              (selectedChange)="patch.emit({ recruitmentDemandId: fromSelected($event) })" />

            <daf-select [options]="departmentOptions()"
              [config]="{ label: ('CANDIDATES.DETAIL.DEPARTMENT' | translate), searchable: true }"
              [selected]="toSelected(editForm().departmentId)"
              (selectedChange)="patch.emit({ departmentId: fromSelected($event) })" />

            <daf-select [options]="gradeOptions()"
              [config]="{ label: ('CANDIDATES.DETAIL.GRADE' | translate), searchable: true }"
              [selected]="toSelected(editForm().appliedGradeId)"
              (selectedChange)="patch.emit({ appliedGradeId: fromSelected($event) })" />

            <daf-select [options]="disciplineOptions()"
              [config]="{ label: ('CANDIDATES.DETAIL.DISCIPLINE' | translate), searchable: true }"
              [selected]="toSelected(editForm().appliedDisciplineId)"
              (selectedChange)="patch.emit({ appliedDisciplineId: fromSelected($event) })" />

            <!-- The 0-60 band is a backend @Min/@Max; it is stated as a hint rather
                 than enforced here, and a value outside it comes back as a field
                 error on save (extractErrorMessage reads ProblemDetail.errors). -->
            <daf-form-field
              [options]="{ label: ('CANDIDATES.DETAIL.EXPERIENCE_YEARS' | translate),
                           type: 'number',
                           hint: ('CANDIDATES.DETAIL.EXPERIENCE_HINT' | translate) }"
              [value]="editForm().experienceYears ?? null"
              (valueChange)="patch.emit({ experienceYears: asNumber($event) })" />
          </div>
        }
      </rh-section-card>

      <!-- Dates. Moved off the left column, where the profile page keeps only
           identity — the dates are record data, so they belong in a tab.
           Only "début prévu" is editable: the other two are stamped by the
           workflow (creation, acceptance) and are not the user's to rewrite. -->
      <rh-section-card
        [title]="'CANDIDATES.DETAIL.DATES' | translate"
        icon="calendar_today">
        <div class="flex flex-col">
          <rh-profile-field variant="row"
            [label]="'CANDIDATES.DETAIL.APPLICATION_SUBMITTED' | translate"
            [value]="date(candidate().createdAt)" />

          @if (!editMode()) {
            <rh-profile-field variant="row"
              [label]="'CANDIDATES.DETAIL.EXPECTED_START' | translate"
              [value]="date(candidate().expectedStartDate)" />
          } @else {
            <div class="py-2 border-b border-outline-variant/40">
              <daf-multi-date-picker
                [config]="{ label: ('CANDIDATES.DETAIL.EXPECTED_START' | translate), selectionMode: 'single' }"
                [value]="toDate(editForm().expectedStartDate)"
                (valueChange)="patch.emit({ expectedStartDate: fromDate($event) })" />
            </div>
          }

          <rh-profile-field variant="row" [last]="true"
            [label]="'CANDIDATES.DETAIL.ACCEPTED_ON' | translate"
            [value]="date(candidate().acceptedAt)" />
        </div>
      </rh-section-card>

      <!-- Notes. Hidden when empty while reading, always present while editing —
           otherwise a candidate with no note can never gain one. -->
      @if (editMode() || candidate().notes) {
        <rh-section-card
          [title]="'CANDIDATES.DETAIL.NOTES' | translate"
          icon="edit_note">
          @if (!editMode()) {
            <p class="text-[14px] leading-relaxed text-on-surface">{{ candidate().notes }}</p>
          } @else {
            <daf-form-field
              [options]="{ type: 'textarea', rows: 4, maxLength: 1000,
                           placeholder: ('CANDIDATES.DETAIL.NOTES_PLACEHOLDER' | translate) }"
              [value]="editForm().notes ?? ''"
              (valueChange)="patch.emit({ notes: asText($event) })" />
          }
        </rh-section-card>
      }

      <!-- Rejection reason — the one section with a danger accent. Never editable:
           it is written by the reject action and is the record of that decision. -->
      @if (candidate().status === 'REJECTED' && candidate().rejectionReason) {
        <rh-section-card
          [title]="'CANDIDATES.DETAIL.REJECTION_REASON' | translate"
          icon="cancel"
          tone="text-danger"
          accent="danger">
          <p class="text-[14px] text-on-surface">{{ candidate().rejectionReason }}</p>
        </rh-section-card>
      }
    </div>
  `,
})
export class CandidateProfileSectionComponent {
  private translate = inject(TranslateService);

  readonly candidate = input.required<CandidateDetail>();

  readonly editMode = input(false);
  readonly editForm = input.required<UpdateCandidateRequest>();

  readonly departmentOptions     = input<SelectOption[]>([]);
  readonly gradeOptions          = input<SelectOption[]>([]);
  readonly disciplineOptions     = input<SelectOption[]>([]);
  readonly employmentTypeOptions = input<SelectOption[]>([]);
  readonly demandOptions         = input<SelectOption[]>([]);

  readonly patch = output<Partial<UpdateCandidateRequest>>();

  protected readonly experience = computed(() => {
    this.translate.currentLang();
    const years = this.candidate().experienceYears;
    return years == null ? null : this.translate.instant('CANDIDATES.KANBAN.YEARS_EXP', { years });
  });

  protected date(value: string | null | undefined): string {
    return formatDate(value, this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR');
  }

  protected readonly toDate       = toDate;
  protected readonly fromDate     = fromDate;
  protected readonly toSelected   = toSelected;
  protected readonly fromSelected = fromSelected;
  protected readonly asText       = asText;
  protected readonly asNumber     = asNumber;
}
