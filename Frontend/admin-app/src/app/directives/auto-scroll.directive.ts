import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appAutoScroll]',
  standalone: true
})
export class AutoScrollDirective implements AfterViewInit, OnDestroy {
  @Input() autoScrollSpeed = 30;
  @Input() autoScrollDirection: 'left' | 'right' = 'left';
  @Input() autoScrollPauseMs = 1500;
  @Input() autoScrollCopies = 2;

  private rafId: number | null = null;
  private lastTime = 0;
  private pausedUntil = 0;
  private destroyed = false;
  private cycleWidth = 0;
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private intersectionObserver?: IntersectionObserver;
  private cleanups: Array<() => void> = [];
  private initialized = false;
  private isVisible = false;
  private recomputePending = false;

  constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    const host = this.el.nativeElement;

    const onUserInteract = () => {
      this.pausedUntil = performance.now() + this.autoScrollPauseMs;
    };

    let wrapping = false;
    const onScroll = () => {
      if (wrapping || this.cycleWidth <= 0) return;
      const lowerBoundary = this.autoScrollCopies >= 3 ? this.cycleWidth * 0.5 : 0;
      const upperBoundary = this.autoScrollCopies >= 3 ? this.cycleWidth * 1.5 : this.cycleWidth;

      if (host.scrollLeft >= upperBoundary) {
        wrapping = true;
        host.scrollLeft -= this.cycleWidth;
        requestAnimationFrame(() => { wrapping = false; });
      } else if (host.scrollLeft <= lowerBoundary && this.autoScrollCopies >= 3) {
        wrapping = true;
        host.scrollLeft += this.cycleWidth;
        requestAnimationFrame(() => { wrapping = false; });
      }
    };

    host.addEventListener('wheel', onUserInteract, { passive: true });
    host.addEventListener('pointerdown', onUserInteract);
    host.addEventListener('touchstart', onUserInteract, { passive: true });
    host.addEventListener('scroll', onScroll, { passive: true });

    this.cleanups.push(
      () => host.removeEventListener('wheel', onUserInteract),
      () => host.removeEventListener('pointerdown', onUserInteract),
      () => host.removeEventListener('touchstart', onUserInteract),
      () => host.removeEventListener('scroll', onScroll)
    );

    this.resizeObserver = new ResizeObserver(() => this.scheduleRecompute());
    this.resizeObserver.observe(host);

    this.mutationObserver = new MutationObserver(() => this.scheduleRecompute());
    this.mutationObserver.observe(host, { childList: true, subtree: true });

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        this.isVisible = entries.some(entry => entry.isIntersecting);
      },
      { rootMargin: '120px 0px', threshold: 0.01 }
    );
    this.intersectionObserver.observe(host);

    requestAnimationFrame(() => this.scheduleRecompute());

    if (this.autoScrollSpeed <= 0) return;

    this.zone.runOutsideAngular(() => {
      this.lastTime = performance.now();
      const tick = (now: number) => {
        if (this.destroyed) return;
        this.rafId = requestAnimationFrame(tick);

        if (!this.isVisible) {
          this.lastTime = now;
          return;
        }

        const dt = Math.min(0.1, (now - this.lastTime) / 1000);
        this.lastTime = now;

        if (this.cycleWidth <= 0) return;

        if (now < this.pausedUntil) return;

        const sign = this.autoScrollDirection === 'left' ? 1 : -1;
        let next = host.scrollLeft + sign * this.autoScrollSpeed * dt;

        const lowerBoundary = this.autoScrollCopies >= 3 ? this.cycleWidth * 0.5 : 0;
        const upperBoundary = this.autoScrollCopies >= 3 ? this.cycleWidth * 1.5 : this.cycleWidth;
        if (next >= upperBoundary) next -= this.cycleWidth;
        else if (next <= lowerBoundary) next += this.cycleWidth;

        host.scrollLeft = next;
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }

  private scheduleRecompute(): void {
    if (this.recomputePending || this.destroyed) return;
    this.recomputePending = true;
    requestAnimationFrame(() => {
      this.recomputePending = false;
      if (!this.destroyed) this.recompute();
    });
  }

  private recompute(): void {
    const host = this.el.nativeElement;
    const copies = Math.max(2, this.autoScrollCopies);
    const track = host.firstElementChild as HTMLElement | null;
    const children = track ? Array.from(track.children) as HTMLElement[] : [];
    const itemsPerCopy = children.length / copies;
    const firstItem = children[0];
    const firstRepeatedItem = Number.isInteger(itemsPerCopy) ? children[itemsPerCopy] : undefined;
    const newCycleWidth = firstItem && firstRepeatedItem
      ? firstRepeatedItem.offsetLeft - firstItem.offsetLeft
      : host.scrollWidth > host.clientWidth ? host.scrollWidth / copies : 0;

    if (Math.abs(newCycleWidth - this.cycleWidth) < 1) return;
    this.cycleWidth = newCycleWidth;

    if (!this.initialized && this.cycleWidth > 0) {
      this.initialized = true;
      host.scrollLeft = copies >= 3
        ? this.cycleWidth
        : this.autoScrollDirection === 'right' ? this.cycleWidth - 1 : 0;
      // once initialized, DOM mutations no longer need to trigger recompute
      this.mutationObserver?.disconnect();
      this.mutationObserver = undefined;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.cleanups.forEach(fn => fn());
  }
}
