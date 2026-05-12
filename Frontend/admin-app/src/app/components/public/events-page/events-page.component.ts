import { Component, OnInit, AfterViewInit, ViewChildren, ElementRef, QueryList, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { EventService } from '../../../services/admin/event.service';
import { AnalyticsService } from '../../../services/analytics.service';
import { Event } from '../../../models/event.model';
import { EventCardData, getDisplayArtist } from '../../../utils/event.utils';
import { EventModalComponent } from '../../shared/event-modal/event-modal.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';

type FilterMode = 'upcoming' | 'all' | 'past';

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
  carouselEvents: EventCardData[] = [];
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
  private readonly loopCycles = 21;
  private readonly speedDrag = -0.008;
  private readonly wheelStepSize = 90;

  ngOnInit(): void {
    this.analytics.trackEventView();
    this.eventService.getEvents(1, 100, undefined, true).subscribe({
      next: (result) => {
        this.allEvents = result.items.map(e => this.toCardData(e));
        this.hydrateTaggedArtists(this.allEvents);
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
    this.rebuildCarouselEvents();
  }

  private rebuildCarouselEvents(): void {
    if (this.filteredEvents.length <= 1) {
      this.carouselEvents = [...this.filteredEvents];
      this.loopOffset = 0;
      return;
    }

    this.carouselEvents = Array.from({ length: this.loopCycles }).flatMap(() => this.filteredEvents);
    this.loopOffset = Math.floor(this.loopCycles / 2) * this.filteredEvents.length;
  }

  private resetCarouselPosition(): void {
    this.activePosition = this.loopOffset;
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

  private hydrateTaggedArtists(events: EventCardData[]): void {
    const eventsMissingTags = events.filter(event => !event.taggedArtists?.length);

    if (eventsMissingTags.length === 0) {
      this.finishLoading();
      return;
    }

    forkJoin(
      eventsMissingTags.map(event =>
        this.eventService.getEvent(event.id).pipe(catchError(() => of(null)))
      )
    ).subscribe({
      next: (details) => {
        const detailById = new Map<number, Event>();
        details.forEach(detail => {
          if (detail) {
            detailById.set(detail.id, detail);
          }
        });

        this.allEvents = this.allEvents.map(event => {
          const detail = detailById.get(event.id);
          if (!detail?.taggedArtists?.length) {
            return event;
          }

          return {
            ...event,
            taggedArtists: detail.taggedArtists,
            taggedArtistNames: detail.taggedArtists.map(artist => artist.artistName)
          };
        });

        this.finishLoading();
      },
      error: () => this.finishLoading()
    });
  }

  private finishLoading(): void {
    this.updateFiltered();
    this.resetCarouselPosition();
    this.loading = false;
    setTimeout(() => this.animate(), 0);
  }

  trackById(index: number, event: EventCardData): string {
    return `${event.id}-${index}`;
  }

  private getZindex(index: number, total: number): number {
    const distance = Math.abs(index - this.activePosition);
    return Math.max(1, 80 - Math.round(distance));
  }

  private displayItem(el: HTMLElement, index: number, total: number): void {
    const diff = index - this.activePosition;
    const absDiff = Math.abs(diff);
    const brightness = Math.max(0.3, 1 - absDiff * 0.18);
    const visualPosition = diff / this.getVisualSpread();
    const curve = Math.min(1.65, Math.abs(visualPosition));
    el.style.setProperty('--active', String(visualPosition));
    el.style.setProperty('--curve', String(curve));
    el.style.setProperty('--zIndex', String(this.getZindex(index, total)));
    el.style.setProperty('--brightness', String(brightness));
  }

  private animate(): void {
    const items = this.carouselItems?.toArray();
    if (!items || items.length === 0) return;

    const total = items.length;
    if (total <= 1) {
      this.activePosition = 0;
    } else {
      this.recenterLoopIfNeeded(false);
    }
    this.activeIndex = Math.round(this.activePosition);

    items.forEach((item, index) => {
      this.displayItem(item.nativeElement, index, total);
    });
  }

  private recenterLoopIfNeeded(shouldAnimate = true): void {
    const sourceTotal = this.filteredEvents.length;
    if (sourceTotal <= 1 || this.carouselEvents.length <= sourceTotal) return;

    const minPosition = sourceTotal * 2;
    const maxPosition = this.carouselEvents.length - sourceTotal * 2;

    if (this.activePosition >= minPosition && this.activePosition < maxPosition) {
      return;
    }

    const currentSourceIndex = this.normalizeIndex(Math.round(this.activePosition), sourceTotal);
    const newPosition = this.loopOffset + currentSourceIndex;

    if (this.activePosition === newPosition) {
      return;
    }

    if (!shouldAnimate) {
      this.activePosition = newPosition;
      return;
    }

    const items = this.carouselItems?.toArray() ?? [];
    items.forEach(item => {
      (item.nativeElement as HTMLElement).style.transition = 'none';
    });

    this.activePosition = newPosition;
    this.isRepositioning = true;
    this.activeIndex = Math.round(this.activePosition);

    items.forEach((item, index) => {
      this.displayItem(item.nativeElement, index, items.length);
    });

    if (items[0]) {
      void (items[0].nativeElement as HTMLElement).offsetHeight;
    }

    requestAnimationFrame(() => {
      items.forEach(item => {
        (item.nativeElement as HTMLElement).style.transition = '';
      });
      this.isRepositioning = false;
    });
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

  onItemClick(i: number, event: EventCardData): void {
    if (i === this.activeIndex) {
      this.selectedEvent = event;
      return;
    }
    this.activePosition = i;
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
