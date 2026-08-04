import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import { ButtonComponent, StatusBadgeComponent, ToggleComponent } from '@khalilrebhiitec/daf360';

import { OffboardingWorkflowInstance } from '../models/offboarding.model';
import { StageView, daysUntil, shortDate } from '../offboarding-display';

/**
 * Stage 2 — Validation Manager & RH: the design's two side-by-side panels, the manager's
 * decision on the left and the RH adjustment on the right.
 *
 * Live since V59. It used to be entirely decorative — every field it rendered was an
 * optional TypeScript property that no column or endpoint provided, and `managerValidated`
 * fell back to `wf.validatedAt`, the STAGE-7 closure, so the manager panel turned green
 * the moment the file was closed.
 *
 * The two panels are ordered, not parallel: RH validates *after* the manager, which the
 * API enforces too. Beyond the design, this panel also names who it is waiting on, shows
 * the theoretical date beside the negotiated one (that gap is the decision RH is actually
 * making), and says out loud what the notice toggle costs.
 */
@Component({
  selector: 'rh-stage-validation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, ButtonComponent, StatusBadgeComponent, ToggleComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">

        <!-- ── Validation Manager ── -->
        <div class="flex flex-col rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
          <div class="mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-tertiary">person_check</span>
            <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {{ 'OFFBOARDING.STAGE.VALIDATION_MANAGER' | translate }}
            </span>
          </div>

          @if (managerValidated()) {
            @if (wf().managerComment) {
              <p class="mb-2 text-[13px] italic text-on-surface-variant">“{{ wf().managerComment }}”</p>
            } @else {
              <p class="mb-2 text-[13px] italic text-on-surface-variant/60">
                {{ 'OFFBOARDING.STAGE.VALIDATION_NO_COMMENT' | translate }}
              </p>
            }
            <daf-badge [label]="'OFFBOARDING.STAGE.VALIDATION_APPROVED' | translate"
                       [options]="{ variant: 'success', size: 'sm', pill: true }" />
            <p class="mt-2 text-[11px] text-on-surface-variant/60">
              {{ wf().managerValidatedByName ?? '—' }} · {{ shortDate(wf().managerValidatedAt) }}
            </p>
          } @else {
            <daf-badge [label]="'OFFBOARDING.STAGE.VALIDATION_AWAITING' | translate"
                       [options]="{ variant: 'warning', size: 'sm', pill: true }" />
            <!-- Names who we are waiting on. The panel used to be simply blank, which
                 reads as "nothing to do here" rather than "someone owes us a decision". -->
            <p class="mt-2 text-[11px] text-on-surface-variant">
              {{ 'OFFBOARDING.VALIDATION.AWAITING_FROM' | translate:
                   { name: wf().handoverManagerName ?? ('OFFBOARDING.VALIDATION.NO_MANAGER' | translate) } }}
            </p>
          }

          @if (canValidateAsManager()) {
            <daf-button class="mt-4 block"
              [options]="{ variant: managerValidated() ? 'secondary' : 'teal', size: 'sm',
                           iconStart: 'rate_review', fullWidth: true,
                           label: (managerValidated() ? 'OFFBOARDING.VALIDATION.MANAGER_EDIT'
                                                      : 'OFFBOARDING.VALIDATION.MANAGER_ACT') | translate }"
              (onClick)="validateManager.emit()" />
          }
        </div>

        <!-- ── Ajustement RH ── -->
        <div class="flex flex-col rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
          <div class="mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-tertiary">admin_panel_settings</span>
            <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {{ 'OFFBOARDING.STAGE.VALIDATION_HR_ADJUST' | translate }}
            </span>
          </div>

          <div class="flex flex-col">
            <!-- Theoretical beside negotiated, with the gap: RH is deciding whether to
                 accept a departure that differs from the convention's own date. Showing
                 only the negotiated one hid the question being asked. -->
            <div class="flex items-center justify-between gap-3 border-b border-outline-variant/40 py-2">
              <span class="text-[13px] text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.DECLARATION_THEORETICAL_EXIT' | translate }}
              </span>
              <span class="text-[13px] text-on-surface-variant">{{ shortDate(wf().theoreticalExitDate) }}</span>
            </div>

            <div class="flex items-center justify-between gap-3 border-b border-outline-variant/40 py-2">
              <span class="text-[13px] text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.VALIDATION_FINAL_END_DATE' | translate }}
              </span>
              <span class="flex items-center gap-2">
                <span class="text-[13px] font-bold text-on-surface">{{ shortDate(wf().lastWorkingDay) }}</span>
                @if (gapLabel()) {
                  <daf-badge [label]="gapLabel()!" [options]="{ variant: 'warning', size: 'sm', pill: true }" />
                }
              </span>
            </div>

            <div class="flex items-start justify-between gap-3 py-2">
              <span class="text-[13px] text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.VALIDATION_NOTICE_PAID' | translate }}
                <!-- The toggle has a payroll consequence; saying so turns a mystery switch
                     into an informed choice. -->
                <span class="mt-0.5 block text-[11px] text-on-surface-variant/60">
                  {{ 'OFFBOARDING.VALIDATION.NOTICE_PAID_HINT' | translate }}
                </span>
              </span>
              <daf-toggle [options]="{ disabled: true }" [checked]="wf().noticePaidNotWorked ?? false" />
            </div>

            <div class="flex items-center justify-between gap-3 border-t border-outline-variant/40 py-2">
              <span class="text-[13px] text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.VALIDATION_HR_STAMP' | translate }}
              </span>
              <span class="text-[13px] font-bold text-on-surface">{{ shortDate(wf().hrValidatedAt) }}</span>
            </div>

            @if (wf().hrValidatedByName) {
              <p class="text-[11px] text-on-surface-variant/60">{{ wf().hrValidatedByName }}</p>
            }
          </div>

          @if (canValidateAsHr()) {
            <daf-button class="mt-4 block"
              [options]="{ variant: hrValidated() ? 'secondary' : 'teal', size: 'sm',
                           iconStart: 'verified', fullWidth: true,
                           label: (hrValidated() ? 'OFFBOARDING.VALIDATION.HR_EDIT'
                                                 : 'OFFBOARDING.VALIDATION.HR_ACT') | translate }"
              (onClick)="validateHr.emit()" />
          } @else if (!managerValidated()) {
            <!-- Why the button is absent, rather than an inert control. -->
            <p class="mt-4 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
              <span class="material-symbols-outlined text-[15px]">lock</span>
              {{ 'OFFBOARDING.VALIDATION.HR_BLOCKED' | translate }}
            </p>
          }
        </div>
      </div>
    </rh-stage-panel>
  `,
})
export class StageValidationComponent {
  readonly view = input.required<StageView>();
  readonly wf   = input.required<OffboardingWorkflowInstance>();
  readonly canValidateAsManager = input(false);
  readonly canValidateAsHr      = input(false);

  readonly validateManager = output<void>();
  readonly validateHr      = output<void>();

  protected readonly shortDate = shortDate;

  /** The real stamp only — never `validatedAt`, which is the stage-7 file closure. */
  protected readonly managerValidated = computed(() => !!this.wf().managerValidatedAt);
  protected readonly hrValidated      = computed(() => !!this.wf().hrValidatedAt);

  /**
   * "+12 j" / "−5 j" — how far the negotiated departure sits from the theoretical one.
   * Null when either date is missing or they coincide, so the badge only appears when
   * there is genuinely a divergence to weigh.
   */
  protected readonly gapLabel = computed<string | null>(() => {
    const w = this.wf();
    if (!w.theoreticalExitDate || !w.lastWorkingDay) return null;
    const theoretical = daysUntil(w.theoreticalExitDate);
    const agreed      = daysUntil(w.lastWorkingDay);
    if (theoretical == null || agreed == null) return null;
    const gap = agreed - theoretical;
    if (gap === 0) return null;
    return `${gap > 0 ? '+' : '−'}${Math.abs(gap)} j`;
  });
}
