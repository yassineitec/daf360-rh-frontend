import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject, input } from '@angular/core';

/**
 * Sizes its host so the PAGE never scrolls: the host reaches down to the bottom of the window
 * and gives back whatever would still overflow below it (the page's bottom padding, anything
 * rendered under it). Used by the kanban boards — the page stays put and each column scrolls
 * its own cards, with no card limit.
 *
 * Re-measured on window resize and whenever the page's height changes (a filter panel, a
 * banner, a language switch move the board). Never smaller than `fillViewportMin`.
 */
@Directive({
  selector: '[rhFillViewport]',
  standalone: true,
})
export class FillViewportDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  /** Never smaller than this, in px. */
  readonly fillViewportMin = input(200);

  private observer: ResizeObserver | null = null;
  private frame = 0;
  private readonly onResize = () => this.schedule();

  ngAfterViewInit(): void {
    // Outside Angular: measuring never needs change detection.
    this.zone.runOutsideAngular(() => {
      window.addEventListener('resize', this.onResize);
      this.observer = new ResizeObserver(() => this.schedule());
      this.observer.observe(document.body);
      this.schedule();
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }

  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.measure());
  }

  /** The element that scrolls the page: the shell may scroll a layout element, not the window. */
  private scroller(): HTMLElement {
    for (let p = this.host.nativeElement.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return document.scrollingElement as HTMLElement ?? document.documentElement;
  }

  private measure(): void {
    const el = this.host.nativeElement;
    const min = this.fillViewportMin();

    // 1. Down to the bottom of the window, measured as if the page were scrolled to the top.
    let top = el.getBoundingClientRect().top;
    for (let p = el.parentElement; p; p = p.parentElement) top += p.scrollTop;
    let height = Math.max(min, Math.floor(window.innerHeight - top));
    el.style.height = height + 'px';

    // 2. Give back what still overflows below the board (padding, margins, content under it),
    //    so the page itself has nothing left to scroll.
    const s = this.scroller();
    const overflow = s.scrollHeight - s.clientHeight;
    if (overflow > 0) {
      height = Math.max(min, height - overflow);
      el.style.height = height + 'px';
    }
  }
}
