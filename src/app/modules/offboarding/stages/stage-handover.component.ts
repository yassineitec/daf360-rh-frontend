import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import { ButtonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { OffboardingChecklistItem, OffboardingWorkflowInstance } from '../models/offboarding.model';
import { StageView, checklistOf, initialsOf } from '../offboarding-display';
import { ListRowComponent } from '../../../shared/detail/list-row.component';

/**
 * Stage 3 — Passation & Relève: who takes over, what was handed to them, and the
 * PV that closes it.
 *
 * The successor comes from `handoverManagerProfileId` (V45). The checklist is
 * PENDING V46 — `offboarding_checklist_items` group `HANDOVER`
 * (OFFBOARDING-BACKEND-CHANGES.md §1d); until then the list renders its own empty
 * state rather than a fake row.
 */
@Component({
  selector: 'rh-stage-handover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, ButtonComponent, StatusBadgeComponent, ListRowComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      <div class="flex flex-col gap-6">

        <!-- ── Successeur ── -->
        <div class="flex items-center gap-4 rounded-2xl border border-outline-variant/20
                    bg-surface-container-lowest p-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                      bg-tertiary/10 text-[13px] font-bold text-tertiary">
            {{ initials() }}
          </div>
          <div class="min-w-0">
            <p class="truncate text-[13px] font-bold text-on-surface">
              {{ wf().handoverManagerName ?? ('OFFBOARDING.STAGE.HANDOVER_NO_SUCCESSOR' | translate) }}
            </p>
            <p class="text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              {{ 'OFFBOARDING.STAGE.HANDOVER_SUCCESSOR' | translate }}
            </p>
          </div>
        </div>

        <!-- ── Checklist de passation — PENDING V46 (group HANDOVER) ── -->
        <div>
          <h4 class="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <span class="material-symbols-outlined text-[16px]">checklist</span>
            {{ 'OFFBOARDING.STAGE.HANDOVER_CHECKLIST' | translate }}
          </h4>

          <div class="flex flex-col gap-2">
            @for (item of items(); track item.code) {
              <rh-list-row
                [icon]="item.isDone ? 'check_circle' : 'radio_button_unchecked'"
                [title]="item.label"
                [state]="item.isDone ? 'done' : 'default'">
                <div trailing>
                  @if (item.documentUrl) {
                    <a class="text-[11px] font-bold text-tertiary underline"
                       [href]="item.documentUrl" target="_blank" rel="noopener">
                      {{ 'OFFBOARDING.STAGE.HANDOVER_DOC_LINK' | translate }}
                    </a>
                  } @else if (item.isDone) {
                    <daf-badge [label]="'OFFBOARDING.STAGE.HANDOVER_TRANSFERRED' | translate"
                               [options]="{ variant: 'success', size: 'sm', pill: true }" />
                  }
                </div>
              </rh-list-row>
            }
            @empty {
              <p class="text-[13px] italic text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.HANDOVER_CHECKLIST_EMPTY' | translate }}
              </p>
            }
          </div>
        </div>

        <!-- ── PV de passation — PENDING V46 (handover_minutes_url) ── -->
        <div class="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-tertiary/30 p-4">
          <span class="material-symbols-outlined text-[32px] text-tertiary">task</span>
          <p class="text-[13px] font-bold text-on-surface">
            {{ (wf().handoverMinutesUrl ? 'OFFBOARDING.STAGE.HANDOVER_PV_DONE' : 'OFFBOARDING.STAGE.HANDOVER_PV_PENDING') | translate }}
          </p>
          <daf-button
            [options]="{
              variant: 'secondary', size: 'sm', iconStart: 'visibility',
              label: ('OFFBOARDING.STAGE.HANDOVER_PV_VIEW' | translate),
              disabled: !wf().handoverMinutesUrl
            }"
            (onClick)="viewMinutes.emit()" />
        </div>
      </div>
    </rh-stage-panel>
  `,
})
export class StageHandoverComponent {
  readonly view      = input.required<StageView>();
  readonly wf        = input.required<OffboardingWorkflowInstance>();

  readonly viewMinutes = output<void>();

  protected readonly items = computed<OffboardingChecklistItem[]>(
    () => checklistOf(this.wf().checklistItems, 'HANDOVER'),
  );

  protected readonly initials = computed(() => initialsOf(this.wf().handoverManagerName));
}
