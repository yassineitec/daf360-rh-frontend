import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import { OffboardingWorkflowInstance } from '../../lifecycle/models/lifecycle.model';
import { KanbanCandidate } from '../services/pipeline.service';
import { BoardColumn, BoardStageKey, OFFBOARDING_ACCENT, OFFBOARDING_KEY } from '../board.model';
import { PipelineKanbanCardComponent } from '../components/pipeline-kanban-card.component';
import { OffboardingKanbanCardComponent } from '../components/offboarding-kanban-card.component';

/** A candidate plus the board stage it was grouped into — the stage drives the card footer. */
export interface MobilePipelineItem {
  candidate: KanbanCandidate;
  stage: BoardStageKey;
}

/**
 * Mobile view of /rh/candidates: horizontal stage pills instead of board
 * columns, then a single vertical card list. Same card components as the desktop
 * board.
 *
 * This replaces the old mobile experience, which was the *desktop board itself*
 * — 85vw columns inside a horizontal scroller — plus a bespoke KPI strip. Both
 * are gone: `daf-metric-card` at `grid-cols-3 gap-2` covers small widths, and
 * the board is now desktop-only (`hidden sm:block`).
 */
@Component({
  selector: 'rh-pipeline-mobile-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PipelineKanbanCardComponent, OffboardingKanbanCardComponent, SkeletonComponent, TranslatePipe],
  host: { class: 'sm:hidden' },
  styles: [`
    .custom-scroll { scrollbar-width: none; }
    .custom-scroll::-webkit-scrollbar { display: none; }
  `],
  template: `
    <div class="flex flex-col gap-4">

      <!-- Stage pills -->
      @if (!loading()) {
        <div class="flex items-center gap-2 overflow-x-auto custom-scroll">
          <button type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold
                   border transition-colors shrink-0"
            [class.bg-primary]="stageFilter() === null"
            [class.border-primary]="stageFilter() === null"
            [class.text-white]="stageFilter() === null"
            [class.border-outline-variant]="stageFilter() !== null"
            [class.text-outline]="stageFilter() !== null"
            (click)="stageFilterChange.emit(null)">
            {{ 'PIPELINE.ALL' | translate }} <span class="opacity-70">{{ totalCount() }}</span>
          </button>

          @for (col of columns(); track col.key) {
            <button type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold
                     border border-outline-variant transition-colors shrink-0"
              [class.bg-surface-container]="stageFilter() === col.key"
              [class.text-on-surface]="stageFilter() === col.key"
              [class.text-outline]="stageFilter() !== col.key"
              (click)="stageFilterChange.emit(col.key)">
              <span class="w-2 h-2 rounded-full" [style.background]="col.accent"></span>
              {{ col.label }} <span class="opacity-70">{{ col.candidates.length }}</span>
            </button>
          }

          @if (showOffboarding()) {
            <button type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold
                     border border-outline-variant transition-colors shrink-0"
              [class.bg-surface-container]="stageFilter() === offboardingKey"
              [class.text-on-surface]="stageFilter() === offboardingKey"
              [class.text-outline]="stageFilter() !== offboardingKey"
              (click)="stageFilterChange.emit(offboardingKey)">
              <span class="w-2 h-2 rounded-full" [style.background]="offboardingAccent"></span>
              {{ 'PIPELINE.OFFBOARDING.COLUMN' | translate }} <span class="opacity-70">{{ offboarding().length }}</span>
            </button>
          }
        </div>
      }

      @if (loading()) {
        <div class="flex flex-col gap-3">
          @for (i of skeletonCards(); track i) {
            <daf-skeleton variant="block" radius="xl" width="100%" height="240px" />
          }
        </div>
      } @else if (stageFilter() === offboardingKey) {
        <div class="flex flex-col gap-3">
          @for (o of offboarding(); track o.id) {
            <rh-offboarding-kanban-card [item]="o" (open)="openOffboarding.emit(o.id)" />
          } @empty {
            <div class="flex flex-col items-center gap-2 py-16 text-center text-outline">
              <span class="material-symbols-outlined text-[40px] opacity-30">logout</span>
              <p class="text-[13px]">{{ 'PIPELINE.OFFBOARDING.EMPTY' | translate }}</p>
            </div>
          }
        </div>
      } @else {
        <div class="flex flex-col gap-3">
          @for (item of items(); track item.candidate.id) {
            <rh-pipeline-kanban-card
              [candidate]="item.candidate"
              [stage]="item.stage"
              [showChevron]="true"
              [actioning]="actioningId() === item.candidate.id"
              (open)="open.emit(item.candidate.id)"
              (sendOffer)="sendOffer.emit({ candidate: item.candidate, event: $event })"
              (acceptOffer)="acceptOffer.emit({ candidate: item.candidate, event: $event })"
              (renegotiate)="renegotiate.emit({ candidate: item.candidate, event: $event })"
              (refuse)="refuse.emit({ candidate: item.candidate, event: $event })" />
          } @empty {
            <div class="flex flex-col items-center gap-2 py-16 text-center text-outline">
              <span class="material-symbols-outlined text-[40px] opacity-30">inbox</span>
              <p class="text-[13px]">{{ 'PIPELINE.NO_CANDIDATES' | translate }}</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PipelineMobileSectionComponent {
  readonly columns         = input.required<BoardColumn[]>();
  readonly items           = input.required<MobilePipelineItem[]>();
  readonly totalCount      = input(0);
  readonly stageFilter     = input<string | null>(null);
  readonly offboarding     = input<OffboardingWorkflowInstance[]>([]);
  readonly showOffboarding = input(false);
  readonly loading         = input(false);
  readonly actioningId     = input<number | null>(null);

  readonly stageFilterChange = output<string | null>();
  readonly open              = output<number>();
  readonly openOffboarding   = output<number>();
  readonly sendOffer         = output<{ candidate: KanbanCandidate; event: Event }>();
  readonly acceptOffer       = output<{ candidate: KanbanCandidate; event: Event }>();
  readonly renegotiate       = output<{ candidate: KanbanCandidate; event: Event }>();
  readonly refuse            = output<{ candidate: KanbanCandidate; event: Event }>();

  protected readonly offboardingKey    = OFFBOARDING_KEY;
  protected readonly offboardingAccent = OFFBOARDING_ACCENT;
  protected readonly skeletonCards     = computed(() => [0, 1, 2]);
}
