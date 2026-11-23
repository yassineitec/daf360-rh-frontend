import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BadgeVariant, FormFieldComponent, MultiDatePickerComponent,
  SelectComponent, SelectOption, StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';

import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import {
  asNumber, asText, fromDate, fromSelected, toDate, toSelected,
} from '../../../shared/detail/field-bridges';
import { CandidateDetail, UpdateCandidateRequest } from '../candidate.model';
import { CandidateInterview, interviewTypeLabel } from '../interview.model';
import { OfferResponse } from '../../pipeline/services/offer.service';
import { formatDate } from '../candidate-display';

const OFFER_STATUS_KEY: Record<string, string> = {
  DRAFT:    'CANDIDATES.OFFER.STATUS_DRAFT',
  SENT:     'CANDIDATES.OFFER.STATUS_SENT',
  ACCEPTED: 'CANDIDATES.OFFER.STATUS_ACCEPTED',
  REJECTED: 'CANDIDATES.OFFER.STATUS_REJECTED',
  EXPIRED:  'CANDIDATES.OFFER.STATUS_EXPIRED',
};
const OFFER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: 'secondary', SENT: 'warning', ACCEPTED: 'success', REJECTED: 'danger', EXPIRED: 'neutral',
};
const INTERVIEW_STATUS_KEY: Record<string, string> = {
  PLANNED:   'CANDIDATES.INTERVIEWS.STATUS_PLANNED',
  DONE:      'CANDIDATES.INTERVIEWS.STATUS_DONE',
  CANCELLED: 'CANDIDATES.INTERVIEWS.STATUS_CANCELLED',
};
const INTERVIEW_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PLANNED: 'teal', DONE: 'success', CANCELLED: 'neutral',
};

/**
 * "Profil" tab of `/rh/candidates/:id` — the candidate's global view.
 *
 * Everything typed in the creation wizard is here (identity and the CV preview stay in
 * the left column, visible from every tab), plus a read-only summary of what the other
 * tabs manage: every interview and every offer round. Each summary card links to its tab, which stays
 * the place to act — this tab never schedules, sends or uploads anything.
 *
 * Every field is always rendered, with « — » when empty: on an overview, a missing value
 * is information, and a field that appears and disappears makes two candidates hard to
 * compare.
 *
 * Stateless: the page fetches interviews and offer rounds and owns the edit form; this
 * emits partials and tab requests. The CV preview fetches its own file (blob).
 */
