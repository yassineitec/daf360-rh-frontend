import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import { ButtonComponent } from '@khalilrebhiitec/daf360';

import { OffboardingTask, OffboardingWorkflowInstance } from '../models/offboarding.model';
import { StageView, stampDate } from '../offboarding-display';

/**
 * Stage 7 — Clôture du dossier.
 *
 * `disabled` while any blocking task is outstanding — the design's locked,
 * un-openable header. Once reachable it carries the one irreversible action on the
 * page, and that still goes through the page's confirmation modal.
 */
@Component({
  selector: 'rh-stage-closure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, ButtonComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      @if (closed()) {
        <div class="flex flex-col items-center gap-2 rounded-2xl border border-tertiary/20 bg-tertiary/5 p-6 text-center">
          <span class="material-symbols-outlined text-[32px] text-tertiary">verified</span>
          <p class="text-[14px] font-bold text-on-surface">
            {{ 'OFFBOARDING.STAGE.CLOSURE_DONE' | translate }}
          </p>
          <p class="text-[12px] text-on-surface-variant">
            {{ stampDate(wf().validatedAt ?? wf().completionDate) }}
          </p>
        </div>
      } @else {
        <div class="flex flex-col items-start gap-4">
          <p class="text-[13px] text-on-surface-variant">
            {{ 'OFFBOARDING.STAGE.CLOSURE_BODY' | translate }}
          </p>
          @if (blockers().length) {
            <ul class="flex flex-col gap-1">
              @for (t of blockers(); track t.id) {
                <li class="flex items-center gap-2 text-[12px] text-on-surface-variant">
                  <span class="material-symbols-outlined text-[14px] text-warning">pending</span>
                  {{ t.taskLabel }}
                </li>
              }
            </ul>
          }
          @if (canEdit()) {
            <daf-button
              [options]="{
                variant: 'teal', iconStart: 'check_circle',
                label: ('OFFBOARDING.DETAIL.VALIDATE' | translate),
                disabled: blockers().length > 0, loading: validating()
              }"
              (onClick)="validate.emit()" />
          }
        </div>
      }
    </rh-stage-panel>
  `,
})
export class StageClosureComponent {
  readonly view       = input.required<StageView>();
  readonly wf         = input.required<OffboardingWorkflowInstance>();
  readonly blockers   = input<OffboardingTask[]>([]);
  readonly canEdit    = input(false);
  readonly validating = input(false);

  readonly validate   = output<void>();

  protected readonly stampDate = stampDate;

  protected readonly closed = computed(() => {
    const s = this.wf().status;
    return s === 'VALIDATED' || s === 'ARCHIVED';
  });

  protected readonly locked = computed(() => this.view().state === 'locked');
}
