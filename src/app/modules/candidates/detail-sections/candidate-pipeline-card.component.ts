import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CardComponent, StepperComponent, StepperConfig, StepperStep,
} from '@khalilrebhiitec/daf360';

import { CandidateHistoryItem } from '../candidate.model';
import { formatDate } from '../candidate-display';

/** The coded candidate workflow, in order. Drives the rail's completed/current state. */
const PIPELINE_STEPS = [
  'PENDING', 'ACCEPTED', 'OFFER_SENT', 'IT_IN_PROGRESS',
  'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED',
] as const;

/** One Material Symbol per step, so the rail is readable at a glance like offboarding's. */
const STEP_ICONS: Record<(typeof PIPELINE_STEPS)[number], string> = {
  PENDING:        'hourglass_empty',
  ACCEPTED:       'thumb_up',
  OFFER_SENT:     'mail',
  IT_IN_PROGRESS: 'computer',
  EMAIL_RECEIVED: 'mark_email_read',
  HR_IN_PROGRESS: 'assignment_ind',
  HIRED:          'how_to_reg',
};

/**
 * Recruitment rail on `/rh/candidates/:id` — above the tab strip, in the right column.
 *
 * Follows `/rh/offboarding/:id`'s rail, the house pattern for "where does this file
 * stand": a glass `daf-card` holding a horizontal `daf-stepper` (`chrome: 'header-only'`
 * — the card owns everything around it).
 *
 * The rail and nothing else, deliberately — offboarding's progress bar and next-step chip
 * are not copied. There they add facts the rail does not carry, because that page counts
 * TASKS inside each stage. Here every step is one status, so a percentage and a "next
 * step" label could only repeat what the rail already draws.
 *
 * It moved out of the sticky left column to get here. Vertical in a 32%-wide column, it
 * had room for seven labels and nothing else: no dates, no next step. The `min-w-[560px]`
 * scroller is what lets seven horizontal steps survive a phone.
 *
 * The steps are not clickable, unlike offboarding's: this reports where the candidate
 * stands, it is not a wizard you navigate. Nothing on this page is per-step.
 *
 * `completed` is set on EVERY step (§10g): all-or-nothing, so the rail never falls back to
 * inferring completion from `currentStep` — which is what makes the REJECTED case render
 * as "nothing reached" rather than "everything before index -1".
 */
@Component({
  selector: 'rh-candidate-pipeline-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, StepperComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'md', radius: 'xl' }">

      <!-- Seven steps do not fit a narrow viewport; the rail scrolls rather than
           wrapping, exactly as on /rh/offboarding/:id. -->
      <div class="overflow-x-auto">
        <div class="min-w-[560px]">
          <daf-stepper
            [steps]="railSteps()"
            [currentStep]="currentIndex()"
            [config]="railConfig()" />
        </div>
      </div>

      <!-- Nothing under the rail on the happy path. The rail says where the candidate
           stands and when each step was reached; a "next step" chip only named the row
           already highlighted beside it, and a progress percentage only restated its
           completion. Both were the rail talking to itself.

           The one exception is below: REJECTED / ARCHIVED match no step, so the rail
           renders empty and something has to say what actually happened. -->
      @if (rejected()) {
        <div class="mt-5 flex border-t border-outline-variant/40 pt-4">
          <div class="flex items-center gap-1.5 rounded-xl border border-danger/30
                      bg-danger/10 px-3 py-2">
            <span class="material-symbols-outlined text-[15px] text-danger">cancel</span>
            <span class="text-[11px] font-bold uppercase tracking-wider text-danger">
              {{ 'CANDIDATES.STATUS.' + status() | translate }}
            </span>
          </div>
        </div>
      }
    </daf-card>
  `,
})
export class CandidatePipelineCardComponent {
  private translate = inject(TranslateService);

  readonly status = input.required<string>();

  /**
   * The audit trail, used only to date the steps. Optional: an empty list renders the
   * same rail without subtitles rather than nothing.
   */
  readonly history = input<CandidateHistoryItem[]>([]);

  /** REJECTED / ARCHIVED are off the happy path: no step matches, so the rail reads empty. */
  protected readonly rejected = computed(() => ['REJECTED', 'ARCHIVED'].includes(this.status()));

  /** -1 for an off-path status — no row is `active`, and no connector fills. */
  protected readonly currentIndex = computed(() =>
    PIPELINE_STEPS.indexOf(this.status() as (typeof PIPELINE_STEPS)[number]),
  );

  /**
   * First time each status was reached, by status code.
   *
   * FIRST, not last: a candidate can re-enter a status (a renegotiated offer goes back to
   * OFFER_SENT), and the question the rail answers is "when did we get here", not "when did
   * we last touch it". The list arrives newest-first, so the last write per code wins.
   */
  private readonly reachedAt = computed(() => {
    const out: Record<string, string> = {};
    for (const row of this.history()) {
      if (row.resultingStatus && row.timestamp) out[row.resultingStatus] = row.timestamp;
    }
    return out;
  });

  protected readonly railSteps = computed<StepperStep[]>(() => {
    const locale = this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR';
    const current = this.currentIndex();
    const dates = this.reachedAt();
    return PIPELINE_STEPS.map((step, i) => {
      const at = dates[step];
      return {
        title:     this.translate.instant('CANDIDATES.STATUS.' + step),
        icon:      STEP_ICONS[step],
        // Undefined, not '—': the lib drops the second line entirely rather than
        // reserving an empty one under every future step.
        subtitle:  at ? formatDate(at, locale) : undefined,
        completed: current >= 0 && i < current,
      };
    });
  });

  protected readonly railConfig = computed<StepperConfig>(() => {
    this.translate.currentLang();
    return {
      chrome:           'header-only',
      labelDensity:     'quiet',
      stepperLabel:     this.translate.instant('CANDIDATES.DETAIL.RECRUITMENT_STEPS'),
      currentStepLabel: this.translate.instant('CANDIDATES.DETAIL.STEP_CURRENT'),
      completedLabel:   this.translate.instant('CANDIDATES.DETAIL.STEP_DONE'),
    };
  });
}
