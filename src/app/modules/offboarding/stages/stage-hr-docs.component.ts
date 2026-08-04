import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import {
  ButtonComponent, StatusBadgeComponent, BadgeVariant,
} from '@khalilrebhiitec/daf360';

import {
  ExitInterview, OffboardingChecklistItem, OffboardingWorkflowInstance,
} from '../models/offboarding.model';
import { StageView, checklistOf, shortDate } from '../offboarding-display';
import { ListRowComponent } from '../../../shared/detail/list-row.component';

/**
 * Stage 5 — Gestion RH & Documents: the exit interview panel, then the Kit RH.
 *
 * The design's primary action here is **Planifier** — scheduling, which the API
 * cannot express yet (an interview is either saved or absent). Until V46 the
 * button opens the existing "record the interview" form, and the status pill
 * reports presence rather than a real PENDING/SCHEDULED/DONE state (see
 * OFFBOARDING-BACKEND-CHANGES.md §1c, §3).
 */
@Component({
  selector: 'rh-stage-hr-docs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, ButtonComponent, StatusBadgeComponent, ListRowComponent, TranslatePipe],
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
                @if (interview()?.conductedDate) {
                  <span class="text-[11px] text-on-surface-variant">
                    {{ shortDate(interview()!.conductedDate) }}
                  </span>
                }
              </div>
            </div>
          </div>

          <div class="flex w-full gap-2 md:w-auto">
            <daf-button
              [options]="{
                variant: 'primary', iconStart: 'calendar_month',
                label: ('OFFBOARDING.STAGE.HR_INTERVIEW_SCHEDULE' | translate),
                disabled: !canEdit()
              }"
              (onClick)="scheduleInterview.emit()" />
            @if (interview()) {
              <daf-button
                [options]="{ variant: 'ghost', iconStart: 'visibility',
                             label: ('OFFBOARDING.STAGE.HR_INTERVIEW_VIEW' | translate) }"
                (onClick)="viewInterview.emit()" />
            }
          </div>
        </div>

        <!-- ── Kit RH — PENDING V46 (checklist group KIT + document generation) ── -->
        <div>
          <h4 class="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <span class="material-symbols-outlined text-[16px]">article</span>
            {{ 'OFFBOARDING.STAGE.HR_KIT_TITLE' | translate }}
          </h4>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            @for (item of kitItems(); track item.code) {
              <rh-list-row
                [title]="item.label"
                [state]="item.isDone ? 'done' : 'default'">
                <div trailing>
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
              disabled: true
            }"
            (onClick)="downloadKit.emit()" />
        </div>
      </div>
    </rh-stage-panel>
  `,
})
export class StageHrDocsComponent {
  readonly view      = input.required<StageView>();
  readonly wf        = input.required<OffboardingWorkflowInstance>();
  readonly interview = input<ExitInterview | null>(null);
  readonly canEdit   = input(false);

  readonly scheduleInterview = output<void>();
  readonly viewInterview     = output<void>();
  readonly downloadKit       = output<void>();

  protected readonly shortDate = shortDate;

  /** The three documents the design names, until the KIT group exists. */
  protected readonly KIT_PLACEHOLDERS = [
    'OFFBOARDING.STAGE.HR_KIT_WORK_CERTIFICATE',
    'OFFBOARDING.STAGE.HR_KIT_UNEMPLOYMENT',
    'OFFBOARDING.STAGE.HR_KIT_SETTLEMENT_RECEIPT',
  ];

  protected readonly kitItems = computed<OffboardingChecklistItem[]>(
    () => checklistOf(this.wf().checklistItems, 'KIT'),
  );

  /** PENDING V46 — real status. Presence of a record is all we can report today. */
  protected readonly interviewStatusLabel = computed(() => {
    const iv = this.interview();
    if (!iv) return 'OFFBOARDING.STAGE.HR_INTERVIEW_PENDING';
    if (iv.status === 'SCHEDULED') return 'OFFBOARDING.STAGE.HR_INTERVIEW_SCHEDULED';
    return 'OFFBOARDING.STAGE.HR_INTERVIEW_DONE';
  });

  protected readonly interviewVariant = computed<BadgeVariant>(() => {
    const iv = this.interview();
    if (!iv) return 'danger';
    return iv.status === 'SCHEDULED' ? 'warning' : 'success';
  });
}
