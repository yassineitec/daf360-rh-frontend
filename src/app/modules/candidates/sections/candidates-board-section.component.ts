import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  computed, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import { CandidateListItem } from '../candidate.model';
import { KANBAN_COLUMN_DEFS, KanbanColumn } from '../kanban.model';
import { CandidateKanbanCardComponent } from '../components/candidate-kanban-card.component';
import { OffboardingWorkflowInstance } from '../../offboarding/models/offboarding.model';
import {
  OFFBOARDING_ACCENT, OFFBOARDING_BADGE_BG, OFFBOARDING_COLUMN_KEY,
} from '../../offboarding/offboarding-kanban.model';
import { OffboardingKanbanCardComponent } from '../../offboarding/components/offboarding-kanban-card.component';

/** One minimap cell. Mirrors a rendered board track, whatever kind of track that is. */
interface MinimapTile {
  key: string;
  label: string;
  accent: string;
  badgeBg: string;
  count: number;
}

/**
 * Desktop / tablet kanban board (UI-PLAYBOOK §8b section architecture).
 *
 * Five candidate status columns, then a read-only **Offboarding** column for
 * employees in an active offboarding workflow — this page is the HR lifecycle
 * board, so departures belong at the right end of it.
 *
 * Stateless with respect to the data: columns, the offboarding list, drag state
 * and the loading flag all come in as inputs and every interaction goes back out
 * as an output. The one thing it does own is its **own scroll geometry** — the
 * board element lives here, so the horizontal navigation minimap that reads
 * `scrollLeft` / `scrollWidth` belongs here too rather than in the page.
 */
