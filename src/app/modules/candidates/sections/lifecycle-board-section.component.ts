import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  computed, effect, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';

import { LifecycleCard, LifecycleColumn, LifecycleColumnKey } from '../lifecycle-board.model';
import { LifecycleCardComponent } from '../components/lifecycle-card.component';

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
  imports: [LifecycleCardComponent, SkeletonComponent, TranslatePipe],
  styles: [`
    .custom-scroll   { scrollbar-width: none; }
    .custom-scroll::-webkit-scrollbar   { display: none; }
    .custom-scroll-y { scrollbar-width: none; }
    .custom-scroll-y::-webkit-scrollbar { display: none; }
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
          <div #board class="flex gap-6 overflow-x-auto pb-4 items-start custom-scroll scroll-smooth"
               (scroll)="syncBoardMetrics()">
            @for (col of columns(); track col.key) {
              <div class="w-80 shrink-0 flex flex-col">
                <div class="flex items-center gap-2 px-1 mb-3">
                  <span class="w-2.5 h-2.5 rounded-full" [style.background]="col.accent"></span>
                  <span class="text-sm font-bold text-on-surface">{{ col.label }}</span>
                  <span class="text-xs font-semibold text-on-surface-variant bg-surface-container-high rounded px-2 py-0.5">
                    {{ col.cards.length }}
                  </span>
                </div>
                <div class="flex flex-col gap-3 min-h-[120px] max-h-[640px] overflow-y-auto overscroll-contain p-1 pr-2 pt-4 custom-scroll-y">
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
                      [title]="col.label + ' (' + col.cards.length + ')'"
                      (click)="scrollToColumn(i)">
                      <span class="w-2 h-2 rounded-full" [style.background]="col.accent"></span>
                      <span class="text-[10px] font-bold leading-none" [style.color]="col.accent">{{ col.cards.length }}</span>
                    </button>
                  }
                  <div class="absolute top-0 bottom-0 rounded-md border-2 border-primary pointer-events-none transition-all duration-150"
                       [style.left]="viewportStyle().left" [style.width]="viewportStyle().width"></div>
                </div>
              </div>
            </div>
          }
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

  protected readonly boardHasOverflow = computed(() => {
    const b = this.boardScroll();
    return b.scroll > b.client + 4;
  });

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