@Component({
  selector: 'rh-candidate-profile-section',
  standalone: true,
  imports: [
    SectionCardComponent, ProfileFieldComponent, FormFieldComponent,
    MultiDatePickerComponent, SelectComponent, StatusBadgeComponent, TranslatePipe,
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
              [label]="'CANDIDATES.DETAIL.VACANCY' | translate"
              [value]="candidate().recruitmentDemandJobTitle
                       ?? ('CANDIDATES.DETAIL.VACANCY_SPONTANEOUS' | translate)" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.DESIRED_POSITION' | translate"
              [value]="candidate().appliedPosition" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.CONTRACT_TYPE' | translate"
              [value]="labels().employmentType ?? candidate().employmentTypeLabel" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.DEPARTMENT' | translate"
              [value]="labels().department ?? candidate().department" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.GRADE' | translate"
              [value]="labels().grade ?? candidate().appliedGrade" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.DISCIPLINE' | translate"
              [value]="labels().discipline ?? candidate().appliedDiscipline" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.EXPERIENCE' | translate"
              [value]="experience()" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.EXPECTED_START' | translate"
              [value]="date(candidate().expectedStartDate)" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.NATIONALITY' | translate"
              [value]="labels().nationality ?? candidate().nationality" />
          </div>
        } @else {
          <div class="grid gap-x-6 gap-y-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            <daf-form-field
              [options]="{ label: ('CANDIDATES.DETAIL.DESIRED_POSITION' | translate) }"
              [value]="editForm().appliedPosition ?? ''"
              (valueChange)="patch.emit({ appliedPosition: asText($event) })" />

            <!-- No blank option: an unset contract type resolves to CDI downstream
                 (ContractTypeBridge), so an empty choice would be a hidden default. -->
            <daf-select [options]="employmentTypeOptions()"
              [config]="{ label: ('CANDIDATES.DETAIL.CONTRACT_TYPE' | translate), searchable: true }"
              [selected]="toSelected(editForm().employmentTypeId)"
              (selectedChange)="patch.emit({ employmentTypeId: fromSelected($event) })" />

            <!-- Blank DOES mean something here — it detaches the candidature from its
                 vacancy. The page sends the key only when it changed. -->
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

            <!-- The 0-60 band is a backend @Min/@Max, stated as a hint. -->
            <daf-form-field
              [options]="{ label: ('CANDIDATES.DETAIL.EXPERIENCE_YEARS' | translate),
                           type: 'number',
                           hint: ('CANDIDATES.DETAIL.EXPERIENCE_HINT' | translate) }"
              [value]="editForm().experienceYears ?? null"
              (valueChange)="patch.emit({ experienceYears: asNumber($event) })" />

            <daf-multi-date-picker
              [config]="{ label: ('CANDIDATES.DETAIL.EXPECTED_START' | translate), selectionMode: 'single' }"
              [value]="toDate(editForm().expectedStartDate)"
              (valueChange)="patch.emit({ expectedStartDate: fromDate($event) })" />
          </div>
        }
      </rh-section-card>

      <!-- Salary figures typed at creation, read-only: the only place they are shown.
           Budget data, so RH hiring right or admin. -->
      @if (showSalary()) {
        <rh-section-card [title]="'CANDIDATES.DETAIL.SALARY' | translate" icon="payments">
          <div class="grid grid-cols-2 gap-3">
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.SALARY_NET_CANDIDATE' | translate"
              [value]="money(candidate().salaireNetCandidat)" />
            <rh-profile-field variant="tile"
              [label]="'CANDIDATES.DETAIL.SALARY_NET_RH' | translate"
              [value]="money(candidate().salaireNetRh)" />
          </div>
        </rh-section-card>
      }

      <!-- Dates stamped by the workflow — not editable. -->
      <rh-section-card
        [title]="'CANDIDATES.DETAIL.DATES' | translate"
        icon="calendar_today">
        <div class="flex flex-col">
          <rh-profile-field variant="row"
            [label]="'CANDIDATES.DETAIL.APPLICATION_SUBMITTED' | translate"
            [value]="date(candidate().createdAt)" />
          <rh-profile-field variant="row"
            [label]="'CANDIDATES.DETAIL.ACCEPTED_ON' | translate"
            [value]="date(candidate().acceptedAt)" />
          <rh-profile-field variant="row" [last]="true"
            [label]="'CANDIDATES.DETAIL.UPDATED_ON' | translate"
            [value]="date(candidate().updatedAt)" />
        </div>
      </rh-section-card>

      <!-- Notes — always present: on an overview « no note » is worth saying. -->
      <rh-section-card
        [title]="'CANDIDATES.DETAIL.NOTES' | translate"
        icon="edit_note">
        @if (!editMode()) {
          @if (candidate().notes) {
            <p class="whitespace-pre-line text-[14px] leading-relaxed text-on-surface">{{ candidate().notes }}</p>
          } @else {
            <p class="text-[13px] text-outline">{{ 'CANDIDATES.DETAIL.NO_NOTES' | translate }}</p>
          }
        } @else {
          <daf-form-field
            [options]="{ type: 'textarea', rows: 4, maxLength: 1000,
                         placeholder: ('CANDIDATES.DETAIL.NOTES_PLACEHOLDER' | translate) }"
            [value]="editForm().notes ?? ''"
            (valueChange)="patch.emit({ notes: asText($event) })" />
        }
      </rh-section-card>

      <!-- Rejection reason — written by the reject action, never editable. -->
      @if (candidate().status === 'REJECTED' && candidate().rejectionReason) {
        <rh-section-card
          [title]="'CANDIDATES.DETAIL.REJECTION_REASON' | translate"
          icon="cancel"
          tone="text-danger"
          accent="danger">
          <p class="text-[14px] text-on-surface">{{ candidate().rejectionReason }}</p>
        </rh-section-card>
      }

      <!-- Interviews — the whole list, oldest first (the order they were run). -->
      @if (showInterviews()) {
        <rh-section-card [title]="'CANDIDATES.DETAIL.TABS.INTERVIEWS' | translate" icon="record_voice_over">
          <div sectionAction class="flex items-center gap-2">
            <daf-badge [label]="'' + interviews().length" [options]="{ variant: 'neutral', size: 'sm', pill: true }" />
          </div>

          @if (!interviews().length) {
            <p class="text-[13px] text-outline">{{ 'CANDIDATES.DETAIL.NO_INTERVIEWS' | translate }}</p>
          } @else {
            <ul class="flex flex-col divide-y divide-outline-variant/40">
              @for (iv of interviews(); track iv.id) {
                <li class="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container
                               text-[12px] font-bold text-on-surface-variant">{{ iv.sequenceNumber }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[14px] font-semibold text-on-surface">{{ interviewType(iv) }}</p>
                    <p class="wrap-break-word text-[12px] text-on-surface-variant">
                      {{ dateTime(iv.scheduledAt) }}
                      @if (iv.location) { · {{ iv.location }} }
                    </p>
                    @if (interviewers(iv); as names) {
                      <p class="wrap-break-word text-[12px] text-outline">{{ names }}</p>
                    }
                  </div>
                  <div class="flex shrink-0 flex-wrap items-center gap-2">
                    <daf-badge [label]="interviewStatus(iv.status)"
                               [options]="{ variant: interviewVariant(iv.status), size: 'sm' }" />
                    @if (iv.result) {
                      <daf-badge
                        [label]="(iv.result === 'PASS' ? 'CANDIDATES.INTERVIEWS.RESULT_PASS' : 'CANDIDATES.INTERVIEWS.RESULT_FAIL') | translate"
                        [options]="{ variant: iv.result === 'PASS' ? 'success' : 'danger', size: 'sm' }" />
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </rh-section-card>
      }

      <!-- Offers — every negotiation round, newest first. Amounts are budget data,
           shown only with the salary right. -->
      <rh-section-card [title]="'CANDIDATES.DETAIL.OFFERS_OVERVIEW' | translate" icon="handshake">
        <div sectionAction class="flex items-center gap-2">
          <daf-badge [label]="'' + offerRounds().length" [options]="{ variant: 'neutral', size: 'sm', pill: true }" />
        </div>

        @if (!offerRounds().length) {
          <p class="text-[13px] text-outline">{{ 'CANDIDATES.DETAIL.NO_OFFERS' | translate }}</p>
        } @else {
          <ul class="flex flex-col gap-3">
            @for (o of offerRounds(); track o.id) {
              <li class="rounded-xl border border-outline-variant p-4"
                  [class.bg-surface-container-low]="!!o.supersededAt">
                <div class="mb-3 flex flex-wrap items-center gap-2">
                  <span class="text-[13px] font-bold text-on-surface">
                    {{ 'CANDIDATES.OFFER.ROUND' | translate }} {{ o.roundNumber }}
                  </span>
                  <daf-badge [label]="offerStatus(o.status)"
                             [options]="{ variant: offerVariant(o.status), size: 'sm' }" />
                  @if (o.supersededAt) {
                    <daf-badge [label]="'CANDIDATES.DETAIL.OFFER_SUPERSEDED' | translate"
                               [options]="{ variant: 'neutral', size: 'sm' }" />
                  }
                </div>
                <div class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  @if (showSalary()) {
                    <rh-profile-field
                      [label]="'CANDIDATES.OFFER.ASKED_SALARY' | translate"
                      [value]="money(o.askedSalary)" />
                    <rh-profile-field
                      [label]="'CANDIDATES.OFFER.PROPOSED_SALARY' | translate"
                      [value]="money(o.proposedSalary)" />
                  }
                  <rh-profile-field
                    [label]="'CANDIDATES.OFFER.HIRE_DATE' | translate"
                    [value]="date(o.expectedHireDate)" />
                  <rh-profile-field
                    [label]="'CANDIDATES.OFFER.SENT_ON' | translate"
                    [value]="date(o.sentAt)" />
                  <rh-profile-field
                    [label]="'CANDIDATES.OFFER.EXPIRES_ON' | translate"
                    [value]="date(o.expiryDate)" />
                  <rh-profile-field
                    [label]="'CANDIDATES.OFFER.DECIDED_ON' | translate"
                    [value]="date(o.decidedAt)" />
                </div>
                @if (o.rejectionReason) {
                  <p class="mt-3 text-[12px] text-danger">
                    {{ 'CANDIDATES.OFFER.REJECTION_REASON' | translate }} : {{ o.rejectionReason }}
                  </p>
                }
              </li>
            }
          </ul>
        }
      </rh-section-card>
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
  /** Read-mode labels in the UI language, resolved by the page from the rh/admin lists. */
  readonly labels = input<{
    department?: string | null; grade?: string | null;
    discipline?: string | null; employmentType?: string | null;
    nationality?: string | null;
  }>({});

  /** Interviews of this candidate — fetched by the page (needs RH_MANAGE_INTERVIEWS). */
  readonly interviews     = input<CandidateInterview[]>([]);
  readonly showInterviews = input(false);
  /** Every offer round, newest first — fetched by the page. */
  readonly offerRounds    = input<OfferResponse[]>([]);
  /** Budget figures (salary expectations, offer amounts) — RH hiring right or admin. */
  readonly showSalary     = input(false);

  readonly patch   = output<Partial<UpdateCandidateRequest>>();

  private locale(): string {
    return this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';
  }

  protected readonly experience = computed(() => {
    this.translate.currentLang();
    const years = this.candidate().experienceYears;
    return years == null ? null : this.translate.instant('CANDIDATES.KANBAN.YEARS_EXP', { years });
  });

  protected date(value: string | null | undefined): string {
    return formatDate(value, this.locale());
  }

  protected dateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(this.locale(), {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  protected money(value: number | null | undefined): string | null {
    if (value == null) return null;
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 3 }).format(value);
  }

  protected interviewType(iv: CandidateInterview): string {
    return interviewTypeLabel(iv.interviewTypeName, iv.interviewTypeNameEn, this.translate.currentLang());
  }

  protected interviewers(iv: CandidateInterview): string {
    const names = (iv.interviewers ?? []).map(u => u.fullName?.trim()).filter(Boolean);
    if (!names.length && iv.interviewerName) names.push(iv.interviewerName);
    return names.join(', ');
  }

  protected interviewStatus(s: string): string {
    return this.translate.instant(INTERVIEW_STATUS_KEY[s] ?? INTERVIEW_STATUS_KEY['CANCELLED']);
  }
  protected interviewVariant(s: string): BadgeVariant {
    return INTERVIEW_STATUS_VARIANT[s] ?? 'neutral';
  }
  protected offerStatus(s: string): string {
    return OFFER_STATUS_KEY[s] ? this.translate.instant(OFFER_STATUS_KEY[s]) : s;
  }
  protected offerVariant(s: string): BadgeVariant {
    return OFFER_STATUS_VARIANT[s] ?? 'neutral';
  }

  protected readonly toDate       = toDate;
  protected readonly fromDate     = fromDate;
  protected readonly toSelected   = toSelected;
  protected readonly fromSelected = fromSelected;
  protected readonly asText       = asText;
  protected readonly asNumber     = asNumber;
}