@Component({
  selector: 'rh-candidates-board-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CandidateKanbanCardComponent, OffboardingKanbanCardComponent,
    SkeletonComponent, TranslatePipe,
  ],
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
              <daf-skeleton variant="block" radius="xl" width="100%" height="196px" />
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
                class="flex items-center justify-center w-4 h-4 ml-auto shrink-0 text-outline-variant hover:text-outline transition-colors"
                [title]="(col.sortDir === 'asc' ? 'CANDIDATES.KANBAN.SORT_DESC' : 'CANDIDATES.KANBAN.SORT_ASC') | translate"
                (click)="toggleSort.emit(col.key)">
                <span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'wght' 200">swap_vert</span>
              </button>
            </div>

            <!-- Cards — native HTML5 drop target -->
            <div
              class="flex flex-col gap-3 min-h-[120px] max-h-[610px] overflow-y-auto overscroll-contain rounded-xl transition-all p-1 pr-2 pt-4 custom-scroll-y"
              [style.box-shadow]="dragOverKey() === col.key ? '0 0 0 2px ' + col.accent : null"
              (dragover)="onDragOver($event, col.key)"
              (dragleave)="dragLeave.emit(col.key)"
              (drop)="onDrop($event, col)">

              @for (c of col.candidates; track c.id) {
                <rh-candidate-kanban-card
                  [candidate]="c"
                  [accent]="col.accent"
                  [badgeBg]="col.badgeBg"
                  [statusLabel]="statusLabel()(c.status)"
                  [draggable]="true"
                  [dragging]="draggedId() === c.id"
                  (dragStart)="dragStart.emit(c)"
                  (dragEnd)="dragEnd.emit()"
                  (open)="open.emit(c.id)" />
              } @empty {
                <div class="text-center text-xs text-outline py-6 border border-dashed border-outline-variant rounded-xl">
                  {{ 'CANDIDATES.KANBAN.NO_CANDIDATE' | translate }}
                </div>
              }
            </div>
          </div>
        }

        <!-- Offboarding — display-only; employees in an active offboarding workflow.
             Not a candidate status, so it is not a drop target, carries no sort
             control, takes its neutral colour from the offboarding module rather
             than from KANBAN_COLUMN_DEFS, and is absent from the minimap. -->
        @if (showOffboarding()) {
          <div class="w-80 shrink-0 flex flex-col">

            <div class="flex items-center gap-2 px-1 mb-3">
              <span class="w-2.5 h-2.5 rounded-full" [style.background]="offboardingAccent"></span>
              <span class="text-sm font-bold text-on-surface">{{ 'OFFBOARDING.BOARD.COLUMN' | translate }}</span>
              <span class="text-xs font-semibold text-on-surface-variant bg-surface-container-high rounded px-2 py-0.5">
                {{ offboarding().length }}
              </span>
            </div>

            <div class="flex flex-col gap-3 min-h-[120px] max-h-[610px] overflow-y-auto overscroll-contain
                        p-1 pr-2 pt-4 custom-scroll-y">
              @for (o of offboarding(); track o.id) {
                <rh-offboarding-kanban-card [item]="o" (open)="openOffboarding.emit(o.id)" />
              } @empty {
                <div class="text-center py-10 text-outline border border-dashed border-outline-variant rounded-xl">
                  <span class="material-symbols-outlined text-[32px] block mb-1">logout</span>
                  <p class="text-[12px]">{{ 'OFFBOARDING.BOARD.EMPTY' | translate }}</p>
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
              @for (tile of minimapTiles(); track tile.key; let i = $index) {
                <button type="button"
                  class="flex-1 h-12 rounded-md flex flex-col items-center justify-center gap-1 transition-transform hover:scale-105"
                  [style.background]="tile.badgeBg"
                  [title]="tile.label + ' (' + tile.count + ')'"
                  (click)="scrollToColumn(i)">
                  <span class="w-2 h-2 rounded-full" [style.background]="tile.accent"></span>
                  <span class="text-[10px] font-bold leading-none" [style.color]="tile.accent">{{ tile.count }}</span>
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
export class CandidatesBoardSectionComponent {
  private translate = inject(TranslateService);

  readonly columns     = input.required<KanbanColumn[]>();
  readonly loading     = input(false);
  readonly draggedId   = input<number | null>(null);
  readonly dragOverKey = input<string | null>(null);
  /** Status → translated badge label. The page owns i18n; the section only renders. */
  readonly statusLabel = input.required<(status: string) => string>();
  /** Active offboarding files. Empty (or hidden) is the normal case for most roles. */
  readonly offboarding     = input<OffboardingWorkflowInstance[]>([]);
  /** Gated on `RH_MANAGE_OFFBOARDING` by the page — the section only obeys. */
  readonly showOffboarding = input(false);

  readonly open       = output<number>();
  readonly openOffboarding = output<number>();
  readonly toggleSort = output<string>();
  readonly dragStart  = output<CandidateListItem>();
  readonly dragEnd    = output<void>();
  readonly dragOver   = output<string>();
  readonly dragLeave  = output<string>();
  /** Named `cardDrop`, not `drop`: a `drop` output would shadow the native DOM event. */
  readonly cardDrop   = output<KanbanColumn>();

  protected readonly offboardingAccent = OFFBOARDING_ACCENT;

  /**
   * One tile per track the board actually renders — the status columns, then the
   * Offboarding column when it is shown.
   *
   * The minimap MUST enumerate the same tracks as the board. The viewport indicator
   * is positioned as a percentage of the real `scrollWidth`, so a track that has no
   * tile still takes up scroll space: the indicator would drift past the last tile
   * and the map would stop matching what is on screen (and Offboarding could not be
   * jumped to at all).
   */
  protected readonly minimapTiles = computed<MinimapTile[]>(() => {
    this.translate.currentLang();
    const tiles: MinimapTile[] = this.columns().map(col => ({
      key:     col.key,
      label:   col.label,
      accent:  col.accent,
      badgeBg: col.badgeBg,
      count:   col.candidates.length,
    }));
    if (this.showOffboarding()) {
      tiles.push({
        key:     OFFBOARDING_COLUMN_KEY,
        label:   this.translate.instant('OFFBOARDING.BOARD.COLUMN'),
        accent:  OFFBOARDING_ACCENT,
        badgeBg: OFFBOARDING_BADGE_BG,
        count:   this.offboarding().length,
      });
    }
    return tiles;
  });

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

  /**
   * As many skeleton columns as the board will actually draw — derived from the
   * column schema, not a hardcoded 4, so adding a status column cannot leave the
   * loading state one column short of the loaded one.
   */
  protected readonly skeletonColumns = computed(() =>
    Array.from(
      { length: KANBAN_COLUMN_DEFS.length + (this.showOffboarding() ? 1 : 0) },
      (_, i) => i,
    ),
  );
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

  protected onDragOver(event: DragEvent, key: string): void {
    event.preventDefault(); // required so the column becomes a valid drop target
    if (this.dragOverKey() !== key) this.dragOver.emit(key);
  }

  protected onDrop(event: DragEvent, col: KanbanColumn): void {
    event.preventDefault();
    this.cardDrop.emit(col);
  }
}
