import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import {
  ButtonComponent, StatusBadgeComponent, BadgeVariant,
} from '@khalilrebhiitec/daf360';

import {
  ExitInterview, OffboardingChecklistItem, OffboardingTask, OffboardingWorkflowInstance,
} from '../models/offboarding.model';
import { StageView, checklistOf, shortDate, stampDate } from '../offboarding-display';
import { ListRowComponent } from '../../../shared/detail/list-row.component';
import { StageTasksComponent } from './stage-tasks.component';

/**
 * Stage 5 — Gestion RH & Documents: the exit interview panel, then the Kit RH.
 *
 * Both halves are live. V62 made the interview *schedulable* — the design's **Planifier** now
 * books it, separately from recording what was said — and the status pill reads the real
 * PENDING/SCHEDULED/DONE rather than inferring one from the record's existence. V60 seeded the
 * KIT checklist and V62's companion endpoint generates its three documents.
 */
@Component({
  selector: 'rh-stage-hr-docs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StagePanelComponent, ButtonComponent, StatusBadgeComponent, ListRowComponent,
    StageTasksComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      <div class="flex flex-col gap-8">

        <!-- ── Entretien de fin ── -->
        <div class="flex flex-col items-start justify-between gap-6 rounded-2xl border
                    border-outline-variant/20 bg-surface-container-lowest p-5 md:flex-row md:items-center">
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full
                        bg-on-surface-variant/10 text-on-surface-variant">
              <span class="material-symbols-outlined text-[24px]">rate_review</span>
            </div>
            <div>
              <p class="text-[14px] font-bold text-on-surface">
                {{ 'OFFBOARDING.STAGE.HR_INTERVIEW_TITLE' | translate }}
              </p>
              <div class="mt-1 flex flex-wrap items-center gap-2">
                <daf-badge [label]="interviewStatusLabel() | translate"
                           [options]="{ variant: interviewVariant(), size: 'sm', pill: true }" />
                @if (done() && interview()?.conductedDate) {
                  <span class="text-[11px] text-on-surface-variant">
                    {{ shortDate(interview()!.conductedDate) }}
                    @if (interview()?.conductedByName) { · {{ interview()!.conductedByName }} }
                  </span>
                } @else if (scheduled() && interview()?.scheduledAt) {
                  <span class="text-[11px] font-semibold text-on-surface-variant">
                    {{ stamp(interview()!.scheduledAt) }}
                  </span>
                }
              </div>
            </div>
          </div>

          <div class="flex w-full flex-wrap gap-2 md:w-auto">
            <!-- Two distinct acts since V62: booking it, and recording what was said. The
                 button used to say "Planifier" and open the record-it form, because the API
                 could not express a planned interview at all. -->
            @if (canEdit() && !done()) {
              <daf-button
                [options]="{
                  variant: 'primary', iconStart: 'calendar_month',
                  label: (scheduled() ? 'OFFBOARDING.KIT.RESCHEDULE'
                                      : 'OFFBOARDING.STAGE.HR_INTERVIEW_SCHEDULE') | translate
                }"
                (onClick)="scheduleInterview.emit()" />
            }
            @if (canEdit()) {
              <daf-button
                [options]="{ variant: done() ? 'ghost' : 'teal', iconStart: 'edit_note',
                             label: (done() ? 'OFFBOARDING.KIT.EDIT_INTERVIEW'
                                            : 'OFFBOARDING.KIT.RECORD_INTERVIEW') | translate }"
                (onClick)="viewInterview.emit()" />
            } @else if (interview()) {
              <daf-button
                [options]="{ variant: 'ghost', iconStart: 'visibility',
                             label: ('OFFBOARDING.STAGE.HR_INTERVIEW_VIEW' | translate) }"
                (onClick)="viewInterview.emit()" />
            }
          </div>
        </div>

        <!-- ── Tâches de l'étape ──
             EXIT_INTERVIEW auto-completes server-side when the interview is saved, so it
             will usually already read Terminé here. WORK_CERTIFICATE and
             INTERNAL_ANNOUNCEMENT had no control at all before this. -->
        <rh-stage-tasks
          [tasks]="tasks()"
          [canEdit]="canEdit()"
          (complete)="completeTask.emit($event)"
          (skip)="skipTask.emit($event)" />

        <!-- ── Kit RH — V60 + V62 — the KIT checklist and its documents ── -->
        <div>
          <h4 class="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <span class="material-symbols-outlined text-[16px]">article</span>
            {{ 'OFFBOARDING.STAGE.HR_KIT_TITLE' | translate }}
          </h4>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            @for (item of kitItems(); track item.code) {
              <rh-list-row
                [title]="item.label"
                [meta]="item.isDone ? item.completedByName : null"
                [state]="item.isDone ? 'done' : 'default'">
                <div trailing class="flex items-center gap-1">
                  @if (item.documentUrl) {
                    <a class="flex h-7 w-7 items-center justify-center rounded-lg text-tertiary
                              transition-colors hover:bg-tertiary/10"
                       [href]="item.documentUrl" target="_blank" rel="noopener"
                       [title]="'OFFBOARDING.KIT.OPEN_DOC' | translate">
                      <span class="material-symbols-outlined text-[18px]">description</span>
                    </a>
                  }
                  @if (canEdit()) {
                    <!-- Generating is also the tick: the document and the checklist line are
                         the same fact, so there is one control, not two. -->
                    <button type="button"
                      class="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant
                             transition-colors hover:bg-tertiary/10 hover:text-tertiary
                             disabled:opacity-40"
                      [disabled]="generating() === item.code"
                      [title]="(item.isDone ? 'OFFBOARDING.KIT.REGENERATE'
                                            : 'OFFBOARDING.KIT.GENERATE') | translate"
                      (click)="generateDoc.emit(item.code)">
                      <span class="material-symbols-outlined text-[18px]">
                        {{ generating() === item.code ? 'progress_activity' : 'autorenew' }}
                      </span>
                    </button>
                  }
                  <span class="material-symbols-outlined text-[20px]"
                        [class]="item.isDone ? 'text-tertiary' : 'text-outline-variant'">
                    {{ item.isDone ? 'check_circle' : 'circle' }}
                  </span>
                </div>
              </rh-list-row>
            }
            @empty {
              @for (label of KIT_PLACEHOLDERS; track label) {
                <rh-list-row [title]="label | translate" state="muted">
                  <div trailing>
                    <span class="material-symbols-outlined text-[20px] text-outline-variant">circle</span>
                  </div>
                </rh-list-row>
              }
            }
          </div>

          <daf-button class="mt-6 block"
            [options]="{
              variant: 'secondary', fullWidth: true, iconStart: 'cloud_download',
              label: ('OFFBOARDING.STAGE.HR_KIT_DOWNLOAD' | translate),
              disabled: !generatedCount(),
              loading: downloading()
            }"
            (onClick)="downloadKit.emit()" />

          @if (!generatedCount()) {
            <p class="mt-2 text-center text-[11px] italic text-on-surface-variant">
              {{ 'OFFBOARDING.KIT.NOTHING_GENERATED' | translate }}
            </p>
          }
        </div>
      </div>
    </rh-stage-panel>
  `,
})
export class StageHrDocsComponent {
  readonly view      = input.required<StageView>();
  readonly wf        = input.required<OffboardingWorkflowInstance>();
  readonly interview = input<ExitInterview | null>(null);
  readonly tasks     = input<OffboardingTask[]>([]);
  readonly canEdit   = input(false);
  /** Item code currently being generated, so only that row spins. */
  readonly generating  = input<string | null>(null);
  readonly downloading = input(false);

  readonly scheduleInterview = output<void>();
  readonly viewInterview     = output<void>();
  readonly downloadKit       = output<void>();
  readonly generateDoc       = output<string>();
  readonly completeTask      = output<OffboardingTask>();
  readonly skipTask          = output<OffboardingTask>();

  protected readonly shortDate = shortDate;
  protected readonly stamp     = stampDate;

  protected readonly scheduled = computed(() => this.interview()?.status === 'SCHEDULED');
  protected readonly done      = computed(() => {
    const iv = this.interview();
    // A record that predates V62 has no status but does have a conducted date.
    return !!iv && (iv.status === 'DONE' || (!iv.status && !!iv.conductedDate));
  });

  /** How many Kit RH documents actually exist — the zip needs at least one. */
  protected readonly generatedCount = computed(
    () => this.kitItems().filter(i => !!i.documentUrl).length,
  );

  /** The three documents the design names, until the KIT group exists. */
  protected readonly KIT_PLACEHOLDERS = [
    'OFFBOARDING.STAGE.HR_KIT_WORK_CERTIFICATE',
    'OFFBOARDING.STAGE.HR_KIT_UNEMPLOYMENT',
    'OFFBOARDING.STAGE.HR_KIT_SETTLEMENT_RECEIPT',
  ];

  protected readonly kitItems = computed<OffboardingChecklistItem[]>(
    () => checklistOf(this.wf().checklistItems, 'KIT'),
  );

  /** Reads the real status (V62) instead of inferring one from the record's existence. */
  protected readonly interviewStatusLabel = computed(() => {
    if (this.done())      return 'OFFBOARDING.STAGE.HR_INTERVIEW_DONE';
    if (this.scheduled()) return 'OFFBOARDING.STAGE.HR_INTERVIEW_SCHEDULED';
    return 'OFFBOARDING.STAGE.HR_INTERVIEW_PENDING';
  });

  protected readonly interviewVariant = computed<BadgeVariant>(() => {
    if (this.done())      return 'success';
    if (this.scheduled()) return 'warning';
    return 'danger';
  });
}
