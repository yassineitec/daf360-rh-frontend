import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { OffboardingTask } from '../models/offboarding.model';
import { isSettled } from '../offboarding-display';
import { ListRowComponent } from '../../../shared/detail/list-row.component';

/**
 * The catalog tasks of one stage, with the controls that settle them.
 *
 * This existed nowhere before. Of the 9 tasks V44 seeds, only `FINAL_SETTLEMENT` had a
 * button (stage 6) and `EXIT_INTERVIEW` auto-completes server-side when the interview is
 * saved — the other seven could never leave `PENDING`, and `openSkipModal()` on the case
 * page was wired to nothing at all. Since `ASSET_RETURN_IT` is `is_blocking` and
 * `validateWorkflow` refuses while a blocking task is open, that meant **no file could be
 * validated through the UI**.
 *
 * One shared block rather than a bespoke button per stage, so the seven stages cannot
 * disagree on what a due date, a blocking task or a skip looks like. Stateless like every
 * other stage part: tasks in, intent out — the page owns the confirm modals, which already
 * existed and whose endpoints are live.
 */
@Component({
  selector: 'rh-stage-tasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, StatusBadgeComponent, ListRowComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <div>
      <h4 class="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
        <span class="material-symbols-outlined text-[16px]">task_alt</span>
        {{ 'OFFBOARDING.DETAIL.TASKS_TITLE' | translate }}
      </h4>

      <div class="flex flex-col gap-2">
        @for (task of tasks(); track task.id) {
          <rh-list-row
            [icon]="iconOf(task)"
            [title]="task.taskLabel"
            [meta]="metaOf(task)"
            [state]="rowState(task)">
            <div trailing class="flex items-center gap-2">

              @if (task.isBlocking && !settled(task)) {
                <daf-badge [label]="'OFFBOARDING.BADGE.BLOCKING' | translate"
                           [options]="{ variant: 'danger', size: 'sm', pill: true }" />
              }

              @if (settled(task)) {
                <daf-badge [label]="'OFFBOARDING.TASK_STATUS.' + task.status | translate"
                           [options]="{ variant: task.status === 'DONE' ? 'success' : 'neutral',
                                        size: 'sm', pill: true }" />
              } @else if (canEdit()) {
                <daf-button
                  [options]="{ variant: 'teal', size: 'sm', iconStart: 'check',
                               label: ('OFFBOARDING.DETAIL.COMPLETE' | translate) }"
                  (onClick)="complete.emit(task)" />
                <!-- A blocking task has no Ignorer: the API refuses it outright
                     (BUSINESS_RULE_VIOLATION), so offering it would only produce a toast. -->
                @if (!task.isBlocking) {
                  <daf-button
                    [options]="{ variant: 'ghost', size: 'sm',
                                 label: ('OFFBOARDING.DETAIL.SKIP' | translate) }"
                    (onClick)="skip.emit(task)" />
                }
              } @else {
                <daf-badge [label]="'OFFBOARDING.TASK_STATUS.' + task.status | translate"
                           [options]="{ variant: task.status === 'BLOCKED' ? 'danger' : 'neutral',
                                        size: 'sm', pill: true }" />
              }
            </div>
          </rh-list-row>
        }
        @empty {
          <p class="text-[13px] italic text-on-surface-variant">
            {{ 'OFFBOARDING.DETAIL.TASKS_EMPTY' | translate }}
          </p>
        }
      </div>
    </div>
  `,
})
export class StageTasksComponent {
  private translate = inject(TranslateService);

  readonly tasks   = input.required<OffboardingTask[]>();
  /** The stage's own `canActOnStage`, not the file-wide gate. */
  readonly canEdit = input(false);

  readonly complete = output<OffboardingTask>();
  readonly skip     = output<OffboardingTask>();

  protected settled(task: OffboardingTask): boolean {
    return isSettled(task);
  }

  protected iconOf(task: OffboardingTask): string {
    if (task.status === 'DONE')    return 'check_circle';
    if (task.status === 'SKIPPED') return 'do_not_disturb_on';
    if (task.status === 'BLOCKED') return 'error';
    return 'radio_button_unchecked';
  }

  protected rowState(task: OffboardingTask): 'default' | 'done' | 'urgent' | 'muted' {
    if (task.status === 'DONE')    return 'done';
    if (task.status === 'SKIPPED') return 'muted';
    if (task.status === 'BLOCKED' || this.overdue(task)) return 'urgent';
    return 'default';
  }

  private overdue(task: OffboardingTask): boolean {
    if (isSettled(task) || !task.dueDate) return false;
    return new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
  }

  /**
   * "Responsable IT · échéance 12/09" — owner and due date on one line. The owner role is
   * resolved through i18n; an `owner_role` the catalog admin invented shows its raw code
   * rather than a blank, so the miss is visible instead of silent.
   */
  protected metaOf(task: OffboardingTask): string {
    this.translate.currentLang();
    const parts: string[] = [];

    const roleKey = 'OFFBOARDING.OWNER_ROLE.' + task.ownerRole;
    const role = this.translate.instant(roleKey);
    parts.push(role === roleKey ? task.ownerRole : role);

    if (task.dueDate && !isSettled(task)) {
      const due = new Date(task.dueDate).toLocaleDateString('fr-FR');
      parts.push(this.translate.instant(
        this.overdue(task) ? 'OFFBOARDING.DETAIL.TASK_OVERDUE' : 'OFFBOARDING.DETAIL.TASK_DUE',
        { date: due },
      ));
    }
    if (task.status === 'SKIPPED' && task.skipReason) {
      parts.push(task.skipReason);
    }
    return parts.join(' · ');
  }
}
