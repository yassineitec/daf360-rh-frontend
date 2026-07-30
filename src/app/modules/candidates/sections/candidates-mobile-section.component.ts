import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import { CandidateListItem } from '../candidate.model';
import { KanbanColumn } from '../kanban.model';
import { CandidateKanbanCardComponent } from '../components/candidate-kanban-card.component';

/**
 * Mobile view of /rh/recrutement: horizontal stage pills instead of kanban
 * columns, then a single vertical card list. Same card component as the desktop
 * board — the two used to be copy-pasted templates that had already drifted.
 */
@Component({
  selector: 'rh-candidates-mobile-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CandidateKanbanCardComponent, SkeletonComponent, TranslatePipe],
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
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors shrink-0"
            [class.bg-primary]="stageFilter() === null"
            [class.border-primary]="stageFilter() === null"
            [class.text-white]="stageFilter() === null"
            [class.border-outline-variant]="stageFilter() !== null"
            [class.text-outline]="stageFilter() !== null"
            (click)="stageFilterChange.emit(null)">
            {{ 'CANDIDATES.KANBAN.ALL' | translate }} <span class="opacity-70">{{ totalCount() }}</span>
          </button>
          @for (col of columns(); track col.key) {
            <button type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border border-outline-variant transition-colors shrink-0"
              [class.bg-surface-container]="stageFilter() === col.key"
              [class.text-on-surface]="stageFilter() === col.key"
              [class.text-outline]="stageFilter() !== col.key"
              (click)="stageFilterChange.emit(col.key)">
              <span class="w-2 h-2 rounded-full" [style.background]="col.accent"></span>
              {{ col.label }} <span class="opacity-70">{{ col.candidates.length }}</span>
            </button>
          }
        </div>
      }

      @if (loading()) {
        <div class="flex flex-col gap-3">
          @for (i of skeletonCards(); track i) {
            <daf-skeleton variant="block" radius="xl" width="100%" height="196px" />
          }
        </div>
      } @else {
        <div class="flex flex-col gap-3">
          @for (c of candidates(); track c.id) {
            <rh-candidate-kanban-card
              [candidate]="c"
              [accent]="accentFor()(c.status)"
              [badgeBg]="badgeBgFor()(c.status)"
              [statusLabel]="statusLabel()(c.status)"
              [showChevron]="true"
              [showQuickActions]="c.status === 'PENDING' && canAcceptReject()"
              [actioning]="actioningId() === c.id"
              (open)="open.emit(c.id)"
              (accept)="accept.emit({ candidate: c, event: $event })"
              (reject)="reject.emit({ candidate: c, event: $event })" />
          } @empty {
            <div class="flex flex-col items-center gap-2 py-16 text-center text-outline">
              <span class="material-symbols-outlined text-[40px] opacity-30">inbox</span>
              <p class="text-[13px]">{{ 'CANDIDATES.KANBAN.NO_CANDIDATE_SHORT' | translate }}</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CandidatesMobileSectionComponent {
  readonly columns         = input.required<KanbanColumn[]>();
  readonly candidates      = input.required<CandidateListItem[]>();
  readonly totalCount      = input(0);
  readonly stageFilter     = input<string | null>(null);
  readonly loading         = input(false);
  readonly canAcceptReject = input(false);
  readonly actioningId     = input<number | null>(null);
  readonly statusLabel     = input.required<(status: string) => string>();
  readonly accentFor       = input.required<(status: string) => string>();
  readonly badgeBgFor      = input.required<(status: string) => string>();

  readonly stageFilterChange = output<string | null>();
  readonly open              = output<number>();
  readonly accept            = output<{ candidate: CandidateListItem; event: Event }>();
  readonly reject            = output<{ candidate: CandidateListItem; event: Event }>();

  protected readonly skeletonCards = computed(() => [0, 1, 2]);
}
