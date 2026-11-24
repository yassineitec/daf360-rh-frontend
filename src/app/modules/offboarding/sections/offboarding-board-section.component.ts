import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  computed, effect, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import {
  OFFBOARDING_KANBAN_COLUMN_DEFS, OffboardingKanbanColumn,
} from '../offboarding-kanban.model';
import { OffboardingKanbanCardComponent } from '../components/offboarding-kanban-card.component';
import { KanbanMinimapComponent, MinimapColumn } from '../../../shared/kanban-minimap.component';
import { FillViewportDirective } from '../../../shared/fill-viewport.directive';

/**
 * Desktop / tablet kanban board for `/rh/offboarding` (UI-PLAYBOOK §8b).
 *
 * Same geometry, column chrome, sort toggle and horizontal minimap as the candidates
 * board, so the two pages read as one system. Stateless with respect to the data:
 * columns and the loading flag come in, every interaction goes out.
 *
 * One column per stage — Déclaration, Validation, Passation, IT & Matériel, Kit RH,
 * Paie & STC, Clôture — so a glance answers "who is holding this file up".
 *
 * Deliberately NOT drag-and-drop, unlike the recruitment board, and there is no drop
 * target to add: a stage is *derived* from the file's tasks by `resolveStageStates`,
 * it is not a column anyone can write. Dropping a card on "Clôture" would have to
 * silently complete every intervening task — including the two blocking gates, IT
 * return and the settlement — and assert an outcome no backend endpoint authorises.
 * Files advance from the detail page, one task at a time. The hint line below says so,
 * because a board that looks like a kanban invites the drag that cannot work.
 */
@Component({
  selector: 'rh-offboarding-board-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OffboardingKanbanCardComponent, KanbanMinimapComponent, FillViewportDirective, SkeletonComponent, TranslatePipe],
  host: { class: 'hidden sm:block' },
  styles: [`
    /* The board scrolls horizontally (wheel / minimap) but hides its scrollbar —
       the minimap already communicates the position. */
    .custom-scroll   { scrollbar-width: none; }
    .custom-scroll::-webkit-scrollbar   { display: none; }
    /* A column's own scroll — the page never scrolls, the columns do: thin, always visible. */
    .col-scroll { overflow-y: auto; overscroll-behavior: contain;
                  scrollbar-width: thin; scrollbar-color: var(--color-outline-variant) transparent; }
    .col-scroll::-webkit-scrollbar { width: 6px; }
    .col-scroll::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 3px; }

    /* A class, not a static style attribute: the same element also carries a
       [style.color] binding, and one source of inline style is easier to reason about. */
    .col-icon { font-variation-settings: 'wght' 500; }
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
      <!-- Says out loud why the cards do not move: the columns are computed, not chosen. -->
      <p class="flex items-center gap-1.5 mb-3 text-xs text-on-surface-variant">
        <span class="material-symbols-outlined text-[15px]">info</span>
        {{ 'OFFBOARDING.KANBAN.READ_ONLY_HINT' | translate }}
      </p>

      <!-- The page never scrolls: the board reaches the bottom of the window (rhFillViewport) and each column scrolls its own cards, every card there. -->
      <div #board rhFillViewport class="flex gap-6 overflow-x-auto overflow-y-hidden pb-4 items-stretch custom-scroll scroll-smooth"
           (scroll)="syncBoardMetrics()">
        @for (col of columns(); track col.key) {
          <div class="w-80 shrink-0 flex flex-col min-h-0">

            <!-- Column header: the stage's own glyph, the same one the detail page's rail
                 shows for that step. -->
            <div class="flex items-center gap-2 px-1 mb-3">
              <span class="col-icon material-symbols-outlined text-[17px] shrink-0"
                    [style.color]="col.accent">{{ col.icon }}</span>
              <span class="min-w-0 truncate text-sm font-bold text-on-surface"
                    [title]="col.label">{{ col.label }}</span>
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

            <!-- Cards — every one, scrolling inside the column; the bottom space lets the last card
                 scroll clear of the minimap. -->
            <div class="col-scroll flex-1 min-h-0 flex flex-col gap-3 rounded-xl p-1 pr-2 pt-4 pb-24">
              @for (item of col.items; track item.id) {
                <!-- draggable="false" suppresses the browser's own drag ghost. Without it
                     a card can be picked up and dropped on a column that will never
                     accept it, which reads as a broken kanban rather than a read-only one. -->
                <rh-offboarding-kanban-card
                  draggable="false"
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

      <!-- Minimap — always on screen, bottom-right, wherever the page is scrolled. -->
      <rh-kanban-minimap [columns]="minimapColumns()" [viewport]="viewportStyle()" (go)="scrollToColumn($event)" />
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

  /**
   * One skeleton per stage column — seven, from the schema. It used to be a
   * hardcoded four, so the loading board was three columns shorter than the loaded
   * one and the layout jumped as soon as the fetch landed.
   */
  protected readonly skeletonColumns = computed(() =>
    OFFBOARDING_KANBAN_COLUMN_DEFS.map((_, i) => i),
  );
  protected readonly skeletonCards = computed(() => [0, 1, 2]);

  // ── Scroll geometry for the minimap ────────────────────────────────────────
  private readonly board = viewChild<ElementRef<HTMLDivElement>>('board');
  private readonly boardScroll = signal({ left: 0, client: 0, scroll: 0 });

  protected readonly minimapColumns = computed<MinimapColumn[]>(() =>
    this.columns().map(c => ({ key: c.key, label: c.label, accent: c.accent, badgeBg: c.badgeBg, count: c.items.length })));

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
