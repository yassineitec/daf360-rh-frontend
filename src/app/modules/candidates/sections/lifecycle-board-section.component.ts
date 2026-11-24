import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  computed, effect, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import { LifecycleCard, LifecycleColumn, LifecycleColumnKey } from '../lifecycle-board.model';
import { LifecycleCardComponent } from '../components/lifecycle-card.component';
import { KanbanMinimapComponent, MinimapColumn } from '../../../shared/kanban-minimap.component';
import { FillViewportDirective } from '../../../shared/fill-viewport.directive';

/**
 * « Pipeline RH » board (UI-PLAYBOOK §8b section): the lifecycle columns side by side from
 * `sm` up, a pill switcher + one list on mobile. Stateless about the data — the columns come
 * in already mapped and filtered, a click goes back out as an output. It owns its scroll
 * geometry only, for the minimap.
 *
 * `desktop=false` keeps the desktop board out (the page is in list view) while the mobile
 * list stays: a data table is unusable at phone width, so mobile always gets the cards.
 */
@Component({
  selector: 'rh-lifecycle-board-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LifecycleCardComponent, KanbanMinimapComponent, FillViewportDirective, SkeletonComponent, TranslatePipe],
  styles: [`
    .custom-scroll   { scrollbar-width: none; }
    .custom-scroll::-webkit-scrollbar   { display: none; }
    /* A column's own scroll — the page never scrolls, the columns do: thin, always visible. */
    .col-scroll { overflow-y: auto; overscroll-behavior: contain;
                  scrollbar-width: thin; scrollbar-color: var(--color-outline-variant) transparent; }
    .col-scroll::-webkit-scrollbar { width: 6px; }
    .col-scroll::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 3px; }
  `],
  template: `
    <!-- ── Desktop / tablet ─────────────────────────────────────────── -->
    @if (desktop()) {
      <div class="hidden sm:block">
        @if (loading()) {
          <div class="flex gap-6 items-start">
            @for (col of columns(); track col.key) {
              <div class="w-80 shrink-0 flex flex-col gap-3">
                <daf-skeleton variant="text" width="45%" height="16px" />
                @for (j of [0, 1, 2]; track j) {
                  <daf-skeleton variant="block" radius="xl" width="100%" height="196px" />
                }
              </div>
            }
          </div>
        } @else {
          <!-- The page never scrolls: the board reaches the bottom of the window (rhFillViewport) and each column scrolls its own cards, every card there. -->
          <div #board rhFillViewport class="flex gap-6 overflow-x-auto overflow-y-hidden pb-4 items-stretch custom-scroll scroll-smooth"
               (scroll)="syncBoardMetrics()">
            @for (col of columns(); track col.key) {
              <div class="w-80 shrink-0 flex flex-col min-h-0">
                <div class="flex items-center gap-2 px-1 mb-3">
                  <span class="w-2.5 h-2.5 rounded-full" [style.background]="col.accent"></span>
                  <span class="text-sm font-bold text-on-surface">{{ col.label }}</span>
                  <span class="text-xs font-semibold text-on-surface-variant bg-surface-container-high rounded px-2 py-0.5">
                    {{ col.cards.length }}
                  </span>
                </div>
                <!-- Every card, scrolling inside the column; the bottom space lets the last card scroll clear of the minimap. -->
                <div class="col-scroll flex-1 min-h-0 flex flex-col gap-3 p-1 pr-2 pt-4 pb-24">
                  @for (card of col.cards; track card.key) {
                    <rh-lifecycle-card [card]="card" [accent]="col.accent" [badgeBg]="col.badgeBg" (open)="open.emit(card)" />
                  } @empty {
                    <div class="text-center py-10 text-outline border border-dashed border-outline-variant rounded-xl">
                      <span class="material-symbols-outlined text-[28px] block mb-1">{{ col.icon }}</span>
                      <p class="text-[12px]">{{ 'CANDIDATES.LIFECYCLE.EMPTY' | translate }}</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Minimap — always on screen, bottom-right, wherever the page is scrolled. -->
          <rh-kanban-minimap [columns]="minimapColumns()" [viewport]="viewportStyle()" (go)="scrollToColumn($event)" />
        }
      </div>
    }

    <!-- ── Mobile ───────────────────────────────────────────────────── -->
    <div class="sm:hidden flex flex-col gap-4">
      <div class="flex gap-2 overflow-x-auto custom-scroll pb-1">
        @for (col of columns(); track col.key) {
          <button type="button"
            class="shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
            [style.border-color]="mobileColumn()?.key === col.key ? col.accent : 'var(--color-outline-variant)'"
            [style.background]="mobileColumn()?.key === col.key ? col.badgeBg : 'transparent'"
            [style.color]="mobileColumn()?.key === col.key ? col.accent : 'var(--color-on-surface-variant)'"
            (click)="mobileKey.set(col.key)">
            {{ col.label }}
            <span class="opacity-70">{{ col.cards.length }}</span>
          </button>
        }
      </div>

      @if (loading()) {
        @for (j of [0, 1, 2]; track j) {
          <daf-skeleton variant="block" radius="xl" width="100%" height="180px" />
        }
      } @else if (mobileColumn(); as col) {
        @for (card of col.cards; track card.key) {
          <rh-lifecycle-card [card]="card" [accent]="col.accent" [badgeBg]="col.badgeBg" (open)="open.emit(card)" />
        } @empty {
          <div class="text-center py-10 text-outline border border-dashed border-outline-variant rounded-xl">
            <span class="material-symbols-outlined text-[28px] block mb-1">{{ col.icon }}</span>
            <p class="text-[12px]">{{ 'CANDIDATES.LIFECYCLE.EMPTY' | translate }}</p>
          </div>
        }
      }
    </div>
  `,
})
export class LifecycleBoardSectionComponent {
  readonly columns = input.required<LifecycleColumn[]>();
  readonly loading = input(false);
  /** False in list view: only the mobile list is drawn. */
  readonly desktop = input(true);

  readonly open = output<LifecycleCard>();

  /** Mobile pill — falls back to the first column the user can see. */
  protected readonly mobileKey = signal<LifecycleColumnKey | null>(null);
  // Typed explicitly: `cols[0]` is undefined when the user can read no column, which the
  // inferred type (no noUncheckedIndexedAccess) would hide.
  protected readonly mobileColumn = computed<LifecycleColumn | null>(() => {
    const cols = this.columns();
    return cols.find(c => c.key === this.mobileKey()) ?? cols[0] ?? null;
  });

  constructor() {
    effect(() => {
      this.columns();
      this.loading();
      setTimeout(() => this.syncBoardMetrics());
    });
  }

  // ── Scroll geometry for the minimap ────────────────────────────────────────
  private readonly board = viewChild<ElementRef<HTMLDivElement>>('board');
  private readonly boardScroll = signal({ left: 0, client: 0, scroll: 0 });

  protected readonly minimapColumns = computed<MinimapColumn[]>(() =>
    this.columns().map(c => ({ key: c.key, label: c.label, accent: c.accent, badgeBg: c.badgeBg, count: c.cards.length })));

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
