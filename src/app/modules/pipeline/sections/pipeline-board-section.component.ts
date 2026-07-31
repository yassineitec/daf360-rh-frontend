import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  computed, effect, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import { OffboardingWorkflowInstance } from '../../lifecycle/models/lifecycle.model';
import { KanbanCandidate } from '../services/pipeline.service';
import { BoardColumn, OFFBOARDING_ACCENT } from '../board.model';
import { PipelineKanbanCardComponent } from '../components/pipeline-kanban-card.component';
import { OffboardingKanbanCardComponent } from '../components/offboarding-kanban-card.component';

/**
 * Desktop / tablet pipeline board (UI-PLAYBOOK §8b section architecture).
 *
 * Stateless with respect to the data: columns, the offboarding list and the
 * loading flag all come in as inputs and every interaction goes back out as an
 * output. The one thing it does own is its **own scroll geometry** — the board
 * element lives here, so the horizontal navigation minimap that reads
 * `scrollLeft` / `scrollWidth` belongs here too rather than in the page.
 */
@Component({
  selector: 'rh-pipeline-board-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PipelineKanbanCardComponent, OffboardingKanbanCardComponent, SkeletonComponent, TranslatePipe],
  host: { class: 'hidden sm:block' },
  styles: [`
    /* The board scrolls horizontally (wheel / drag / minimap) but hides its
       scrollbar — the minimap already communicates the position. */
    .custom-scroll   { scrollbar-width: none; }
    .custom-scroll::-webkit-scrollbar   { display: none; }
    .custom-scroll-y { scrollbar-width: none; }
    .custom-scroll-y::-webkit-scrollbar { display: none; }
  `],
  template: `
    @if (loading()) {
      <!-- Re-fetch skeleton: the page header, KPIs and toolbar stay on screen (§5). -->
      <div class="flex gap-6 items-start">
        @for (i of skeletonColumns(); track i) {
          <div class="w-80 shrink-0 flex flex-col gap-3">
            <daf-skeleton variant="text" width="45%" height="16px" />
            @for (j of skeletonCards(); track j) {
              <daf-skeleton variant="block" radius="xl" width="100%" height="240px" />
            }
          </div>
        }
      </div>
    } @else {
      <div #board class="flex gap-6 overflow-x-auto pb-4 items-start custom-scroll scroll-smooth"
           (scroll)="syncBoardMetrics()">

        @for (col of columns(); track col.key) {
          <div class="w-80 shrink-0 flex flex-col">

            <!-- Column header -->
            <div class="flex items-center gap-2 px-1 mb-3">
              <span class="w-2.5 h-2.5 rounded-full" [style.background]="col.accent"></span>
              <span class="text-sm font-bold text-on-surface">{{ col.label }}</span>
              <span class="text-xs font-semibold text-on-surface-variant bg-surface-container-high rounded px-2 py-0.5">
                {{ col.candidates.length }}
              </span>
              <button type="button"
                class="flex items-center justify-center w-4 h-4 ml-auto shrink-0 text-outline-variant
                       hover:text-outline transition-colors"
                [title]="(col.sortDir === 'asc' ? 'PIPELINE.SORT_DESC' : 'PIPELINE.SORT_ASC') | translate"
                (click)="toggleSort.emit(col.key)">
                <span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'wght' 200">swap_vert</span>
              </button>
            </div>

            <!-- Cards — shows ~2 at a time, scrolls for the rest -->
            <div class="flex flex-col gap-4 min-h-[120px] max-h-[610px] overflow-y-auto overscroll-contain
                        p-1 pr-2 pt-4 custom-scroll-y">
              @for (c of col.candidates; track c.id) {
                <rh-pipeline-kanban-card
                  [candidate]="c"
                  [stage]="col.key"
                  [actioning]="actioningId() === c.id"
                  (open)="open.emit(c.id)"
                  (sendOffer)="sendOffer.emit({ candidate: c, event: $event })"
                  (acceptOffer)="acceptOffer.emit({ candidate: c, event: $event })"
                  (renegotiate)="renegotiate.emit({ candidate: c, event: $event })"
                  (refuse)="refuse.emit({ candidate: c, event: $event })" />
              } @empty {
                <div class="text-center py-10 text-outline border border-dashed border-outline-variant rounded-xl">
                  <span class="material-symbols-outlined text-[32px] block mb-1">inbox</span>
                  <p class="text-[12px]">{{ 'PIPELINE.NO_CANDIDATE_COLUMN' | translate }}</p>
                </div>
              }
            </div>
          </div>
        }

        <!-- Offboarding — display-only; employees in an active offboarding workflow.
             Not a candidate stage, so it carries no sort control and no accent from
             BOARD_STAGES, and it is absent from the minimap. -->
        @if (showOffboarding()) {
          <div class="w-80 shrink-0 flex flex-col">

            <div class="flex items-center gap-2 px-1 mb-3">
              <span class="w-2.5 h-2.5 rounded-full" [style.background]="offboardingAccent"></span>
              <span class="text-sm font-bold text-on-surface">{{ 'PIPELINE.OFFBOARDING.COLUMN' | translate }}</span>
              <span class="text-xs font-semibold text-on-surface-variant bg-surface-container-high rounded px-2 py-0.5">
                {{ offboarding().length }}
              </span>
            </div>

            <div class="flex flex-col gap-4 min-h-[120px] max-h-[610px] overflow-y-auto overscroll-contain
                        p-1 pr-2 pt-4 custom-scroll-y">
              @for (o of offboarding(); track o.id) {
                <rh-offboarding-kanban-card [item]="o" (open)="openOffboarding.emit(o.id)" />
              } @empty {
                <div class="text-center py-10 text-outline border border-dashed border-outline-variant rounded-xl">
                  <span class="material-symbols-outlined text-[32px] block mb-1">logout</span>
                  <p class="text-[12px]">{{ 'PIPELINE.OFFBOARDING.EMPTY' | translate }}</p>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Horizontal navigation minimap (fixed bottom-right) -->
      @if (boardHasOverflow()) {
        <div class="fixed bottom-6 right-6 z-40">
          <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-2
                      opacity-30 shadow-md origin-bottom-right transition-all duration-200
                      hover:opacity-100 hover:scale-150 hover:shadow-2xl">
            <div class="relative flex gap-1" style="width: 172px;">
              @for (col of columns(); track col.key; let i = $index) {
                <button type="button"
                  class="flex-1 h-12 rounded-md flex flex-col items-center justify-center gap-1
                         transition-transform hover:scale-105"
                  [style.background]="col.badgeBg"
                  [title]="col.label + ' (' + col.candidates.length + ')'"
                  (click)="scrollToColumn(i)">
                  <span class="w-2 h-2 rounded-full" [style.background]="col.accent"></span>
                  <span class="text-[10px] font-bold leading-none" [style.color]="col.accent">
                    {{ col.candidates.length }}
                  </span>
                </button>
              }
              <div class="absolute top-0 bottom-0 rounded-md border-2 border-primary pointer-events-none
                          transition-all duration-150"
                   [style.left]="viewportStyle().left" [style.width]="viewportStyle().width"></div>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class PipelineBoardSectionComponent {
  readonly columns         = input.required<BoardColumn[]>();
  readonly offboarding     = input<OffboardingWorkflowInstance[]>([]);
  readonly showOffboarding = input(false);
  readonly loading         = input(false);
  readonly actioningId     = input<number | null>(null);

  readonly open            = output<number>();
  readonly openOffboarding = output<number>();
  readonly toggleSort      = output<string>();
  readonly sendOffer       = output<{ candidate: KanbanCandidate; event: Event }>();
  readonly acceptOffer     = output<{ candidate: KanbanCandidate; event: Event }>();
  readonly renegotiate     = output<{ candidate: KanbanCandidate; event: Event }>();
  readonly refuse          = output<{ candidate: KanbanCandidate; event: Event }>();

  protected readonly offboardingAccent = OFFBOARDING_ACCENT;

  constructor() {
    // Re-measure whenever the board is (re)built: the minimap reads scrollWidth,
    // which is only meaningful once the new columns are in the DOM.
    effect(() => {
      this.columns();
      this.loading();
      this.showOffboarding();
      setTimeout(() => this.syncBoardMetrics());
    });
  }

  protected readonly skeletonColumns = computed(() => [0, 1, 2, 3]);
  protected readonly skeletonCards   = computed(() => [0, 1]);

  // ── Scroll geometry for the minimap ────────────────────────────────────────
  private readonly board = viewChild<ElementRef<HTMLDivElement>>('board');
  private readonly boardScroll = signal({ left: 0, client: 0, scroll: 0 });

  /** The minimap is only useful once the board actually overflows. */
  protected readonly boardHasOverflow = computed(() => {
    const b = this.boardScroll();
    return b.scroll > b.client + 4;
  });

  /** Position/size of the viewport indicator, as a % of the board width. */
  protected readonly viewportStyle = computed(() => {
    const b = this.boardScroll();
    if (b.scroll <= 0) return { left: '0%', width: '100%' };
    return {
      left:  Math.max(0, (b.left / b.scroll) * 100) + '%',
      width: Math.min(100, (b.client / b.scroll) * 100) + '%',
    };
  });

  @HostListener('window:resize')
  syncBoardMetrics(): void {
    const el = this.board()?.nativeElement;
    if (!el) return;
    this.boardScroll.set({ left: el.scrollLeft, client: el.clientWidth, scroll: el.scrollWidth });
  }

  protected scrollToColumn(index: number): void {
    this.board()?.nativeElement.scrollTo({ left: index * 344, behavior: 'smooth' }); // 320px column + 24px gap
  }
}
