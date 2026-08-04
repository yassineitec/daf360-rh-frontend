import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  computed, effect, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import { OffboardingKanbanColumn } from '../offboarding-kanban.model';
import { OffboardingKanbanCardComponent } from '../../pipeline/components/offboarding-kanban-card.component';

/**
 * Desktop / tablet kanban board for `/rh/offboarding` (UI-PLAYBOOK §8b).
 *
 * Same geometry, column chrome, sort toggle and horizontal minimap as the candidates
 * board, so the two pages read as one system. Stateless with respect to the data:
 * columns and the loading flag come in, every interaction goes out.
 *
 * Deliberately NOT drag-and-drop, unlike the recruitment board. An offboarding status is
 * derived from the workflow — tasks completed, exit interview held, settlement validated —
 * so dragging a file into "Validé" would assert an outcome the backend never authorised.
 * Status changes happen on the detail page, through the stage actions.
 */
@Component({
  selector: 'rh-offboarding-board-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OffboardingKanbanCardComponent, SkeletonComponent, TranslatePipe],
  host: { class: 'hidden sm:block' },
  styles: [`
    /* The board scrolls horizontally (wheel / minimap) but hides its scrollbar —
       the minimap already communicates the position. */
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
              <daf-skeleton variant="block" radius="xl" width="100%" height="180px" />
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
                {{ col.items.length }}
              </span>
              <button type="button"
                class="flex items-center justify-center w-4 h-4 ml-auto shrink-0 text-outline-variant hover:text-outline transition-colors"
                [title]="(col.sortDir === 'asc' ? 'OFFBOARDING.KANBAN.SORT_DESC' : 'OFFBOARDING.KANBAN.SORT_ASC') | translate"
                (click)="toggleSort.emit(col.key)">
                <span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'wght' 200">swap_vert</span>
              </button>
            </div>

            <!-- Cards -->
            <div class="flex flex-col gap-3 min-h-[120px] max-h-[610px] overflow-y-auto overscroll-contain
                        rounded-xl p-1 pr-2 pt-4 custom-scroll-y">
              @for (item of col.items; track item.id) {
                <rh-offboarding-kanban-card
                  [item]="item"
                  [accent]="col.accent"
                  [badgeBg]="col.badgeBg"
                  [showChevron]="true"
                  (open)="open.emit(item.id)" />
              } @empty {
                <div class="text-center text-xs text-outline py-6 border border-dashed border-outline-variant rounded-xl">
                  {{ 'OFFBOARDING.KANBAN.EMPTY_COLUMN' | translate }}
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
                  class="flex-1 h-12 rounded-md flex flex-col items-center justify-center gap-1 transition-transform hover:scale-105"
                  [style.background]="col.badgeBg"
                  [title]="col.label + ' (' + col.items.length + ')'"
                  (click)="scrollToColumn(i)">
                  <span class="w-2 h-2 rounded-full" [style.background]="col.accent"></span>
                  <span class="text-[10px] font-bold leading-none" [style.color]="col.accent">{{ col.items.length }}</span>
                </button>
              }
              <div class="absolute top-0 bottom-0 rounded-md border-2 border-primary pointer-events-none transition-all duration-150"
                   [style.left]="viewportStyle().left" [style.width]="viewportStyle().width"></div>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class OffboardingBoardSectionComponent {
  readonly columns = input.required<OffboardingKanbanColumn[]>();
  readonly loading = input(false);

  readonly open       = output<number>();
  readonly toggleSort = output<string>();

  constructor() {
    // Re-measure whenever the board is (re)built: the minimap reads scrollWidth, which is
    // only meaningful once the new columns are in the DOM.
    effect(() => {
      this.columns();
      this.loading();
      setTimeout(() => this.syncBoardMetrics());
    });
  }

  protected readonly skeletonColumns = computed(() => [0, 1, 2, 3]);
  protected readonly skeletonCards   = computed(() => [0, 1, 2]);

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
