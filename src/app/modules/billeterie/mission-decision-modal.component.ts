import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, FormFieldComponent } from '@khalilrebhiitec/daf360';

import { ModalComponent } from '../../shared/modal.component';
import { Mission } from '../missions/mission.model';
import { destination, formatAmount, localeDate, localeOf } from '../missions/mission-display';

export interface MissionDecision {
  notes: string | null;
}

/**
 * Validate or refuse — one modal for both, used by RH and by the finance remote alike
 * (which keeps its own copy of the same shape).
 *
 * The asymmetry it encodes is the one the backend enforces: a refusal REQUIRES a reason, an
 * approval does not. So the submit button is disabled on an empty refusal, and the notes
 * field is labelled differently in each case — "motif du refus" and "commentaire" are not
 * the same question of the reviewer.
 */
@Component({
  selector: 'rh-mission-decision-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent, FormFieldComponent, TranslatePipe],
  template: `
    <app-modal
      [title]="(approve() ? 'MISSIONS.DECISION.APPROVE_TITLE' : 'MISSIONS.DECISION.REJECT_TITLE') | translate"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()">

      <!-- One gap-5 column, the same rhythm as the expense sheet and the plan form. -->
      <div class="flex flex-col gap-5">

        <!-- The identity block finance's own decision modal uses: reference line, the
             figure in large type, then the context. What is being decided has to be
             unmistakable before the buttons are pressed. -->
        @if (mission(); as m) {
          <div class="flex flex-col gap-1 rounded-xl bg-surface-container-low px-4 py-3">
            <span class="text-label-caps text-outline">
              {{ m.employeeName }} · {{ destination(m) }}
            </span>
            @if (m.expenses) {
              <span class="text-[22px] font-black leading-tight text-on-surface">
                {{ formatAmount(m.expenses.totalEstimatedCost, m.expenses.currency) }}
              </span>
            }
            <span class="text-body-sm text-on-surface-variant">
              {{ m.title }} · {{ localeDate(m.startDate) }} → {{ localeDate(m.endDate) }}
            </span>
          </div>
        }

        @if (error()) {
          <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            <span class="material-symbols-outlined text-[18px]">error</span>
            {{ error() }}
          </div>
        }

        <daf-form-field
          [value]="notes()"
          [options]="{
            type: 'textarea', rows: 3, fullWidth: true, maxLength: 1000,
            required: !approve(),
            label: ((approve() ? 'MISSIONS.DECISION.NOTES' : 'MISSIONS.DECISION.REASON') | translate),
            placeholder: ((approve() ? 'MISSIONS.DECISION.NOTES_PLACEHOLDER' : 'MISSIONS.DECISION.REASON_PLACEHOLDER') | translate)
          }"
          (valueChange)="onNotes($event)" />
      </div>

      <div slot="footer">
        <daf-button
          [options]="{ variant: 'secondary', label: ('MISSIONS.COMMON.CANCEL' | translate) }"
          (onClick)="closed.emit()" />
        <daf-button
          [options]="{
            variant: approve() ? 'teal' : 'danger',
            iconStart: approve() ? 'check_circle' : 'cancel',
            label: ((approve() ? 'MISSIONS.DECISION.CONFIRM_APPROVE' : 'MISSIONS.DECISION.CONFIRM_REJECT') | translate),
            loading: submitting(), disabled: submitting() || !canSubmit()
          }"
          (onClick)="submit.emit({ notes: notes() })" />
      </div>
    </app-modal>
  `,
})
export class MissionDecisionModalComponent {
  private translate = inject(TranslateService);

  readonly visible    = input(false);
  readonly mission    = input<Mission | null>(null);
  readonly approve    = input(true);
  readonly submitting = input(false);
  readonly error      = input<string | null>(null);

  readonly closed = output<void>();
  readonly submit = output<MissionDecision>();

  protected readonly notes = signal<string | null>(null);

  constructor() {
    // Cleared on every open: a reason typed for one mission must never be submitted
    // against the next one.
    effect(() => {
      this.visible();
      this.notes.set(null);
    });
  }

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  /**
   * Bound so the template keeps its short call sites while the locale follows the UI
   * language. The bare helpers default to fr-FR, which printed French dates and number
   * groupings under English labels.
   */
  protected readonly destination = destination;
  protected readonly localeDate = (iso: string | null) => localeDate(iso, this.locale());
  protected readonly formatAmount = (v: number | null | undefined, c: string | null) =>
    formatAmount(v, c, this.locale());

  /** Mirrors the backend: a refusal needs a reason, an approval does not. */
  protected readonly canSubmit = computed(() => this.approve() || !!this.notes()?.trim());

  protected onNotes(value: unknown): void {
    const text = typeof value === 'string' ? value : '';
    this.notes.set(text.trim().length ? text : null);
  }
}
