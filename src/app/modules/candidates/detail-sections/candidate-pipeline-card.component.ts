import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StepperComponent, StepperConfig, StepperStep } from '@khalilrebhiitec/daf360';

import { SectionCardComponent } from '../../../shared/detail/section-card.component';

/** The coded candidate workflow, in order. Drives the rail's completed/current state. */
const PIPELINE_STEPS = [
  'PENDING', 'ACCEPTED', 'OFFER_SENT', 'IT_IN_PROGRESS',
  'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED',
] as const;

/**
 * Recruitment rail, under the identity card in the sticky left column of
 * `/rh/candidates/:id`.
 *
 * `daf-stepper` in `orientation: 'vertical'` + `chrome: 'header-only'` — the card owns
 * everything around it, the same way `/rh/offboarding/:id` drives its rail. The steps are
 * not clickable: this reports where the candidate stands, it is not a wizard you navigate.
 *
 * `completed` is set on EVERY step (§10g): all-or-nothing, so the rail never falls back to
 * inferring completion from `currentStep` — which is what makes the REJECTED case below
 * render as "nothing reached" rather than "everything before index -1".
 */
@Component({
  selector: 'rh-candidate-pipeline-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent, StepperComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-section-card
      [title]="'CANDIDATES.DETAIL.RECRUITMENT_STEPS' | translate"
      icon="linear_scale">

      <daf-stepper
        orientation="vertical"
        [steps]="railSteps()"
        [currentStep]="currentIndex()"
        [config]="railConfig()" />

      @if (rejected()) {
        <p class="mt-4 flex items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">
          <span class="material-symbols-outlined text-[15px]">cancel</span>
          {{ 'CANDIDATES.STATUS.REJECTED' | translate }}
        </p>
      }
    </rh-section-card>
  `,
})
export class CandidatePipelineCardComponent {
  private translate = inject(TranslateService);

  readonly status = input.required<string>();

  /** REJECTED / ARCHIVED are off the happy path: no step matches, so the rail reads empty. */
  protected readonly rejected = computed(() => ['REJECTED', 'ARCHIVED'].includes(this.status()));

  /** -1 for an off-path status — no row is `active`, and no connector fills. */
  protected readonly currentIndex = computed(() =>
    PIPELINE_STEPS.indexOf(this.status() as (typeof PIPELINE_STEPS)[number]),
  );

  protected readonly railSteps = computed<StepperStep[]>(() => {
    this.translate.currentLang();
    const current = this.currentIndex();
    return PIPELINE_STEPS.map((step, i) => ({
      title:     this.translate.instant('CANDIDATES.STATUS.' + step),
      completed: current >= 0 && i < current,
    }));
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
