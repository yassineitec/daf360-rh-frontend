import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { SectionCardComponent } from '../../../shared/detail/section-card.component';

/** The coded candidate workflow, in order. Drives the stepper's past/current/future state. */
const PIPELINE_STEPS = [
  'PENDING', 'ACCEPTED', 'OFFER_SENT', 'IT_IN_PROGRESS',
  'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED',
] as const;

interface Step {
  status: string;
  state: 'past' | 'current' | 'future';
}

/**
 * Recruitment stepper, under the identity card in the sticky left column of
 * `/rh/candidates/:id`.
 *
 * The state per step is computed here rather than in three template-called
 * methods, and the colours are **lib token classes** — the page used to build
 * `var(--color-…)` strings in TS and bind them to `[style.background]` /
 * `[style.color]`, which meant a theme change had to be mirrored in the
 * component (UI-PLAYBOOK §3/§4).
 */
@Component({
  selector: 'rh-candidate-pipeline-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-section-card
      [title]="'CANDIDATES.DETAIL.RECRUITMENT_STEPS' | translate"
      icon="linear_scale">

      <ol class="flex flex-col">
        @for (step of steps(); track step.status; let last = $last) {
          <li class="flex items-center gap-3 py-1">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  [class]="dotClass(step.state)">
              @switch (step.state) {
                @case ('past') {
                  <span class="material-symbols-outlined text-[14px]"
                        style="font-variation-settings:'FILL' 1">check</span>
                }
                @case ('current') {
                  <span class="material-symbols-outlined text-[14px]"
                        style="font-variation-settings:'FILL' 1">radio_button_checked</span>
                }
                @default {
                  <span class="h-2 w-2 rounded-full bg-outline/30"></span>
                }
              }
            </span>
            <span class="text-[13px]"
                  [class]="step.state === 'current' ? 'font-semibold text-teal' : 'text-on-surface-variant'">
              {{ ('CANDIDATES.STATUS.' + step.status) | translate }}
            </span>
          </li>
          @if (!last) {
            <li aria-hidden="true" class="ml-3 h-2.5 w-px bg-outline-variant"></li>
          }
        }
      </ol>

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
  readonly status = input.required<string>();

  /** REJECTED / ARCHIVED are off the happy path: no step matches, so every step reads "future". */
  protected readonly rejected = computed(() => ['REJECTED', 'ARCHIVED'].includes(this.status()));

  protected readonly steps = computed<Step[]>(() => {
    const current = PIPELINE_STEPS.indexOf(this.status() as (typeof PIPELINE_STEPS)[number]);
    return PIPELINE_STEPS.map((status, i) => ({
      status,
      state: current < 0 ? 'future' : i < current ? 'past' : i === current ? 'current' : 'future',
    }));
  });

  protected dotClass(state: Step['state']): string {
    switch (state) {
      case 'current': return 'bg-teal text-white';
      case 'past':    return 'bg-tertiary-container text-on-tertiary-container';
      default:        return 'bg-surface-container-high text-on-surface-variant';
    }
  }
}
