import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { KanbanCardShellComponent } from '../../../shared/kanban-card-shell.component';
import { LifecycleCard } from '../lifecycle-board.model';

/**
 * One card of « Pipeline RH », whatever process it comes from — same anatomy as the other
 * kanban cards (tinted pill row, identity row, bordered footer):
 *
 *   pill    — the CURRENT step (column colour) + an alert when the file is stuck;
 *   body    — name, subtitle, where it stands inside the step, then a few facts;
 *   footer  — the steps ALREADY VALIDATED, ticked, in process order.
 *
 * Purely presentational: the page maps each module's row to a `LifecycleCard`.
 * Not draggable — every step is a real action done on the module's own screen.
 */
@Component({
  selector: 'rh-lifecycle-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KanbanCardShellComponent, TranslatePipe],
  template: `
    <rh-kanban-card-shell [surface]="'white'" [style.cursor]="'pointer'" (click)="open.emit()">

      <div class="flex items-center justify-between gap-2 mb-3">
        <span class="inline-flex items-center gap-1 min-w-0 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider"
              [style.background]="badgeBg()" [style.color]="accent()">
          <span class="material-symbols-outlined text-[13px] shrink-0">{{ card().stepIcon }}</span>
          <span class="truncate">{{ card().stepLabel }}</span>
        </span>
        @if (card().alert) {
          <span class="flex items-center gap-1 text-[11px] font-bold text-danger shrink-0">
            <span class="material-symbols-outlined text-[14px]">warning</span>
            {{ card().alert }}
          </span>
        }
      </div>

      <div class="flex items-center gap-3 min-w-0 mb-2">
        @if (card().avatar && !imageFailed()) {
          <img [src]="card().avatar!" [alt]="card().name" (error)="imageFailed.set(true)"
               class="w-11 h-11 rounded-lg object-cover border border-outline-variant shrink-0" />
        } @else {
          <div class="w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
               [style.background]="accent()">
            {{ card().initials }}
          </div>
        }
        <div class="min-w-0">
          <h4 class="font-bold text-on-surface truncate" [title]="card().name">{{ card().name }}</h4>
          <p class="text-xs text-outline truncate">{{ card().subtitle || '—' }}</p>
        </div>
      </div>

      @if (card().stepDetail) {
        <p class="text-[12px] font-medium text-on-surface-variant mb-2">{{ card().stepDetail }}</p>
      }

      @if (card().meta.length) {
        <div class="flex flex-col gap-1 text-[11px] text-outline">
          @for (m of card().meta; track $index) {
            <span class="flex items-center gap-1 min-w-0" [class.italic]="m.muted" [class.opacity-70]="m.muted">
              <span class="material-symbols-outlined text-[14px] shrink-0">{{ m.icon }}</span>
              <span class="truncate">{{ m.text }}</span>
            </span>
          }
        </div>
      }

      <!-- Footer: the steps already validated. -->
      <div class="pt-3 mt-3 border-t border-outline-variant">
        @if (card().doneSteps.length) {
          <div class="flex flex-wrap gap-1.5">
            @for (s of card().doneSteps; track $index) {
              <span class="inline-flex items-center gap-0.5 rounded bg-teal/10 px-1.5 py-0.5 text-[10px] font-semibold text-teal">
                <span class="material-symbols-outlined text-[12px]">check</span>
                {{ s }}
              </span>
            }
          </div>
        } @else {
          <span class="text-[11px] italic text-outline opacity-70">{{ 'CANDIDATES.LIFECYCLE.NO_STEP_DONE' | translate }}</span>
        }
      </div>
    </rh-kanban-card-shell>
  `,
})
export class LifecycleCardComponent {
  readonly card    = input.required<LifecycleCard>();
  readonly accent  = input<string>('#64748b');
  readonly badgeBg = input<string>('rgba(100,116,139,0.12)');

  readonly open = output<void>();

  protected readonly imageFailed = signal(false);
}
