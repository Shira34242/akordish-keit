import { Component, OnInit, AfterViewInit, ViewChildren, ElementRef, QueryList, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { EventService } from '../../../services/admin/event.service';
import { AnalyticsService } from '../../../services/analytics.service';
import { Event } from '../../../models/event.model';
import { EventCardData, getDisplayArtist, hasDisplayEventTitle } from '../../../utils/event.utils';
import { EventModalComponent } from '../../shared/event-modal/event-modal.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';

type FilterMode = 'upcoming' | 'all';

interface CarouselRenderItem {
  event: EventCardData;
  position: number;
  key: string;
}

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [CommonModule, RouterModule, EventModalComponent, TranslatePipe, ImgFallbackDirective],
  templateUrl: './events-page.component.html',
  styleUrls: ['./events-page.component.css']
})
export class EventsPageComponent implements OnInit, AfterViewInit {
  private readonly eventService = inject(EventService);
  private readonly analytics = inject(AnalyticsService);
  private readonly route = inject(ActivatedRoute);

  @ViewChildren('carouselItem') carouselItems!: QueryList<ElementRef>;

  loading = true;
  allEvents: EventCardData[] = [];
  filteredEvents: EventCardData[] = [];
  visibleCarouselItems: CarouselRenderItem[] = [];
  selectedEvent: EventCardData | null = null;
  filterMode: FilterMode = 'upcoming';
  isRepositioning = false;
  showInteractionHint = true;

  private activePosition = 0;
  private activeIndex = 0;
  private loopOffset = 0;
  private isDown = false;
  private startX = 0;
  private startPosition = 0;
  private touchStartX = 0;
  private touchStartPosition = 0;
  private snapTimer?: ReturnType<typeof setTimeout>;
  private wheelAccumulator = 0;
  private wheelLocked = false;
  private suppressNextClick = false;
  private readonly visibleRadius = 4;
  private readonly speedDrag = 0.008;
  private readonly wheelStepSize = 70;

  ngOnInit(): void {
    this.analytics.trackEventView();
    this.eventService.getEvents(1, 80, undefined, true).subscribe({
      next: (result) => {
        this.allEvents = result.items.map(e => this.toCardData(e));
        this.finishLoading();
      },
      error: () => { this.loading = false; }
    });
  }

  ngAfterViewInit(): void {
    this.carouselItems.changes.subscribe(() => {
      this.animate();
    });
  }

  setFilter(mode: FilterMode): void {
    this.registerInteraction();
    this.filterMode = mode;
    this.updateFiltered();
    this.resetCarouselPosition();
    setTimeout(() => this.animate(), 0);
  }

  private updateFiltered(): void {
    this.filteredEvents = this.getModeEvents();
    this.updateVisibleCarouselItems();
  }

  private resetCarouselPosition(): void {
    this.activePosition = 0;
    this.loopOffset = 0;
    this.updateVisibleCarouselItems();
  }

  private getModeEvents(): EventCardData[] {
    const byDateAscending = (a: EventCardData, b: EventCardData) =>
      new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    const upcoming = this.allEvents.filter(event => !event.isPast).sort(byDateAscending);

    if (this.filterMode === 'upcoming') return upcoming;

    const past = this.allEvents
      .filter(event => event.isPast)
      .sort((a, b) => byDateAscending(b, a));
    return [...upcoming, ...past];
  }

  private finishLoading(): void {
    this.updateFiltered();
    if (this.filterMode === 'upcoming' && this.filteredEvents.length === 0 && this.allEvents.length > 0) {
      this.filterMode = 'all';
      this.updateFiltered();
    }
    this.resetCarouselPosition();
    const requestedEventId = Number(this.route.snapshot.queryParamMap.get('event'));
    if (Number.isFinite(requestedEventId) && requestedEventId > 0) {
      if (!this.filteredEvents.some(event => event.id === requestedEventId)) {
        this.filterMode = 'all';
        this.updateFiltered();
      }
      const requestedIndex = this.filteredEvents.findIndex(event => event.id === requestedEventId);
      if (requestedIndex >= 0) {
        this.activePosition = requestedIndex;
        this.activeIndex = requestedIndex;
        this.selectedEvent = this.filteredEvents[requestedIndex];
        this.updateVisibleCarouselItems();
      }
    }
    this.loading = false;
    setTimeout(() => this.animate(), 0);
  }

