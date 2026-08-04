import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import { ButtonComponent } from '@khalilrebhiitec/daf360';

import { OffboardingTask, OffboardingWorkflowInstance } from '../models/offboarding.model';
import { StageView, money, shortDate } from '../offboarding-display';

/**
 * Stage 6 — Paie & Solde de tout compte.
 *
 * Two states, both in the design: **locked** while blocking work is outstanding —
 * a banner naming what is missing and a link that opens the offending stage — and
 * the figures themselves, dimmed until payroll validates.
 *
 * PENDING V46: `settlement` is null until a settlement engine exists (see
 * OFFBOARDING-BACKEND-CHANGES.md §4), so the breakdown renders its own placeholder
 * rather than invented numbers. This is deliberate — the design's own state for
 * this card is "calcul bloqué".
 */
@Component({
  selector: 'rh-stage-payroll',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, ButtonComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">

      <div class="flex flex-col gap-6">

        <!-- ── Lock banner ── -->
        @if (blockers().length) {
          <div class="flex items-start gap-4 rounded-2xl border border-danger/20 bg-danger/5 p-4">
            <span class="material-symbols-outlined mt-0.5 text-danger">lock</span>
            <div class="min-w-0">
              <p class="text-[13px] font-bold text-danger">
                {{ 'OFFBOARDING.STAGE.PAYROLL_LOCKED_TITLE' | translate }}
              </p>
              <p class="mb-3 text-[13px] text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.PAYROLL_LOCKED_BODY' | translate }}
              </p>
              <ul class="mb-3 flex flex-col gap-1">
                @for (t of blockers(); track t.id) {
                  <li class="flex items-center gap-2 text-[12px] text-on-surface-variant">
                    <span class="material-symbols-outlined text-[14px] text-danger">chevron_right</span>
                    {{ t.taskLabel }}
                  </li>
                }
              </ul>
              <button type="button"
                class="flex items-center gap-1 text-[13px] font-bold text-danger underline hover:opacity-80"
                (click)="goToBlockers.emit()">
                {{ 'OFFBOARDING.STAGE.PAYROLL_CHECK_MISSING' | translate }}
                <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        }

        <!-- ── Figures — dimmed while payroll has not validated ── -->
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2" [class.opacity-60]="!validated()">

          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
            <h4 class="mb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {{ 'OFFBOARDING.STAGE.PAYROLL_BREAKDOWN' | translate }}
            </h4>

            @if (settlement(); as s) {
              <div class="flex flex-col gap-2 text-[13px]">
                @for (line of s.lines; track line.label) {
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-on-surface-variant">{{ line.label }}</span>
                    <span class="font-bold text-on-surface">{{ money(line.amount, s.currency ?? 'TND') }}</span>
                  </div>
                }
                <div class="mt-2 flex items-center justify-between gap-3 border-t border-outline-variant/20 pt-2">
                  <span class="text-[15px] font-black text-on-surface">
                    {{ 'OFFBOARDING.STAGE.PAYROLL_TOTAL_NET' | translate }}
                  </span>
                  <span class="text-[15px] font-black text-tertiary">
                    {{ money(s.totalNet, s.currency ?? 'TND') }}
                  </span>
                </div>
              </div>
            } @else {
              <!-- PENDING V46 — no settlement engine yet. -->
              <p class="text-[13px] italic text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.PAYROLL_NO_FIGURES' | translate }}
              </p>
            }
          </div>

          <div class="flex flex-col gap-4">
            <!-- PENDING V46 — settlement_payment_mode, joined from the profile's RIB. -->
            <div class="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.PAYROLL_PAYMENT_MODE' | translate }}
              </span>
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-on-surface-variant">account_balance</span>
                <span class="text-[13px] text-on-surface">
                  {{ wf().settlementPaymentMode ?? ('OFFBOARDING.STAGE.PAYROLL_PAYMENT_TRANSFER' | translate) }}
                </span>
              </div>
            </div>

            <!-- PENDING V46 — settlement_execution_date -->
            <div class="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.PAYROLL_EXECUTION_DATE' | translate }}
              </span>
              <span class="text-[13px] font-bold text-on-surface">
                {{ shortDate(wf().settlementExecutionDate) }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/50">
              <span class="material-symbols-outlined text-[16px]">info</span>
              {{ (validated() ? 'OFFBOARDING.STAGE.PAYROLL_VALIDATED' : 'OFFBOARDING.STAGE.PAYROLL_AWAITING') | translate }}
            </div>

            @if (canEdit() && settlementTask() && !validated()) {
              <daf-button
                [options]="{ variant: 'teal', size: 'sm', iconStart: 'check_circle',
                             label: ('OFFBOARDING.STAGE.PAYROLL_MARK_DONE' | translate),
                             disabled: blockers().length > 0 }"
                (onClick)="completeSettlement.emit(settlementTask()!)" />
            }
          </div>
        </div>
      </div>
    </rh-stage-panel>
  `,
})
export class StagePayrollComponent {
  readonly view     = input.required<StageView>();
  readonly wf       = input.required<OffboardingWorkflowInstance>();
  /** Blocking tasks outstanding anywhere in the file — why this stage is locked. */
  readonly blockers = input<OffboardingTask[]>([]);
  readonly tasks    = input<OffboardingTask[]>([]);
  readonly canEdit  = input(false);

  readonly goToBlockers      = output<void>();
  readonly completeSettlement = output<OffboardingTask>();

  protected readonly money     = money;
  protected readonly shortDate = shortDate;

  protected readonly settlement = computed(() => this.wf().settlement ?? null);

  protected readonly settlementTask = computed(
    () => this.tasks().find(t => t.taskCode === 'FINAL_SETTLEMENT') ?? null,
  );

  protected readonly validated = computed(() => {
    const t = this.settlementTask();
    return !!t && (t.status === 'DONE' || t.status === 'SKIPPED');
  });
}
