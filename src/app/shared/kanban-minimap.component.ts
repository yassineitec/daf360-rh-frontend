import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, inject, input, output,
} from '@angular/core';

/** One tile of the minimap — a board column. */
export interface MinimapColumn {
  key: string;
  label: string;
  accent: string;
  badgeBg: string;
  count: number;
}

/**
 * The horizontal navigation minimap shared by the three boards (Candidats, Pipeline RH,
 * Offboarding): one tile per column with its count, a frame showing which part of the board
 * is on screen, a click scrolls the board to that column.
 *
 * Always on screen, bottom-right, whatever the page's vertical scroll: the host is moved to
 * `document.body` on init. `position: fixed` alone is not enough — inside an ancestor that
 * carries a transform / filter (the shell's layout, an animation), "fixed" becomes relative to
 * that ancestor and the minimap ends up at the bottom of the board, out of sight while the
 * user scrolls through long columns. Angular keeps the bindings of a moved host, and removes
 * it from wherever it is on destroy.
 */
@Component({
  selector: 'rh-kanban-minimap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kanban-minimap hidden sm:block z-40' },
  // Plain CSS, not an arbitrary Tailwind class: placed LEFT of the help assistant's round
  // bubble (shell help-chat: 3.5rem wide, 2rem from the right and the bottom), same bottom
  // line, a 1rem gap — the bubble never covers it.
  styles: [`
    :host.kanban-minimap { position: fixed; bottom: 2rem; right: 6.5rem; }
  `],
  template: `
    <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-2
                opacity-40 shadow-md origin-bottom-right transition-all duration-200
                hover:opacity-100 hover:scale-150 hover:shadow-2xl">
      <div class="relative flex gap-1" [style.width.px]="width()">
        @for (col of columns(); track col.key; let i = $index) {
          <button type="button"
            class="flex-1 h-12 rounded-md flex flex-col items-center justify-center gap-1
                   transition-transform hover:scale-105"
            [style.background]="col.badgeBg"
            [title]="col.label + ' (' + col.count + ')'"
            (click)="go.emit(i)">
            <span class="w-2 h-2 rounded-full" [style.background]="col.accent"></span>
            <span class="text-[10px] font-bold leading-none" [style.color]="col.accent">{{ col.count }}</span>
          </button>
        }
        <div class="absolute top-0 bottom-0 rounded-md border-2 border-primary pointer-events-none
                    transition-all duration-150"
             [style.left]="viewport().left" [style.width]="viewport().width"></div>
      </div>
    </div>
  `,
})
export class KanbanMinimapComponent implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly columns  = input.required<MinimapColumn[]>();
  /** The visible part of the board, as CSS percentages of its full width. */
  readonly viewport = input.required<{ left: string; width: string }>();
  /** Tile strip width — 172px fits up to seven columns. */
  readonly width    = input(172);
  /** Column index to scroll to. */
  readonly go       = output<number>();

  ngOnInit(): void {
    document.body.appendChild(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.host.nativeElement.remove();
  }
}
