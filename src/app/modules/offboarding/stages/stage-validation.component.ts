import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import {
  StatusBadgeComponent, ToggleComponent,
} from '@khalilrebhiitec/daf360';

import { OffboardingWorkflowInstance } from '../models/offboarding.model';
import { StageView, shortDate } from '../offboarding-display';

/**
 * Stage 2 — Validation Manager & RH: the design's two side-by-side panels, the
 * manager's decision on the left and the RH adjustment on the right.
 *
 * PENDING V46 throughout (OFFBOARDING-BACKEND-CHANGES.md §1a): the instance carries
 * a single `validatedBy/At` today,
 * which cannot express "manager approved with a comment, then RH adjusted the
 * dates". Both panels fall back to the single stamp so the stage is never empty.
 */
@Component({
  selector: 'rh-stage-validation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, StatusBadgeComponent, ToggleComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">

        <!-- ── Validation Manager ── -->
        <div class="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
          <div class="mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-tertiary">person_check</span>
            <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {{ 'OFFBOARDING.STAGE.VALIDATION_MANAGER' | translate }}
            </span>
          </div>

          <!-- PENDING V46 — manager_comment -->
          @if (wf().managerComment) {
            <p class="mb-2 text-[13px] italic text-on-surface-variant">“{{ wf().managerComment }}”</p>
          } @else {
            <p class="mb-2 text-[13px] italic text-on-surface-variant/60">
              {{ 'OFFBOARDING.STAGE.VALIDATION_NO_COMMENT' | translate }}
            </p>
          }

          @if (managerValidated()) {
            <daf-badge [label]="'OFFBOARDING.STAGE.VALIDATION_APPROVED' | translate"
                       [options]="{ variant: 'success', size: 'sm', pill: true }" />
          } @else {
            <daf-badge [label]="'OFFBOARDING.STAGE.VALIDATION_AWAITING' | translate"
                       [options]="{ variant: 'warning', size: 'sm', pill: true }" />
          }

          <!-- PENDING V46 — manager_validated_by_name / _at -->
          @if (wf().managerValidatedByName || wf().managerValidatedAt) {
            <p class="mt-2 text-[11px] text-on-surface-variant/60">
              {{ wf().managerValidatedByName }} · {{ shortDate(wf().managerValidatedAt) }}
            </p>
          }
        </div>

        <!-- ── Ajustement RH ── -->
        <div class="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
          <div class="mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-tertiary">admin_panel_settings</span>
            <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {{ 'OFFBOARDING.STAGE.VALIDATION_HR_ADJUST' | translate }}
            </span>
          </div>

          <div class="flex flex-col">
            <div class="flex items-center justify-between gap-3 border-b border-outline-variant/40 py-2">
              <span class="text-[13px] text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.VALIDATION_FINAL_END_DATE' | translate }}
              </span>
              <span class="text-[13px] font-bold text-on-surface">{{ shortDate(wf().lastWorkingDay) }}</span>
            </div>

            <!-- PENDING V46 — notice_paid_not_worked -->
            <div class="flex items-center justify-between gap-3 py-2">
              <span class="text-[13px] text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.VALIDATION_NOTICE_PAID' | translate }}
              </span>
              <daf-toggle [options]="{ disabled: true }" [checked]="wf().noticePaidNotWorked ?? false" />
            </div>

            <div class="flex items-center justify-between gap-3 border-t border-outline-variant/40 py-2">
              <span class="text-[13px] text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.VALIDATION_HR_STAMP' | translate }}
              </span>
              <span class="text-[13px] font-bold text-on-surface">
                {{ shortDate(wf().hrValidatedAt ?? wf().validatedAt) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </rh-stage-panel>
  `,
})
export class StageValidationComponent {
  readonly view = input.required<StageView>();
  readonly wf   = input.required<OffboardingWorkflowInstance>();


  protected readonly shortDate = shortDate;

  /** Manager stamp if the split exists, else the single instance stamp. */
  protected managerValidated(): boolean {
    const w = this.wf();
    return !!(w.managerValidatedAt ?? w.validatedAt);
  }
}