  trackByCarouselItem(index: number, item: CarouselRenderItem): string {
    return item.key;
  }

  private getZindex(position: number): number {
    const distance = Math.abs(position - this.activePosition);
    return Math.max(1, 80 - Math.round(distance));
  }

  private displayItem(el: HTMLElement, position: number): void {
    const diff = position - this.activePosition;
    const absDiff = Math.abs(diff);
    const brightness = Math.max(0.3, 1 - absDiff * 0.18);
    const visualPosition = -diff / this.getVisualSpread();
    const curve = Math.min(1.65, Math.abs(visualPosition));
    el.style.setProperty('--active', String(visualPosition));
    el.style.setProperty('--curve', String(curve));
    el.style.setProperty('--zIndex', String(this.getZindex(position)));
    el.style.setProperty('--brightness', String(brightness));
  }

  private animate(): void {
    this.updateVisibleCarouselItems();
    requestAnimationFrame(() => this.applyCarouselStyles());
  }

  private applyCarouselStyles(): void {
    const items = this.carouselItems?.toArray();
    if (!items || items.length === 0) return;

    const total = this.filteredEvents.length;
    if (total <= 1) {
      this.activePosition = 0;
    }
    this.activeIndex = Math.round(this.activePosition);

    items.forEach((item, index) => {
      const renderItem = this.visibleCarouselItems[index];
      if (renderItem) {
        this.displayItem(item.nativeElement, renderItem.position);
      }
    });
  }

  private recenterLoopIfNeeded(shouldAnimate = true): void {
    const total = this.filteredEvents.length;
    if (total <= 1) return;

    const cycle = total * 12;
    if (Math.abs(this.activePosition) < cycle) return;

    const shift = Math.trunc(this.activePosition / total) * total;
    this.activePosition -= shift;
    this.loopOffset += shift;

    if (!shouldAnimate) return;
    this.isRepositioning = true;
    requestAnimationFrame(() => {
      this.isRepositioning = false;
    });
  }

  private updateVisibleCarouselItems(): void {
    const total = this.filteredEvents.length;
    if (total === 0) {
      this.visibleCarouselItems = [];
      return;
    }

    if (total === 1) {
      this.visibleCarouselItems = this.filteredEvents.map((event, position) => ({
        event,
        position,
        key: `${event.id}-${position}`
      }));
      return;
    }

    const center = Math.round(this.activePosition);
    const items: CarouselRenderItem[] = [];
    for (let position = center - this.visibleRadius; position <= center + this.visibleRadius; position++) {
      const event = this.filteredEvents[this.normalizeIndex(position, total)];
      items.push({
        event,
        position,
        key: `${event.id}-${position}`
      });
    }
    this.visibleCarouselItems = items;
  }

  private getVisualSpread(): number {
    const sourceTotal = this.filteredEvents.length;
    if (sourceTotal <= 3) return 3.2;
    if (sourceTotal <= 5) return 3.8;
    return 4.4;
  }

  private normalizeIndex(index: number, total: number): number {
    if (total <= 0) return 0;
    return ((index % total) + total) % total;
  }

