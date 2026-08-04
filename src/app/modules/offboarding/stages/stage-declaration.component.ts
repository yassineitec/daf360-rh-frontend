import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import { ButtonComponent, ToggleComponent } from '@khalilrebhiitec/daf360';

import { OffboardingWorkflowInstance } from '../models/offboarding.model';
import { StageView, isDeclarationComplete, shortDate } from '../offboarding-display';
import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';

/**
 * Stage 1 — Déclaration du départ.
 *
 * Renders as `rh-profile-field` rows rather than the design's grey readonly `<input>`s —
 * same label-over-value shape, no fake editable affordance, no raw hex. Editing happens
 * in a modal the page owns (`complete`), so this component stays stateless like the other
 * six stages.
 *
 * It is no longer purely a record of what was captured at creation: a file can be opened
 * from a profile with nothing but a departure type, so the departure date is filled HERE,
 * and doing so is what unlocks the rest of the wizard.
 */
@Component({
  selector: 'rh-stage-declaration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, ButtonComponent, ToggleComponent, ProfileFieldComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      <!-- The gate, said plainly: until the departure date is set, stages 2-7 are locked
           and the file sits in the Déclaration column of the board. -->
      @if (!complete()) {
        <div class="mb-5 flex items-start gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] text-on-surface">
          <span class="material-symbols-outlined shrink-0 text-[18px] text-primary">info</span>
          <span>{{ 'OFFBOARDING.DECLARATION.INCOMPLETE_HINT' | translate }}</span>
        </div>
      }

      <div class="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">

        <rh-profile-field
          [label]="'OFFBOARDING.STAGE.DECLARATION_REASON' | translate"
          [value]="reasonLabel()" />

        <rh-profile-field
          [label]="'OFFBOARDING.STAGE.DECLARATION_NOTIFIED_ON' | translate"
          [value]="shortDate(wf().triggerDate)" />

        <!-- The negotiated departure date. It was only ever in the page header, yet it is
             the field this stage exists to capture and the one the gate reads. -->
        <rh-profile-field
          [label]="'OFFBOARDING.STAGE.DECLARATION_LAST_DAY' | translate"
          [value]="shortDate(wf().lastWorkingDay)" />

        <!-- V57 — justification_document_url / _name on the instance -->
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

        <!-- V57 — notice_period_label -->
        <rh-profile-field
          [label]="'OFFBOARDING.STAGE.DECLARATION_NOTICE_PERIOD' | translate"
          [value]="wf().noticePeriodLabel" />

        <!-- V57 — notice_waiver_requested. Still a disabled toggle, not a control: this
             panel reports the declaration; it is edited in the modal. -->
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

        <!-- V57 — theoretical_exit_date. Distinct from lastWorkingDay,
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

      @if (canEdit()) {
        <div class="mt-6 flex justify-end border-t border-outline-variant/40 pt-5">
          <daf-button
            [options]="{ variant: complete() ? 'secondary' : 'teal',
                         iconStart: complete() ? 'edit' : 'edit_calendar',
                         label: (complete() ? 'OFFBOARDING.DECLARATION.EDIT'
                                            : 'OFFBOARDING.DECLARATION.COMPLETE') | translate }"
            (onClick)="edit.emit()" />
        </div>
      }
    </rh-stage-panel>
  `,
})
export class StageDeclarationComponent {
  readonly view        = input.required<StageView>();
  readonly wf          = input.required<OffboardingWorkflowInstance>();
  readonly reasonLabel = input('');
  /** RH, and the file still open — the page resolves both. */
  readonly canEdit     = input(false);

  /** Opens the page's declaration modal. */
  readonly edit = output<void>();

  /** Same predicate the stage resolver uses, so the button and the gate cannot disagree. */
  protected complete(): boolean {
    return isDeclarationComplete(this.wf());
  }

  protected readonly shortDate = shortDate;
}
