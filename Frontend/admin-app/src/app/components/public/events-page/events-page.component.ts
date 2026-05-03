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
  selectedEvent: EventCardData | null = null;
  filterMode: FilterMode = 'upcoming';

  private progress = 0;
  private activeIndex = 0;
  private isDown = false;
  private startX = 0;
  private startProgress = 0;
  private touchStartX = 0;
  private touchStartProgress = 0;
  private readonly speedWheel = 0.02;
  private readonly speedDrag = -0.1;

  ngOnInit(): void {
    this.analytics.trackEventView();
    this.eventService.getEvents(1, 100, undefined, true).subscribe({
      next: (result) => {
        this.allEvents = result.items.map(e => this.toCardData(e));
        this.updateFiltered();
        this.loading = false;
        setTimeout(() => this.animate(), 0);
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
    this.progress = 0;
    this.updateFiltered();
    setTimeout(() => this.animate(), 0);
  }

  private updateFiltered(): void {
    if (this.filterMode === 'upcoming') {
      this.filteredEvents = this.allEvents.filter(e => !e.isPast);
    } else if (this.filterMode === 'past') {
      this.filteredEvents = this.allEvents.filter(e => e.isPast);
    } else {
      this.filteredEvents = [...this.allEvents];
    }
  }

  trackById(_: number, event: EventCardData): string {
    return String(event.id);
  }

  private getZindex(index: number, total: number): number {
    return total - Math.abs(index - this.activeIndex);
  }

  private displayItem(el: HTMLElement, index: number, total: number): void {
    const active = (index - this.activeIndex) / total;
    const absDiff = Math.abs(index - this.activeIndex);
    const brightness = Math.max(0.3, 1 - absDiff * 0.18);
    el.style.setProperty('--active', String(active));
    el.style.setProperty('--zIndex', String(this.getZindex(index, total)));
    el.style.setProperty('--brightness', String(brightness));
  }

  private animate(): void {
    const items = this.carouselItems?.toArray();
    if (!items || items.length === 0) return;

    const total = items.length;
    this.progress = Math.max(0, Math.min(this.progress, 100));
    this.activeIndex = Math.floor((this.progress / 100) * (total - 1));

    items.forEach((item, index) => {
      this.displayItem(item.nativeElement, index, total);
    });
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.progress += e.deltaY * this.speedWheel;
    this.animate();
  }

  onMouseDown(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('.events-header')) return;
    this.isDown = true;
    this.startX = e.clientX;
    this.startProgress = this.progress;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDown) return;
    const x = e.clientX - this.startX;
    this.progress = this.startProgress + x * this.speedDrag;
    this.animate();
  }

  onMouseUp(): void {
    this.isDown = false;
  }

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartProgress = this.progress;
  }

  onTouchMove(e: TouchEvent): void {
    const x = e.touches[0].clientX - this.touchStartX;
    this.progress = this.touchStartProgress + x * this.speedDrag;
    this.animate();
  }

  onItemClick(i: number, event: EventCardData): void {
    if (i === this.activeIndex) {
      this.selectedEvent = event;
      return;
    }
    const total = this.filteredEvents.length;
    this.progress = total > 1 ? (i / (total - 1)) * 100 : 0;
    this.animate();
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
      taggedArtistNames: event.taggedArtists?.map(a => a.artistName) ?? [],
      eventStatus: event.eventStatus,
      daysUntilEvent: event.daysUntilEvent,
      isPast: event.isPast,
      description: event.description
    };
  }
}
