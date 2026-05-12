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
  private halfWidth = 0;
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private intersectionObserver?: IntersectionObserver;
  private cleanups: Array<() => void> = [];
  private initialized = false;
  private isVisible = false;

  constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    const host = this.el.nativeElement;

    const onUserInteract = () => {
      this.pausedUntil = performance.now() + this.autoScrollPauseMs;
    };

    let wrapping = false;
    const onScroll = () => {
      if (wrapping || this.halfWidth <= 0) return;
      if (host.scrollLeft >= this.halfWidth) {
        wrapping = true;
        host.scrollLeft = host.scrollLeft - this.halfWidth;
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

    this.resizeObserver = new ResizeObserver(() => this.recompute());
    this.resizeObserver.observe(host);

    this.mutationObserver = new MutationObserver(() => this.recompute());
    this.mutationObserver.observe(host, { childList: true, subtree: true });

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        this.isVisible = entries.some(entry => entry.isIntersecting);
      },
      { rootMargin: '120px 0px', threshold: 0.01 }
    );
    this.intersectionObserver.observe(host);

    requestAnimationFrame(() => this.recompute());

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

        if (this.halfWidth <= 0) return;

        if (now < this.pausedUntil) return;

        const sign = this.autoScrollDirection === 'left' ? 1 : -1;
        let next = host.scrollLeft + sign * this.autoScrollSpeed * dt;

        if (next >= this.halfWidth) next -= this.halfWidth;
        else if (next < 0) next += this.halfWidth;

        host.scrollLeft = next;
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }

  private recompute(): void {
    const host = this.el.nativeElement;
    const copies = Math.max(2, this.autoScrollCopies);
    const newHalf = host.scrollWidth / copies;
    if (Math.abs(newHalf - this.halfWidth) < 1) return;
    this.halfWidth = newHalf;

    if (!this.initialized && this.halfWidth > 0) {
      this.initialized = true;
      if (this.autoScrollDirection === 'right') {
        host.scrollLeft = this.halfWidth - 1;
      }
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
