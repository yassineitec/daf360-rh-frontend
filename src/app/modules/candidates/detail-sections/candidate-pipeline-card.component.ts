import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CardComponent, StepperComponent, StepperConfig, StepperStep,
} from '@khalilrebhiitec/daf360';

import { CandidateInterview } from '../interview.model';
import { OfferResponse } from '../../pipeline/services/offer.service';

/**
 * Recruitment rail on `/rh/candidates/:id` — above the tab strip, in the right column.
 *
 * It follows the process as it is being rebuilt, step by step, not the old status list.
 * For now it holds the two steps that exist:
 *
 *   1. Entretiens — RH plans the interviews, they are held, each interviewer files a PV.
 *      Done once at least one interview is planned and every live one is DONE (PVs in).
 *   2. Validation RH — RH reads the PVs and validates each interview; the step closes when
 *      the candidature is accepted (« Valider la candidature », status leaves PENDING).
 *   3. Offre — the salary negotiation, both ways (V133): RH, the DAF and the candidate
 *      exchange figures round after round. The step ends when BOTH parties agree — the
 *      candidate accepts an offer, or the DAF approves the candidate's own figure — which
 *      moves the candidature past OFFER_SENT.
 *
 * Later steps (IT, onboarding) are added here as they are reworked.
 *
 * State comes from the interviews themselves, so the rail moves as soon as a PV or a
 * validation lands (the page refreshes its interview list after every change). Completion
 * is set on EVERY step (explicit mode of daf-stepper), and `currentStep` is -1 once both
 * are done or the candidature was ended — no row is then highlighted as active.
 */
@Component({
  selector: 'rh-candidate-pipeline-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, StepperComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'md', radius: 'xl' }">
      <daf-stepper
        [steps]="railSteps()"
        [currentStep]="currentIndex()"
        [config]="railConfig()" />

      <!-- REJECTED / ARCHIVED: the rail stops where the candidature stopped; this says why. -->
      @if (ended()) {
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

  readonly status     = input.required<string>();
  /** The candidate's interviews (the page's copy, refreshed after every change). */
  readonly interviews = input<CandidateInterview[]>([]);
  /** The live offer round, or null before the first one. */
  readonly offer      = input<OfferResponse | null>(null);

  protected readonly ended = computed(() => ['REJECTED', 'ARCHIVED'].includes(this.status()));

  /** The candidature has moved past the interview stage (accepted, offer, IT, hired…). */
  private readonly past = computed(() => this.status() !== 'PENDING' && !this.ended());

  /** Both parties agreed on the salary: the candidature left the offer step. */
  private readonly offerAgreed = computed(() =>
    ['IT_IN_PROGRESS', 'EMAIL_RECEIVED', 'HR_IN_PROGRESS', 'HIRED'].includes(this.status()));

  private readonly live = computed(() => this.interviews().filter(i => i.status !== 'CANCELLED'));

  private readonly interviewsDone = computed(() => {
    const ivs = this.live();
    return this.past() || (ivs.length > 0 && ivs.every(i => i.status === 'DONE'));
  });

  /** -1 when every step is done or the candidature was ended. */
  protected readonly currentIndex = computed(() => {
    if (this.ended() || this.offerAgreed()) return -1;
    if (this.past()) return 2;
    return this.interviewsDone() ? 1 : 0;
  });

  protected readonly railSteps = computed<StepperStep[]>(() => {
    this.translate.currentLang();
    const t = (k: string, p?: Record<string, unknown>) => this.translate.instant('CANDIDATES.RAIL.' + k, p);
    const ivs = this.live();
    const filed = ivs.filter(i => i.status === 'DONE').length;
    const validated = ivs.filter(i => !!i.result).length;

    const interviewsSub = this.past() ? t('INTERVIEWS_DONE')
      : !ivs.length ? t('INTERVIEWS_NONE')
      : t('INTERVIEWS_PV', { filed, total: ivs.length });
    const validationSub = this.past() ? t('VALIDATION_DONE')
      : ivs.length ? t('VALIDATION_COUNT', { validated, total: ivs.length })
      : undefined;

    const o = this.offer();
    const offerSub = this.offerAgreed() ? t('OFFER_AGREED')
      : !this.past() ? undefined
      : !o ? t('OFFER_NONE')
      : o.status === 'DRAFT' && o.proposedBy === 'CANDIDATE' ? t('OFFER_CANDIDATE_COUNTER', { round: o.roundNumber })
      : o.status === 'DRAFT' && o.proposedBy === 'DAF' ? t('OFFER_DAF_TO_SEND', { round: o.roundNumber })
      : o.status === 'DRAFT' ? t('OFFER_DAF', { round: o.roundNumber })
      : o.status === 'SENT' ? t('OFFER_CANDIDATE', { round: o.roundNumber })
      : undefined;

    return [
      { title: t('INTERVIEWS'), icon: 'record_voice_over', subtitle: interviewsSub,
        completed: this.interviewsDone() },
      { title: t('VALIDATION'), icon: 'fact_check', subtitle: validationSub,
        completed: this.past() },
      { title: t('OFFER'), icon: 'handshake', subtitle: offerSub,
        completed: this.offerAgreed() },
    ];
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