  private isCarouselControlTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement &&
      !!target.closest('.events-header, .event-filter-bar, .carousel-arrow, .slide-ticket');
  }

  onWheel(e: WheelEvent): void {
    if (this.isCarouselControlTarget(e.target)) return;
    e.preventDefault();
    this.registerInteraction();

    if (this.wheelLocked) return;

    const isHorizontalGesture = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    const delta = isHorizontalGesture ? -e.deltaX : e.deltaY;
    this.wheelAccumulator += delta;
    if (Math.abs(this.wheelAccumulator) < this.wheelStepSize) return;

    const direction = this.wheelAccumulator > 0 ? 1 : -1;
    this.wheelAccumulator = 0;
    this.navigateBy(direction);
    this.wheelLocked = true;
    setTimeout(() => {
      this.wheelLocked = false;
      this.wheelAccumulator = 0;
    }, 280);
  }

  onMouseDown(e: MouseEvent): void {
    if (this.isCarouselControlTarget(e.target)) return;
    this.registerInteraction();
    (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
    this.clearSnapTimer();
    this.isDown = true;
    this.suppressNextClick = false;
    this.startX = e.clientX;
    this.startPosition = this.activePosition;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDown) return;
    const x = e.clientX - this.startX;
    if (Math.abs(x) > 6) this.suppressNextClick = true;
    this.activePosition = this.startPosition + x * this.speedDrag;
    this.animate();
    this.recenterLoopIfNeeded();
  }

  onMouseUp(): void {
    this.isDown = false;
    this.snapToNearest();
    setTimeout(() => { this.suppressNextClick = false; }, 0);
  }

  onTouchStart(e: TouchEvent): void {
    if (this.isCarouselControlTarget(e.target)) return;
    this.registerInteraction();
    this.clearSnapTimer();
    this.touchStartX = e.touches[0].clientX;
    this.touchStartPosition = this.activePosition;
  }

  onTouchMove(e: TouchEvent): void {
    if (this.isCarouselControlTarget(e.target)) return;
    const x = e.touches[0].clientX - this.touchStartX;
    if (Math.abs(x) > 6) this.suppressNextClick = true;
    this.activePosition = this.touchStartPosition + x * this.speedDrag;
    this.animate();
    this.recenterLoopIfNeeded();
  }

  onTouchEnd(): void {
    this.isDown = false;
    this.snapToNearest();
    setTimeout(() => { this.suppressNextClick = false; }, 0);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (this.isCarouselControlTarget(e.target)) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.navigateBy(1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.navigateBy(-1);
    }
  }

  navigateBy(direction: number): void {
    if (this.filteredEvents.length <= 1) return;
    this.registerInteraction();
    this.clearSnapTimer();
    this.activePosition = Math.round(this.activePosition) + Math.sign(direction);
    this.recenterLoopIfNeeded();
    this.animate();
  }

  private scheduleSnap(): void {
    this.clearSnapTimer();

    this.snapTimer = setTimeout(() => this.snapToNearest(), 90);
  }

  private clearSnapTimer(): void {
    if (this.snapTimer) {
      clearTimeout(this.snapTimer);
      this.snapTimer = undefined;
    }
  }

  private snapToNearest(): void {
    this.wheelAccumulator = 0;
    this.activePosition = Math.round(this.activePosition);
    this.recenterLoopIfNeeded();
    this.animate();
  }

  onItemClick(position: number, event: EventCardData): void {
    if (this.suppressNextClick) return;
    this.registerInteraction();
    if (position === this.activeIndex) {
      this.selectedEvent = event;
      return;
    }
    this.activePosition = position;
    this.animate();
    this.recenterLoopIfNeeded();
  }

  private registerInteraction(): void {
    this.showInteractionHint = false;
  }

  getArtist(event: EventCardData): string | null {
    return getDisplayArtist(event);
  }

  hasEventTitle(event: EventCardData): boolean {
    return hasDisplayEventTitle(event);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  private toCardData(event: Event): EventCardData {
    return {
      id: event.id,
      name: event.name,
      imageUrl: event.imageUrl,
      ticketUrl: event.ticketUrl,
      eventDate: event.eventDate,
      location: event.location,
      artistName: event.artistName,
      taggedArtists: event.taggedArtists ?? [],
      taggedArtistNames: event.taggedArtists?.map(a => a.artistName) ?? [],
      eventStatus: event.eventStatus,
      daysUntilEvent: event.daysUntilEvent,
      isPast: event.isPast,
      description: event.description
    };
  }
}
