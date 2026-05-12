import { Component, OnInit, AfterViewInit, ViewChildren, ElementRef, QueryList, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EventService } from '../../../services/admin/event.service';
import { AnalyticsService } from '../../../services/analytics.service';
import { Event } from '../../../models/event.model';
import { EventCardData, getDisplayArtist } from '../../../utils/event.utils';
import { EventModalComponent } from '../../shared/event-modal/event-modal.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';

type FilterMode = 'upcoming' | 'all' | 'past';

interface CarouselRenderItem {
  event: EventCardData;
  position: number;
  key: string;
}

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [CommonModule, RouterModule, EventModalComponent, TranslatePipe],
  templateUrl: './events-page.component.html',
  styleUrls: ['./events-page.component.css']
})
export class EventsPageComponent implements OnInit, AfterViewInit {
  private readonly eventService = inject(EventService);
  private readonly analytics = inject(AnalyticsService);

  @ViewChildren('carouselItem') carouselItems!: QueryList<ElementRef>;

  loading = true;
  allEvents: EventCardData[] = [];
  filteredEvents: EventCardData[] = [];
  visibleCarouselItems: CarouselRenderItem[] = [];
  selectedEvent: EventCardData | null = null;
  filterMode: FilterMode = 'all';
  isRepositioning = false;

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
  private readonly visibleRadius = 4;
  private readonly speedDrag = -0.008;
  private readonly wheelStepSize = 90;

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
    this.updateVisibleCarouselItems();
  }

  private getModeEvents(): EventCardData[] {
    if (this.filterMode === 'upcoming') {
      return this.allEvents.filter(e => !e.isPast);
    }
    if (this.filterMode === 'past') {
      return this.allEvents.filter(e => e.isPast);
    }
    return [...this.allEvents];
  }

  private finishLoading(): void {
    this.updateFiltered();
    this.resetCarouselPosition();
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
    const visualPosition = diff / this.getVisualSpread();
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
    return;
  }

  private updateVisibleCarouselItems(): void {
    const total = this.filteredEvents.length;
    if (total === 0) {
      this.visibleCarouselItems = [];
      return;
    }

    if (total <= this.visibleRadius * 2 + 1) {
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
    return target instanceof HTMLElement && !!target.closest('.events-header, .event-filter-bar');
  }

  onWheel(e: WheelEvent): void {
    if (this.isCarouselControlTarget(e.target)) return;
    e.preventDefault();

    this.wheelAccumulator += e.deltaY;
    const steps = Math.trunc(this.wheelAccumulator / this.wheelStepSize);
    if (steps === 0) {
      this.scheduleSnap();
      return;
    }

    const limitedSteps = Math.max(-4, Math.min(steps, 4));
    this.wheelAccumulator -= limitedSteps * this.wheelStepSize;
    this.activePosition = Math.round(this.activePosition) + limitedSteps;
    this.recenterLoopIfNeeded();
    this.animate();
    this.scheduleSnap();
  }

  onMouseDown(e: MouseEvent): void {
    if (this.isCarouselControlTarget(e.target)) return;
    this.clearSnapTimer();
    this.isDown = true;
    this.startX = e.clientX;
    this.startPosition = this.activePosition;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDown) return;
    const x = e.clientX - this.startX;
    this.activePosition = this.startPosition + x * this.speedDrag;
    this.animate();
    this.recenterLoopIfNeeded();
  }

  onMouseUp(): void {
    this.isDown = false;
    this.snapToNearest();
  }

  onTouchStart(e: TouchEvent): void {
    if (this.isCarouselControlTarget(e.target)) return;
    this.clearSnapTimer();
    this.touchStartX = e.touches[0].clientX;
    this.touchStartPosition = this.activePosition;
  }

  onTouchMove(e: TouchEvent): void {
    if (this.isCarouselControlTarget(e.target)) return;
    const x = e.touches[0].clientX - this.touchStartX;
    this.activePosition = this.touchStartPosition + x * this.speedDrag;
    this.animate();
    this.recenterLoopIfNeeded();
  }

  onTouchEnd(): void {
    this.isDown = false;
    this.snapToNearest();
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
    if (position === this.activeIndex) {
      this.selectedEvent = event;
      return;
    }
    this.activePosition = position;
    this.animate();
    this.recenterLoopIfNeeded();
  }

  getArtist(event: EventCardData): string | null {
    return getDisplayArtist(event);
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
