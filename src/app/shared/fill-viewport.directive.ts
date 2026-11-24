import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject, input } from '@angular/core';

/**
 * Kanban board scrolling: the PAGE scrolls first (header, KPIs, toolbar go away), and stops
 * exactly when the board's column headers reach the top of the visible area; from there only
 * the columns scroll their cards, with no card limit and no visible bottom edge.
 *
 * How:
 *  - the host is exactly as tall as the visible area (window under the shell's fixed header,
 *    or the scrolling container's own height);
 *  - whatever sits below the board (page padding, margins) is cancelled with a negative bottom
 *    margin, so the page's last scroll position is « board top = visible top » — the board then
 *    fills the screen down to its very bottom edge;
 *  - a wheel/touch scroll DOWN over a column first scrolls the page until that point is reached
 *    (columns would otherwise swallow it); scrolling UP empties the column first, then hands
 *    over to the page (native scroll chaining — the columns must not set overscroll: contain).
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

  /** Breathing room, in px, kept between the top of the visible area and the column headers
   *  once the page has scrolled to them. */
  readonly fillViewportGap = input(20);

  private observer: ResizeObserver | null = null;
  private frame = 0;
  private touchY: number | null = null;
  private readonly onResize = () => this.schedule();
  private readonly onWheel = (e: WheelEvent) => this.routeDown(e, e.deltaY * (e.deltaMode === 1 ? 16 : 1));
  private readonly onTouchStart = (e: TouchEvent) => { this.touchY = e.touches[0]?.clientY ?? null; };
  private readonly onTouchMove = (e: TouchEvent) => {
    const y = e.touches[0]?.clientY;
    if (y == null || this.touchY == null) return;
    const delta = this.touchY - y;
    this.touchY = y;
    this.routeDown(e, delta);
  };

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    // Outside Angular: measuring and scroll routing never need change detection.
    this.zone.runOutsideAngular(() => {
      window.addEventListener('resize', this.onResize);
      el.addEventListener('wheel', this.onWheel, { passive: false });
      el.addEventListener('touchstart', this.onTouchStart, { passive: true });
      el.addEventListener('touchmove', this.onTouchMove, { passive: false });
      this.observer = new ResizeObserver(() => this.schedule());
      this.observer.observe(document.body);
      this.schedule();
    });
  }

  ngOnDestroy(): void {
    const el = this.host.nativeElement;
    window.removeEventListener('resize', this.onResize);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove', this.onTouchMove);
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }

  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.measure());
  }

  /** The element that scrolls the page: the shell may scroll a layout element, not the window.
   *  Must actually overflow — `overflow-x: hidden` alone (rh shell, admin tabs) makes overflow-y
   *  compute to auto on elements that just grow and never scroll. */
  private scroller(): HTMLElement {
    for (let p = this.host.nativeElement.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return (document.scrollingElement as HTMLElement) ?? document.documentElement;
  }

  private isDocument(s: HTMLElement): boolean {
    return s === document.scrollingElement || s === document.documentElement || s === document.body;
  }

  /** Top and height of the visible area, in viewport px. For the window: below the shell's
   *  fixed header (--shell-header-h, inherited from the shell component down to the board). */
  private visibleArea(s: HTMLElement): { top: number; height: number } {
    const gap = Math.max(0, this.fillViewportGap());
    if (this.isDocument(s)) {
      const header = parseFloat(getComputedStyle(this.host.nativeElement).getPropertyValue('--shell-header-h')) || 0;
      return { top: header + gap, height: window.innerHeight - header - gap };
    }
    const r = s.getBoundingClientRect();
    return { top: r.top + gap, height: s.clientHeight - gap };
  }

  private measure(): void {
    const el = this.host.nativeElement;

    // Clean state, a full window tall: whatever scrolls the page now overflows and can be found.
    el.style.marginBottom = '';
    el.style.height = window.innerHeight + 'px';
    const s = this.scroller();
    const area = this.visibleArea(s);

    // 1. Exactly one visible area tall: once scrolled into place, the board fills the screen.
    el.style.height = Math.max(this.fillViewportMin(), Math.floor(area.height)) + 'px';

    // 2. The page may scroll only until the board's top reaches the visible top: cancel
    //    everything below the board beyond that (padding, margins) with a negative margin.
    const boardTop = el.getBoundingClientRect().top - area.top + s.scrollTop; // in scroll coordinates
    const maxScroll = s.scrollHeight - s.clientHeight;
    const extra = maxScroll - Math.max(0, boardTop);
    if (extra > 0) el.style.marginBottom = -extra + 'px';
  }

  /** Scrolling DOWN over the board moves the page first, until the column headers are at the top. */
  private routeDown(e: Event, delta: number): void {
    if (delta <= 0) return; // up: the column empties first, then chains to the page natively
    const s = this.scroller();
    const area = this.visibleArea(s);
    const gap = this.host.nativeElement.getBoundingClientRect().top - area.top; // > 0: page can still go down
    const room = s.scrollHeight - s.clientHeight - s.scrollTop;                 // and actually can move
    if (gap <= 0.5 || room <= 0.5) return; // otherwise the column scrolls, never blocked
    if (e.cancelable) e.preventDefault();
    const step = Math.min(delta, gap, room);
    if (this.isDocument(s)) window.scrollBy({ top: step });
    else s.scrollTop += step;
  }
}
