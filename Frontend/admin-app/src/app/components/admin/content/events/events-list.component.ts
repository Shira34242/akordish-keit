import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EventService } from '../../../../services/admin/event.service';
import { Event } from '../../../../models/event.model';
import { PagedResult } from '../../../../models/pagination.model';
import { SiteAlertService } from '../../../../services/site-alert.service';
import { EventCardData } from '../../../../utils/event.utils';
import { EventModalComponent } from '../../../shared/event-modal/event-modal.component';


@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule, EventModalComponent],
  templateUrl: './events-list.component.html',
  styleUrls: ['./events-list.component.css']
})
export class EventsListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);

  // State
  events: Event[] = [];
  loading = false;
  savingStatusId: number | null = null;
  selectedEventPreview: EventCardData | null = null;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-events-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-events-view', mode); }

  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalItems = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'draft' = 'all';

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.loading = true;

    this.eventService.getEvents(
      this.currentPage,
      this.pageSize,
      this.searchTerm || undefined,
      this.getActiveFilter()
    ).subscribe({
      next: (result: PagedResult<Event>) => {
        this.events = result.items;
        this.totalItems = result.totalCount;
        this.totalPages = result.totalPages;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading events:', error);
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadEvents();
  }

  onStatusFilterChange(): void {
    this.currentPage = 1;
    this.loadEvents();
  }

  private getActiveFilter(): boolean | undefined {
    if (this.statusFilter === 'active') return true;
    if (this.statusFilter === 'draft') return false;
    return undefined;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadEvents();
  }

  createNewEvent(): void {
    this.router.navigate(['/admin/content/events/new']);
  }

  editEvent(event: Event): void {
    this.router.navigate(['/admin/content/events/edit', event.id]);
  }

  duplicateEvent(event: Event): void {
    this.router.navigate(['/admin/content/events/new'], { queryParams: { duplicate: event.id } });
  }

  previewEvent(event: Event): void {
    this.selectedEventPreview = {
      id: event.id,
      name: event.name,
      imageUrl: event.imageUrl,
      ticketUrl: event.ticketUrl,
      eventDate: event.eventDate,
      location: event.location,
      artistName: event.artistName,
      taggedArtists: event.taggedArtists,
      taggedArtistNames: event.taggedArtists?.map(artist => artist.artistName) ?? [],
      eventStatus: event.eventStatus,
      daysUntilEvent: event.daysUntilEvent,
      isPast: event.isPast,
      description: event.description
    };
  }

  setEventStatus(event: Event, isActive: boolean): void {
    if (event.isActive === isActive || this.savingStatusId === event.id) {
      return;
    }

    this.savingStatusId = event.id;
    this.eventService.updateEvent(event.id, {
      name: event.name,
      description: event.description,
      imageUrl: event.imageUrl,
      bannerImageUrl: event.bannerImageUrl,
      ticketUrl: event.ticketUrl,
      eventDate: event.eventDate,
      location: event.location,
      artistName: event.taggedArtists?.length ? '' : event.artistName,
      artistIds: event.taggedArtists?.map(artist => artist.artistId) ?? [],
      price: event.price,
      displayOrder: event.displayOrder,
      isActive
    }).subscribe({
      next: (updated) => {
        event.isActive = updated.isActive;
        event.updatedAt = updated.updatedAt;
        this.savingStatusId = null;
        this.loadEvents();
      },
      error: (error) => {
        console.error('Error updating event status:', error);
        alert('שגיאה בעדכון סטטוס ההופעה');
        this.savingStatusId = null;
      }
    });
  }

  async deleteEvent(event: Event): Promise<void> {
    if (await this.siteAlerts.confirm(`האם אתה בטוח שברצונך למחוק את ההופעה "${event.name}"?`)) {
      this.eventService.deleteEvent(event.id).subscribe({
        next: () => {
          this.loadEvents();
        },
        error: (error) => {
          console.error('Error deleting event:', error);
          alert('שגיאה במחיקת ההופעה');
        }
      });
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getEventStatusClass(event: Event): string {
    if (!event.isActive) return 'badge-secondary';
    if (event.isPast) return 'badge-danger';
    if (event.eventStatus === 'היום') return 'badge-success';
    return 'badge-warning';
  }

  getAdminStatusLabel(event: Event): string {
    return event.isActive ? 'מאושר' : 'טיוטה / לא מאושר';
  }
}
