import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { CandidateDetail } from '../candidate.model';
import { formatDate } from '../candidate-display';

/**
 * "Profil" tab of `/rh/candidates/:id` — position & contract, the application
 * dates, free-text notes and, when there is one, the rejection reason.
 *
 * Same shape as `/rh/profiles/:id`'s Emploi tab: several `rh-section-card`s
 * stacked in a `flex flex-col gap-6`, fields through `rh-profile-field` so the two
 * pages cannot drift on label size or spacing.
 */
@Component({
  selector: 'rh-candidate-profile-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent, ProfileFieldComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-6">

      <!-- Poste & contrat -->
      <rh-section-card
        [title]="'CANDIDATES.DETAIL.POSITION_CONTRACT' | translate"
        icon="work">
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
        </div>
      </rh-section-card>

      <!-- Dates. Moved off the left column, where the profile page keeps only
           identity — the dates are record data, so they belong in a tab. -->
      <rh-section-card
        [title]="'CANDIDATES.DETAIL.DATES' | translate"
        icon="calendar_today">
        <div class="flex flex-col">
          <rh-profile-field variant="row"
            [label]="'CANDIDATES.DETAIL.APPLICATION_SUBMITTED' | translate"
            [value]="date(candidate().createdAt)" />
          <rh-profile-field variant="row"
            [label]="'CANDIDATES.DETAIL.EXPECTED_START' | translate"
            [value]="date(candidate().expectedStartDate)" />
          <rh-profile-field variant="row" [last]="true"
            [label]="'CANDIDATES.DETAIL.ACCEPTED_ON' | translate"
            [value]="date(candidate().acceptedAt)" />
        </div>
      </rh-section-card>

      <!-- Notes -->
      @if (candidate().notes) {
        <rh-section-card
          [title]="'CANDIDATES.DETAIL.NOTES' | translate"
          icon="edit_note">
          <p class="text-[14px] leading-relaxed text-on-surface">{{ candidate().notes }}</p>
        </rh-section-card>
      }

      <!-- Rejection reason — the one section with a danger accent -->
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

  protected readonly experience = computed(() => {
    this.translate.currentLang();
    const years = this.candidate().experienceYears;
    return years == null ? null : this.translate.instant('CANDIDATES.KANBAN.YEARS_EXP', { years });
  });

  protected date(value: string | null | undefined): string {
    return formatDate(value, this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR');
  }
}
