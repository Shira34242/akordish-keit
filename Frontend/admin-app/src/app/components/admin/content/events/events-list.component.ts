import { Component, OnInit, inject, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { EventService } from '../../../../services/admin/event.service';
import { Event, CreateEventDto } from '../../../../models/event.model';
import { PagedResult } from '../../../../models/pagination.model';
import { SiteAlertService } from '../../../../services/site-alert.service';
import { EventCardData } from '../../../../utils/event.utils';
import { EventModalComponent } from '../../../shared/event-modal/event-modal.component';
import { ArtistService } from '../../../../services/artist.service';
import { ArtistListDto } from '../../../../models/artist.model';


@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule, EventModalComponent],
  templateUrl: './events-list.component.html',
  styleUrls: ['./events-list.component.css']
})
export class EventsListComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  private readonly artistService = inject(ArtistService);
  private isDestroyed = false;
  private scrollObserver?: IntersectionObserver;

  @ViewChild('scrollSentinel') scrollSentinelRef?: ElementRef<HTMLElement>;

  // State
  events: Event[] = [];
  artists: ArtistListDto[] = [];
  loading = false;
  bulkActionLoading = false;
  selectedEventIds = new Set<number>();
  savingStatusId: number | null = null;
  selectedEventPreview: EventCardData | null = null;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-events-view-v2') as 'list' | 'grid') || 'grid';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-events-view-v2', mode); }

  // Infinite scroll
  currentPage = 0;
  pageSize = 25;
  totalItems = 0;
  allLoaded = false;
  loadingMore = false;

  // Filters
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'draft' = 'all';
  selectedArtistId?: number;
  uploaderSearch = '';
  dateFrom = '';
  dateTo = '';
  sortBy = 'eventDate';

  ngOnInit(): void {
    this.loadArtists();
    this.loadEvents();
  }

  ngAfterViewInit(): void {
    this.setupScrollObserver();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.destroyScrollObserver();
  }

  private destroyScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = undefined;
    }
  }

  private setupScrollObserver(): void {
    if (this.isDestroyed) return;

    this.destroyScrollObserver();

    if (!this.scrollSentinelRef?.nativeElement) {
      setTimeout(() => this.setupScrollObserver(), 100);
      return;
    }

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.loading && !this.loadingMore && !this.allLoaded) {
          this.loadMoreEvents();
        }
      },
      { rootMargin: '200px' }
    );

    this.scrollObserver.observe(this.scrollSentinelRef.nativeElement);
  }

  private reattachScrollObserver(): void {
    if (!this.scrollSentinelRef?.nativeElement) return;
    this.scrollObserver?.disconnect();
    this.scrollObserver?.observe(this.scrollSentinelRef.nativeElement);
  }

  loadArtists(): void {
    this.artistService.getArtists(undefined, undefined, 1, 200, 'name').subscribe({
      next: (result) => this.artists = result.items,
      error: (err) => console.error('Error loading artists', err)
    });
  }

  loadEvents(): void {
    this.loading = true;
    this.currentPage = 1;
    this.allLoaded = false;
    this.loadingMore = false;

    this.eventService.getEvents(
      this.currentPage,
      this.pageSize,
      this.searchTerm || undefined,
      this.getActiveFilter(),
      undefined,
      undefined,
      this.selectedArtistId,
      this.uploaderSearch || undefined,
      this.dateFrom || undefined,
      this.dateTo || undefined,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<Event>) => {
        this.events = result.items;
        this.totalItems = result.totalCount;
        this.allLoaded = result.items.length >= result.totalCount;
        this.clearSelection();
        this.loading = false;
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (error) => {
        console.error('Error loading events:', error);
        this.loading = false;
      }
    });
  }

  loadMoreEvents(): void {
    if (this.loading || this.loadingMore || this.allLoaded) return;

    this.loadingMore = true;
    this.currentPage++;

    this.eventService.getEvents(
      this.currentPage,
      this.pageSize,
      this.searchTerm || undefined,
      this.getActiveFilter(),
      undefined,
      undefined,
      this.selectedArtistId,
      this.uploaderSearch || undefined,
      this.dateFrom || undefined,
      this.dateTo || undefined,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<Event>) => {
        this.events = [...this.events, ...result.items];
        this.totalItems = result.totalCount;
        this.allLoaded = this.events.length >= result.totalCount;
        this.loadingMore = false;
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (error) => {
        console.error('Error loading more events:', error);
        this.loadingMore = false;
        this.currentPage--;
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

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadEvents();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.selectedArtistId = undefined;
    this.uploaderSearch = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.sortBy = 'eventDate';
    this.onFilterChange();
  }

  private getActiveFilter(): boolean | undefined {
    if (this.statusFilter === 'active') return true;
    if (this.statusFilter === 'draft') return false;
    return undefined;
  }

  get selectedCount(): number {
    return this.selectedEventIds.size;
  }

  get selectedEventIdsArray(): number[] {
    return Array.from(this.selectedEventIds);
  }

  get hasSelection(): boolean {
    return this.selectedEventIds.size > 0;
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.searchTerm ||
      this.statusFilter !== 'all' ||
      this.selectedArtistId ||
      this.dateFrom ||
      this.dateTo ||
      this.sortBy !== 'eventDate'
    );
  }

  get allCurrentPageSelected(): boolean {
    return this.events.length > 0 && this.events.every(event => this.selectedEventIds.has(event.id));
  }

  isSelected(eventId: number): boolean {
    return this.selectedEventIds.has(eventId);
  }

  toggleEventSelection(eventId: number, event?: globalThis.Event): void {
    event?.stopPropagation();
    if (this.selectedEventIds.has(eventId)) {
      this.selectedEventIds.delete(eventId);
      return;
    }

    this.selectedEventIds.add(eventId);
  }

  toggleSelectCurrentPage(): void {
    if (this.allCurrentPageSelected) {
      this.events.forEach(event => this.selectedEventIds.delete(event.id));
      return;
    }

    this.events.forEach(event => this.selectedEventIds.add(event.id));
  }

  selectAllCurrentPage(): void {
    this.events.forEach(event => this.selectedEventIds.add(event.id));
  }

  clearSelection(): void {
    this.selectedEventIds.clear();
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
      description: event.description,
      uploaderProfile: event.uploaderProfile
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

  async bulkDeleteSelected(): Promise<void> {
    const ids = this.selectedEventIdsArray;
    if (ids.length === 0) return;

    if (!await this.siteAlerts.confirm(`למחוק ${ids.length} הופעות שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(ids.map(id => this.eventService.deleteEvent(id))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadEvents();
      },
      error: (error) => {
        console.error('Error deleting selected events:', error);
        alert('שגיאה במחיקת ההופעות');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkSetStatus(isActive: boolean): Promise<void> {
    const selectedEvents = this.events.filter(event => this.selectedEventIds.has(event.id));
    if (selectedEvents.length === 0) return;

    const action = isActive ? 'לאשר' : 'להעביר לטיוטה';
    if (!await this.siteAlerts.confirm(`${action} ${selectedEvents.length} הופעות שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(selectedEvents.map(event => this.eventService.updateEvent(event.id, {
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
    }))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadEvents();
      },
      error: (error) => {
        console.error('Error updating selected events:', error);
        alert('שגיאה בעדכון ההופעות');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkDuplicateSelected(): Promise<void> {
    const ids = Array.from(this.selectedEventIds);
    if (ids.length === 0) return;

    if (!await this.siteAlerts.confirm(`לשכפל ${ids.length} הופעות שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(ids.map(id => this.eventService.getEvent(id))).pipe(
      switchMap(events => {
        const createRequests = events.map(event => {
          const dto: CreateEventDto = {
            name: event.name + ' (עותק)',
            imageUrl: event.imageUrl || '',
            ticketUrl: event.ticketUrl || '',
            description: event.description,
            bannerImageUrl: event.bannerImageUrl,
            eventDate: event.eventDate,
            location: event.location,
            artistName: event.artistName,
            artistIds: event.taggedArtists?.map(a => a.artistId),
            price: event.price,
            displayOrder: event.displayOrder,
            isActive: false,
          };
          return this.eventService.createEvent(dto);
        });
        return forkJoin(createRequests);
      })
    ).subscribe({
      next: () => {
        this.clearSelection();
        this.bulkActionLoading = false;
        this.loadEvents();
      },
      error: (error) => {
        console.error('Error duplicating events:', error);
        alert('שגיאה בשכפול ההופעות');
        this.bulkActionLoading = false;
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
