import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StagePanelComponent } from './stage-panel.component';
import { ButtonComponent, MultiDatePickerComponent } from '@khalilrebhiitec/daf360';

import {
  OffboardingTask, OffboardingWorkflowInstance, SettlementLine,
} from '../models/offboarding.model';
import { StageView, money, shortDate } from '../offboarding-display';
import { StageTasksComponent } from './stage-tasks.component';
import { isoToDate } from '../../../shared/date-picker.utils';

/**
 * Stage 6 — Paie & Solde de tout compte.
 *
 * Two states, both in the design: **locked** while blocking work is outstanding —
 * a banner naming what is missing and a link that opens the offending stage — and
 * the figures themselves, dimmed until payroll validates.
 *
 * The breakdown is EDITABLE, not computed (V63). There is no settlement engine because two
 * of the three usual lines have no source in rh-service: no leave-balance table for the
 * congés payés, and no per-pays convention scale for l'indemnité de rupture — salary and leave
 * live in payroll-service. Only the prorata 13ᵉ mois is derivable, from `salaire_net_rh` and
 * the hire date, and it is offered as a suggestion the user can override (`isSuggested`).
 *
 * `settlement` is null until a line exists, so the card shows its own empty state rather than
 * a total of zero.
 */
@Component({
  selector: 'rh-stage-payroll',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StagePanelComponent, ButtonComponent, MultiDatePickerComponent, StageTasksComponent,
    TranslatePipe,
  ],
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
                @for (line of s.lines; track line.id ?? line.label) {
                  <div class="group flex items-center justify-between gap-3">
                    <span class="flex min-w-0 items-center gap-1.5 text-on-surface-variant">
                      <span class="truncate">{{ line.label }}</span>
                      <!-- Marks a figure the system proposed and nobody has confirmed. It is
                           cleared the moment anyone edits the line. -->
                      @if (line.isSuggested) {
                        <span class="material-symbols-outlined shrink-0 text-[14px] text-primary"
                              [title]="'OFFBOARDING.SETTLEMENT.SUGGESTED_HINT' | translate">
                          lightbulb
                        </span>
                      }
                    </span>
                    <span class="flex shrink-0 items-center gap-1">
                      <span class="font-bold"
                            [class]="line.amount < 0 ? 'text-danger' : 'text-on-surface'">
                        {{ money(line.amount, s.currency ?? 'TND') }}
                      </span>
                      @if (canEdit()) {
                        <button type="button"
                          class="flex h-6 w-6 items-center justify-center rounded text-outline-variant
                                 transition-colors hover:bg-tertiary/10 hover:text-tertiary"
                          [title]="'OFFBOARDING.SETTLEMENT.EDIT_LINE' | translate"
                          (click)="editLine.emit(line)">
                          <span class="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button type="button"
                          class="flex h-6 w-6 items-center justify-center rounded text-outline-variant
                                 transition-colors hover:bg-danger/10 hover:text-danger"
                          [title]="'OFFBOARDING.SETTLEMENT.DELETE_LINE' | translate"
                          (click)="deleteLine.emit(line)">
                          <span class="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      }
                    </span>
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
                @if (canEdit()) {
                  <daf-button class="mt-2 block"
                    [options]="{ variant: 'ghost', size: 'sm', iconStart: 'add',
                                 label: ('OFFBOARDING.SETTLEMENT.ADD_LINE' | translate) }"
                    (onClick)="addLine.emit()" />
                }
              </div>
            } @else {
              <!-- No engine to lock behind: the amounts are entered, because two of the three
                   standard lines have no source in rh-service (no leave balance, no convention
                   scale). Only the prorata 13ᵉ mois can be proposed. -->
              <p class="mb-3 text-[13px] italic text-on-surface-variant">
                {{ 'OFFBOARDING.SETTLEMENT.EMPTY' | translate }}
              </p>
              @if (canEdit()) {
                <div class="flex flex-wrap gap-2">
                  <daf-button
                    [options]="{ variant: 'teal', size: 'sm', iconStart: 'lightbulb',
                                 label: ('OFFBOARDING.SETTLEMENT.SUGGEST' | translate),
                                 loading: suggesting() }"
                    (onClick)="suggest.emit()" />
                  <daf-button
                    [options]="{ variant: 'secondary', size: 'sm', iconStart: 'add',
                                 label: ('OFFBOARDING.SETTLEMENT.ADD_LINE' | translate) }"
                    (onClick)="addLine.emit()" />
                </div>
              }
            }
          </div>

          <div class="flex flex-col gap-4">
            <!-- V63 — settlement_payment_mode, joined and masked from the profile's bank details. -->
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

            <!-- V63 — settlement_execution_date -->
            <div class="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                {{ 'OFFBOARDING.STAGE.PAYROLL_EXECUTION_DATE' | translate }}
              </span>
              @if (canEdit()) {
                <daf-multi-date-picker
                  [value]="executionDate()"
                  [config]="{ selectionMode: 'single', fullWidth: true }"
                  (valueChange)="executionDateChange.emit($event)" />
              } @else {
                <span class="text-[13px] font-bold text-on-surface">
                  {{ shortDate(wf().settlementExecutionDate) }}
                </span>
              }
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

      <!-- FINAL_SETTLEMENT is excluded: it has the prominent CTA above, and two controls
           for one task is worse than none. This is what makes EXPENSE_CLOSE reachable —
           it had no control anywhere, and the stage could not go done without it. -->
      @if (otherTasks().length) {
        <rh-stage-tasks class="mt-8"
          [tasks]="otherTasks()"
          [canEdit]="canEdit()"
          (complete)="completeTask.emit($event)"
          (skip)="skipTask.emit($event)" />
      }
    </rh-stage-panel>
  `,
})
export class StagePayrollComponent {
  readonly view     = input.required<StageView>();
  readonly wf       = input.required<OffboardingWorkflowInstance>();
  /**
   * Blocking tasks outstanding **elsewhere** in the file — why this stage is locked.
   *
   * Must NOT include FINAL_SETTLEMENT. It is itself `is_blocking = 1`, so the page's full
   * `blockers()` list contains this stage: passing that made the lock banner cite "Solde de
   * tout compte" as its own blocker and disabled the only button that could complete it.
   * The page passes `payrollBlockers()` for exactly this reason.
   */
  readonly blockers = input<OffboardingTask[]>([]);
  readonly tasks    = input<OffboardingTask[]>([]);
  readonly canEdit  = input(false);

  readonly suggesting = input(false);

  readonly goToBlockers      = output<void>();
  readonly completeSettlement = output<OffboardingTask>();
  readonly completeTask      = output<OffboardingTask>();
  readonly skipTask          = output<OffboardingTask>();
  readonly suggest           = output<void>();
  readonly addLine           = output<void>();
  readonly editLine          = output<SettlementLine>();
  readonly deleteLine        = output<SettlementLine>();
  readonly executionDateChange = output<Date | Date[] | null>();

  protected readonly executionDate = computed(
    () => isoToDate(this.wf().settlementExecutionDate ?? ''),
  );

  /** The stage's tasks minus the settlement, which has its own CTA in the panel above. */
  protected readonly otherTasks = computed(
    () => this.tasks().filter(t => t.taskCode !== 'FINAL_SETTLEMENT'),
  );

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
