import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import { ToggleComponent } from '@khalilrebhiitec/daf360';

import { OffboardingWorkflowInstance } from '../models/offboarding.model';
import { StageView, shortDate } from '../offboarding-display';
import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';

/**
 * Stage 1 — Déclaration du départ.
 *
 * Read-only by design: this is what was declared when the file was opened. The
 * design's grey readonly `<input>`s are `rh-profile-field` rows instead — same
 * label-over-value shape, no fake editable affordance, no raw hex.
 */
@Component({
  selector: 'rh-stage-declaration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, ToggleComponent, ProfileFieldComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      <div class="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">

        <rh-profile-field
          [label]="'OFFBOARDING.STAGE.DECLARATION_REASON' | translate"
          [value]="reasonLabel()" />

        <rh-profile-field
          [label]="'OFFBOARDING.STAGE.DECLARATION_NOTIFIED_ON' | translate"
          [value]="shortDate(wf().triggerDate)" />

        <!-- PENDING V46 — justification_document_url / _name on the instance -->
        <div class="flex flex-col gap-0.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            {{ 'OFFBOARDING.STAGE.DECLARATION_JUSTIFICATION' | translate }}
          </span>
          @if (wf().justificationDocumentName) {
            <a class="mt-1 flex items-center gap-2 rounded-xl border border-tertiary/20 bg-tertiary/5 px-3 py-2
                      text-[13px] font-bold text-tertiary transition-colors hover:bg-tertiary/10"
               [href]="wf().justificationDocumentUrl" target="_blank" rel="noopener">
              <span class="material-symbols-outlined text-[18px]">description</span>
              <span class="truncate">{{ wf().justificationDocumentName }}</span>
              <span class="material-symbols-outlined ml-auto text-[18px]">download</span>
            </a>
          } @else {
            <span class="text-[13px] text-on-surface">—</span>
          }
        </div>

        <!-- PENDING V46 — notice_period_label -->
        <rh-profile-field
          [label]="'OFFBOARDING.STAGE.DECLARATION_NOTICE_PERIOD' | translate"
          [value]="wf().noticePeriodLabel" />

        <!-- PENDING V46 — notice_waiver_requested. Disabled: a declaration records
             what happened, it is not a control. -->
        <div class="flex flex-col gap-1.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            {{ 'OFFBOARDING.STAGE.DECLARATION_WAIVER' | translate }}
          </span>
          <div class="flex items-center gap-3">
            <daf-toggle [options]="{ disabled: true }" [checked]="wf().noticeWaiverRequested ?? false" />
            <span class="text-[13px] font-medium text-on-surface-variant">
              {{ (wf().noticeWaiverRequested ? 'OFFBOARDING.STAGE.WAIVER_YES' : 'OFFBOARDING.STAGE.WAIVER_NO') | translate }}
            </span>
          </div>
        </div>

        <!-- PENDING V46 — theoretical_exit_date. Distinct from lastWorkingDay,
             which is the date the two sides negotiated. -->
        <rh-profile-field
          [label]="'OFFBOARDING.STAGE.DECLARATION_THEORETICAL_EXIT' | translate"
          [value]="shortDate(wf().theoreticalExitDate)" />

        @if (wf().departureNotes) {
          <div class="md:col-span-2">
            <rh-profile-field
              [label]="'OFFBOARDING.STAGE.DECLARATION_NOTES' | translate"
              [value]="wf().departureNotes" />
          </div>
        }
      </div>
    </rh-stage-panel>
  `,
})
export class StageDeclarationComponent {
  readonly view        = input.required<StageView>();
  readonly wf          = input.required<OffboardingWorkflowInstance>();
  readonly reasonLabel = input('');


  protected readonly shortDate = shortDate;
}
