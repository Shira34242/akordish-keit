import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EventService } from '../../../../services/admin/event.service';
import { Event } from '../../../../models/event.model';
import { PagedResult } from '../../../../models/pagination.model';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './events-list.component.html',
  styleUrls: ['./events-list.component.css']
})
export class EventsListComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);

  // State
  events: Event[] = [];
  loading = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  showActiveOnly = true;

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.loading = true;

    this.eventService.getEvents(
      this.currentPage,
      this.pageSize,
      this.searchTerm || undefined,
      this.showActiveOnly ? true : undefined
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

  onActiveFilterChange(): void {
    this.currentPage = 1;
    this.loadEvents();
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

  deleteEvent(event: Event): void {
    if (confirm(`האם אתה בטוח שברצונך למחוק את ההופעה "${event.name}"?`)) {
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
    if (event.eventStatus === 'היום') {
      return 'status-today';
    } else if (event.eventStatus === 'אירוע שחלף') {
      return 'status-past';
    }
    return 'status-upcoming';
  }
}
