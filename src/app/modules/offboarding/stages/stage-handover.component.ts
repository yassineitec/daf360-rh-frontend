import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import { ButtonComponent, CheckboxComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import {
  OffboardingChecklistItem, OffboardingTask, OffboardingWorkflowInstance,
} from '../models/offboarding.model';
import { StageView, checklistOf, initialsOf } from '../offboarding-display';
import { ListRowComponent } from '../../../shared/detail/list-row.component';
import { StageTasksComponent } from './stage-tasks.component';

/**
 * Stage 3 — Passation & Relève: who takes over, what was handed to them, and the PV that
 * closes it.
 *
 * Live since V60. The successor can now be named FROM HERE — before, the only place that
 * set `handoverManagerProfileId` was the optional search in the "Démarrer un offboarding"
 * modal, so a file opened from a profile page had no successor, `KNOWLEDGE_TRANSFER` had no
 * owner, and stage 2's manager panel had nobody but RH able to stamp it.
 *
 * The checklist is per-file rather than seeded: each departure hands over different work,
 * which is why HANDOVER is the one group `offboarding_checklist_items` does not pre-fill.
 */
@Component({
  selector: 'rh-stage-handover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StagePanelComponent, ButtonComponent, CheckboxComponent, StatusBadgeComponent,
    ListRowComponent, StageTasksComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      <div class="flex flex-col gap-6">

        <!-- ── Successeur ── -->
        <div class="flex flex-wrap items-center gap-4 rounded-2xl border border-outline-variant/20
                    bg-surface-container-lowest p-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                      bg-tertiary/10 text-[13px] font-bold text-tertiary">
            {{ initials() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-bold text-on-surface">
              {{ wf().handoverManagerName ?? ('OFFBOARDING.STAGE.HANDOVER_NO_SUCCESSOR' | translate) }}
            </p>
            <p class="text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              {{ 'OFFBOARDING.STAGE.HANDOVER_SUCCESSOR' | translate }}
            </p>
          </div>
          @if (canEdit()) {
            <daf-button
              [options]="{ variant: wf().handoverManagerName ? 'ghost' : 'teal', size: 'sm',
                           iconStart: 'person_search',
                           label: (wf().handoverManagerName ? 'OFFBOARDING.HANDOVER.CHANGE_SUCCESSOR'
                                                            : 'OFFBOARDING.HANDOVER.SET_SUCCESSOR') | translate }"
              (onClick)="assignSuccessor.emit()" />
          }
        </div>

        <!-- No successor blocks more than this stage: the manager panel in stage 2 has
             nobody to sign it, and KNOWLEDGE_TRANSFER has no owner. Say so here. -->
        @if (!wf().handoverManagerProfileId) {
          <p class="flex items-start gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] text-on-surface">
            <span class="material-symbols-outlined shrink-0 text-[18px] text-primary">info</span>
            {{ 'OFFBOARDING.HANDOVER.NO_SUCCESSOR_HINT' | translate }}
          </p>
        }

        <!-- ── Tâches de l'étape ── -->
        <rh-stage-tasks
          [tasks]="tasks()"
          [canEdit]="canEdit()"
          (complete)="completeTask.emit($event)"
          (skip)="skipTask.emit($event)" />

        <!-- ── Checklist de passation (group HANDOVER) ── -->
        <div>
          <div class="mb-3 flex items-center justify-between gap-3">
            <h4 class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              <span class="material-symbols-outlined text-[16px]">checklist</span>
              {{ 'OFFBOARDING.STAGE.HANDOVER_CHECKLIST' | translate }}
              @if (items().length) {
                <span class="font-bold text-tertiary">{{ doneCount() }}/{{ items().length }}</span>
              }
            </h4>
            @if (canEdit()) {
              <daf-button
                [options]="{ variant: 'ghost', size: 'sm', iconStart: 'add',
                             label: ('OFFBOARDING.HANDOVER.ADD_ITEM' | translate) }"
                (onClick)="addItem.emit()" />
            }
          </div>

          <div class="flex flex-col gap-2">
            @for (item of items(); track item.id ?? item.code) {
              <rh-list-row
                [title]="item.label"
                [meta]="item.isDone ? item.completedByName : null"
                [state]="item.isDone ? 'done' : 'default'">
                <div trailing class="flex items-center gap-2">
                  @if (item.documentUrl) {
                    <a class="text-[11px] font-bold text-tertiary underline"
                       [href]="item.documentUrl" target="_blank" rel="noopener">
                      {{ 'OFFBOARDING.STAGE.HANDOVER_DOC_LINK' | translate }}
                    </a>
                  }
                  <daf-checkbox
                    [options]="{ disabled: !canEdit() }"
                    [checked]="item.isDone"
                    (checkedChange)="toggleItem.emit({ item, done: $event })" />
                  @if (canEdit()) {
                    <button type="button"
                      class="flex h-7 w-7 items-center justify-center rounded-lg text-outline-variant
                             transition-colors hover:bg-danger/10 hover:text-danger"
                      [title]="'OFFBOARDING.HANDOVER.REMOVE_ITEM' | translate"
                      (click)="removeItem.emit(item)">
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
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

        <!-- ── PV de passation ── -->
        <div class="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-tertiary/30 p-4">
          <span class="material-symbols-outlined text-[32px] text-tertiary">task</span>
          <p class="text-[13px] font-bold text-on-surface">
            {{ (wf().handoverMinutesUrl ? 'OFFBOARDING.STAGE.HANDOVER_PV_DONE'
                                        : 'OFFBOARDING.STAGE.HANDOVER_PV_PENDING') | translate }}
          </p>
          @if (wf().handoverMinutesName) {
            <p class="text-[11px] text-on-surface-variant">{{ wf().handoverMinutesName }}</p>
          }
          <div class="flex flex-wrap justify-center gap-2">
            <daf-button
              [options]="{ variant: 'secondary', size: 'sm', iconStart: 'visibility',
                           label: ('OFFBOARDING.STAGE.HANDOVER_PV_VIEW' | translate),
                           disabled: !wf().handoverMinutesUrl }"
              (onClick)="viewMinutes.emit()" />
            @if (canEdit()) {
              <daf-button
                [options]="{ variant: 'teal', size: 'sm', iconStart: 'upload_file',
                             label: (wf().handoverMinutesUrl ? 'OFFBOARDING.HANDOVER.PV_REPLACE'
                                                             : 'OFFBOARDING.HANDOVER.PV_UPLOAD') | translate }"
                (onClick)="uploadMinutes.emit()" />
            }
          </div>
        </div>
      </div>
    </rh-stage-panel>
  `,
})
export class StageHandoverComponent {
  readonly view    = input.required<StageView>();
  readonly wf      = input.required<OffboardingWorkflowInstance>();
  readonly tasks   = input<OffboardingTask[]>([]);
  readonly canEdit = input(false);

  readonly viewMinutes     = output<void>();
  readonly uploadMinutes   = output<void>();
  readonly assignSuccessor = output<void>();
  readonly addItem         = output<void>();
  readonly removeItem      = output<OffboardingChecklistItem>();
  readonly toggleItem      = output<{ item: OffboardingChecklistItem; done: boolean }>();
  readonly completeTask    = output<OffboardingTask>();
  readonly skipTask        = output<OffboardingTask>();

  protected readonly items = computed<OffboardingChecklistItem[]>(
    () => checklistOf(this.wf().checklistItems, 'HANDOVER'),
  );

  protected readonly doneCount = computed(() => this.items().filter(i => i.isDone).length);

  protected readonly initials = computed(() => initialsOf(this.wf().handoverManagerName));
}
