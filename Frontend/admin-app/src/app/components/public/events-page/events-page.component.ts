import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EventService } from '../../../services/admin/event.service';
import { Event } from '../../../models/event.model';
import { EventCardData } from '../../../utils/event.utils';
import { EventCardComponent } from '../../shared/event-card/event-card.component';
import { EventModalComponent } from '../../shared/event-modal/event-modal.component';

type FilterMode = 'upcoming' | 'all' | 'past';

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [CommonModule, RouterModule, EventCardComponent, EventModalComponent],
  templateUrl: './events-page.component.html',
  styleUrls: ['./events-page.component.css']
})
export class EventsPageComponent implements OnInit, AfterViewInit {
  private readonly eventService = inject(EventService);

  @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;
  private fullHeroHeight = 0;
  private rafPending = false;

  loading = true;
  allEvents: EventCardData[] = [];
  selectedEvent: EventCardData | null = null;
  filterMode: FilterMode = 'upcoming';

  get filteredEvents(): EventCardData[] {
    if (this.filterMode === 'upcoming') return this.allEvents.filter(e => !e.isPast);
    if (this.filterMode === 'past') return this.allEvents.filter(e => e.isPast);
    return this.allEvents;
  }

  ngOnInit(): void {
    this.eventService.getEvents(1, 100, undefined, true).subscribe({
      next: (result) => {
        this.allEvents = result.items.map(e => this.toCardData(e));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    this.initHeroHeight();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.shrinkHero();
      this.rafPending = false;
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.initHeroHeight();
  }

  setFilter(mode: FilterMode): void {
    this.filterMode = mode;
  }

  openModal(event: EventCardData): void {
    this.selectedEvent = event;
  }

  private initHeroHeight(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg) return;
    this.fullHeroHeight = Math.round(window.innerHeight * 0.52);
    bg.style.height = this.fullHeroHeight + 'px';
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    const minHeight = 56;
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = newHeight + 'px';

    const overlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (overlay) {
      const range = this.fullHeroHeight - minHeight;
      const progress = range > 0 ? Math.min(1, (this.fullHeroHeight - newHeight) / range) : 0;
      overlay.style.opacity = String(progress);
    }
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
