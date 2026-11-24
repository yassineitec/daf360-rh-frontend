import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  computed, effect, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import { KanbanCandidate } from '../services/pipeline.service';
import { BOARD_STAGES, BoardColumn } from '../board.model';
import { PipelineKanbanCardComponent } from '../components/pipeline-kanban-card.component';
import { KanbanMinimapComponent, MinimapColumn } from '../../../shared/kanban-minimap.component';
import { FillViewportDirective } from '../../../shared/fill-viewport.directive';

/**
 * Desktop / tablet pipeline board (UI-PLAYBOOK §8b section architecture).
 *
 * Candidate stages only. The read-only Offboarding column that used to sit at the
 * right end of this board now lives on `/rh/recrutement`
 * (`rh-candidates-board-section`), where the lifecycle view belongs.
 *
 * Stateless with respect to the data: the columns and the loading flag come in as
 * inputs and every interaction goes back out as an output. The one thing it does
 * own is its **own scroll geometry** — the board element lives here, so the
 * horizontal navigation minimap that reads `scrollLeft` / `scrollWidth` belongs
 * here too rather than in the page.
 */
@Component({
  selector: 'rh-pipeline-board-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PipelineKanbanCardComponent, KanbanMinimapComponent, FillViewportDirective, SkeletonComponent, TranslatePipe],
  host: { class: 'hidden sm:block' },
  styles: [`
    /* The board scrolls horizontally (wheel / drag / minimap) but hides its
       scrollbar — the minimap already communicates the position. */
    .custom-scroll   { scrollbar-width: none; }
    .custom-scroll::-webkit-scrollbar   { display: none; }
    /* A column's own scroll — the page never scrolls, the columns do: thin, always visible. */
    .col-scroll { overflow-y: auto; /* no overscroll containment: at its top, scrolling up hands over to the page */
                  scrollbar-width: thin; scrollbar-color: transparent transparent; }
    .col-scroll:hover { scrollbar-color: var(--color-outline-variant) transparent; }
    .col-scroll::-webkit-scrollbar { width: 6px; }
    .col-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; }
    .col-scroll:hover::-webkit-scrollbar-thumb { background: var(--color-outline-variant); }
  `],
  template: `
    @if (loading()) {
      <!-- Re-fetch skeleton: the page header, KPIs and toolbar stay on screen (§5). -->
      <div class="flex gap-6 items-start">
        @for (i of skeletonColumns(); track i) {
          <div class="flex-1 min-w-80 flex flex-col gap-3">
            <daf-skeleton variant="text" width="45%" height="16px" />
            @for (j of skeletonCards(); track j) {
              <daf-skeleton variant="block" radius="xl" width="100%" height="240px" />
            }
          </div>
        }
      </div>
    } @else {
      <!-- The page scrolls until the column headers reach the top (rhFillViewport), then each column scrolls its own cards, every card there. -->
      <div #board rhFillViewport class="flex gap-6 overflow-x-auto overflow-y-hidden items-stretch custom-scroll scroll-smooth"
           (scroll)="syncBoardMetrics()">

        <!-- Columns share the full width (flex-1), never narrower than 320px: below that the
             board scrolls sideways, as before. -->
        @for (col of columns(); track col.key) {
          <div class="flex-1 min-w-80 flex flex-col min-h-0" data-board-column>

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

            <!-- Cards — every one, scrolling inside the column; the bottom space lets the last card
                 scroll clear of the minimap. -->
            <div class="col-scroll flex-1 min-h-0 flex flex-col gap-4 p-1 pr-2 pt-4 pb-24">
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

      </div>

      <!-- Minimap — always on screen, bottom-right, wherever the page is scrolled. -->
      <rh-kanban-minimap [columns]="minimapColumns()" [viewport]="viewportStyle()" (go)="scrollToColumn($event)" />
    }
  `,
})
export class PipelineBoardSectionComponent {
  readonly columns         = input.required<BoardColumn[]>();
  readonly loading         = input(false);
  readonly actioningId     = input<number | null>(null);

  readonly open            = output<number>();
  readonly toggleSort      = output<string>();
  readonly sendOffer       = output<{ candidate: KanbanCandidate; event: Event }>();
  readonly acceptOffer     = output<{ candidate: KanbanCandidate; event: Event }>();
  readonly renegotiate     = output<{ candidate: KanbanCandidate; event: Event }>();
  readonly refuse          = output<{ candidate: KanbanCandidate; event: Event }>();

  constructor() {
    // Re-measure whenever the board is (re)built: the minimap reads scrollWidth,
    // which is only meaningful once the new columns are in the DOM.
    effect(() => {
      this.columns();
      this.loading();
      setTimeout(() => this.syncBoardMetrics());
    });
  }

  /** One skeleton per stage in the schema, so the two can never drift apart. */
  protected readonly skeletonColumns = computed(() => BOARD_STAGES.map((_, i) => i));
  protected readonly skeletonCards   = computed(() => [0, 1]);

  // ── Scroll geometry for the minimap ────────────────────────────────────────
  private readonly board = viewChild<ElementRef<HTMLDivElement>>('board');
  private readonly boardScroll = signal({ left: 0, client: 0, scroll: 0 });

  protected readonly minimapColumns = computed<MinimapColumn[]>(() =>
    this.columns().map(c => ({ key: c.key, label: c.label, accent: c.accent, badgeBg: c.badgeBg, count: c.candidates.length })));

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
    // Columns stretch with the screen now: scroll to the column's real position, not a fixed width.
    const board = this.board()?.nativeElement;
    const column = board?.querySelectorAll<HTMLElement>('[data-board-column]')[index];
    if (!board || !column) return;
    const left = column.getBoundingClientRect().left - board.getBoundingClientRect().left + board.scrollLeft;
    board.scrollTo({ left, behavior: 'smooth' });
  }
}
