import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { KanbanCardShellComponent } from '../../../shared/kanban-card-shell.component';
import { OffboardingWorkflowInstance } from '../../lifecycle/models/lifecycle.model';
import { OFFBOARDING_ACCENT } from '../board.model';
import { candidateInitials } from '../pipeline-display';

/**
 * One offboarding file, as shown in the board's read-only Offboarding column and
 * in the mobile list. Offboarding is a separate HR workflow — clicking through
 * opens `/rh/lifecycle/:id`, not a candidate — so it gets its own card rather
 * than being squeezed into the candidate one.
 */
@Component({
  selector: 'rh-offboarding-kanban-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KanbanCardShellComponent, StatusBadgeComponent, TranslatePipe],
  template: `
    <rh-kanban-card-shell
      class="min-h-[180px]"
      [surface]="'white'"
      (click)="open.emit()">

      <!-- Employee -->
      <div class="flex items-center gap-3 mb-3">
        <div class="w-12 h-12 rounded-lg flex items-center justify-center text-[14px] font-bold text-white shrink-0"
             [style.background]="accent">
          {{ initials() }}
        </div>
        <div class="min-w-0">
          <h4 class="font-bold text-on-surface truncate">{{ item().employeeFullName || '—' }}</h4>
          <p class="text-xs text-outline truncate">{{ 'LIFECYCLE.REASON.' + item().departureReason | translate }}</p>
        </div>
      </div>

      <!-- Status + SLA -->
      <div class="flex items-center gap-2 mb-3">
        <daf-badge [label]="'LIFECYCLE.STATUS.' + item().status | translate" [options]="{ variant: 'neutral', size: 'sm' }" />
        @if (item().slaBreachFlag) {
          <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider
                       text-danger bg-danger/10 px-2 py-0.5 rounded-full">
            <span class="material-symbols-outlined text-[13px]">warning</span>
            {{ 'PIPELINE.OFFBOARDING.SLA' | translate }}
          </span>
        }
      </div>

      <!-- Footer: last working day + handover manager -->
      <div class="mt-auto pt-3 border-t border-outline-variant flex items-center justify-between gap-2
                  text-on-surface-variant text-[11px]">
        <span class="flex items-center gap-1 min-w-0">
          <span class="material-symbols-outlined text-[14px] shrink-0">event</span>
          <span class="truncate">{{ item().lastWorkingDay || '—' }}</span>
        </span>
        @if (item().handoverManagerName) {
          <span class="flex items-center gap-1 min-w-0 shrink-0">
            <span class="material-symbols-outlined text-[14px] shrink-0">handshake</span>
            <span class="truncate max-w-[120px]">{{ item().handoverManagerName }}</span>
          </span>
        }
      </div>
    </rh-kanban-card-shell>
  `,
})
export class OffboardingKanbanCardComponent {
  readonly item = input.required<OffboardingWorkflowInstance>();
  readonly open = output<void>();

  protected readonly accent = OFFBOARDING_ACCENT;
  protected readonly initials = computed(() => candidateInitials(this.item().employeeFullName));
}
