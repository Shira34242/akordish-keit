import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { EventService } from '../../../../services/admin/event.service';
import { ArtistService } from '../../../../services/artist.service';
import { CreateEventDto, UpdateEventDto, Event } from '../../../../models/event.model';
import { ArtistListDto } from '../../../../models/artist.model';
import { FileUploadInputComponent } from '../../../shared/file-upload-input/file-upload-input.component';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './event-form.component.html',
  styleUrls: ['./event-form.component.css']
})
export class EventFormComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly artistService = inject(ArtistService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isEditMode = false;
  eventId?: number;
  loading = false;
  saving = false;
  loadingArtists = false;

  // רשימת כל האמנים זמינים במערכת
  allArtists: ArtistListDto[] = [];

  // אמנים שנבחרו לתיוג
  selectedArtistIds: number[] = [];

  // חיפוש אמנים
  artistSearchTerm: string = '';

  // Dropdown state
  dropdownOpen: boolean = false;

  event: CreateEventDto | UpdateEventDto = {
    name: '',
    description: '',
    imageUrl: '',
    ticketUrl: '',
    eventDate: '',
    location: '',
    artistName: '',
    price: undefined,
    displayOrder: 0,
    isActive: true,
    artistIds: []
  };

  ngOnInit(): void {
    // טעינת רשימת אמנים זמינים
    this.loadArtists();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.eventId = +id;
      this.loadEvent();
    } else {
      const duplicateId = this.route.snapshot.queryParamMap.get('duplicate');
      if (duplicateId) {
        this.loadDuplicateEvent(+duplicateId);
      }
    }
  }

  loadArtists(): void {
    this.loadingArtists = true;
    // טוען רק אמנים פעילים
    this.artistService.getArtists(undefined, 1, 1, 100, 'name').subscribe({
      next: (result) => {
        this.allArtists = result.items;
        this.loadingArtists = false;
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.loadingArtists = false;
      }
    });
  }

  loadEvent(): void {
    if (!this.eventId) return;

    this.loading = true;
    this.eventService.getEvent(this.eventId).subscribe({
      next: (event: Event) => {
        const taggedArtistIds = event.taggedArtists.map(a => a.artistId);
        // Convert Event to UpdateEventDto
        this.event = {
          name: event.name,
          description: event.description,
          imageUrl: event.imageUrl,
          ticketUrl: event.ticketUrl,
          eventDate: this.formatDateForInput(event.eventDate),
          location: event.location,
          artistName: taggedArtistIds.length > 0 ? '' : event.artistName,
          price: event.price,
          displayOrder: event.displayOrder,
          isActive: event.isActive,
          artistIds: taggedArtistIds
        };

        // טעינת האמנים המתוייגים
        this.selectedArtistIds = taggedArtistIds;
        this.artistSearchTerm = taggedArtistIds.length > 0 ? '' : (event.artistName ?? '');

        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading event:', error);
        alert('שגיאה בטעינת ההופעה');
        this.loading = false;
        this.goBack();
      }
    });
  }

  loadDuplicateEvent(sourceId: number): void {
    this.loading = true;
    this.eventService.getEvent(sourceId).subscribe({
      next: (event: Event) => {
        const taggedArtistIds = event.taggedArtists.map(a => a.artistId);
        this.event = {
          name: `${event.name} (עותק)`,
          description: event.description,
          imageUrl: event.imageUrl,
          ticketUrl: event.ticketUrl,
          eventDate: '',
          location: event.location,
          artistName: taggedArtistIds.length > 0 ? '' : event.artistName,
          price: event.price,
          displayOrder: event.displayOrder,
          isActive: true,
          artistIds: taggedArtistIds
        };
        this.selectedArtistIds = taggedArtistIds;
        this.artistSearchTerm = taggedArtistIds.length > 0 ? '' : (event.artistName ?? '');
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading event for duplication:', error);
        alert('שגיאה בטעינת ההופעה לשכפול');
        this.loading = false;
      }
    });
  }

  formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  }


  toggleArtistSelection(artistId: number): void {
    const index = this.selectedArtistIds.indexOf(artistId);
    if (index > -1) {
      // כבר נבחר - הסר אותו
      this.selectedArtistIds.splice(index, 1);
    } else {
      // לא נבחר - הוסף אותו
      this.selectedArtistIds.push(artistId);
      this.artistSearchTerm = '';
    }
    // עדכון ה-DTO
    this.event.artistIds = [...this.selectedArtistIds];
  }

  isArtistSelected(artistId: number): boolean {
    return this.selectedArtistIds.includes(artistId);
  }

  get filteredArtists(): ArtistListDto[] {
    if (!this.artistSearchTerm.trim()) {
      return this.allArtists;
    }

    const searchLower = this.artistSearchTerm.toLowerCase();
    return this.allArtists.filter(artist =>
      artist.name.toLowerCase().includes(searchLower)
    );
  }

  getArtistName(artistId: number): string {
    const artist = this.allArtists.find(a => a.id === artistId);
    return artist ? artist.name : '';
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  openDropdown(): void {
    this.dropdownOpen = true;
  }

  closeDropdown(): void {
    this.dropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.closeDropdown();
    }
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;

    // ודא ש-artistIds מעודכן
    const payload = this.preparePayload();

    if (this.isEditMode && this.eventId) {
      this.eventService.updateEvent(this.eventId, payload as UpdateEventDto).subscribe({
        next: () => {
          this.saving = false;
          this.goBack();
        },
        error: (error) => {
          console.error('Error updating event:', error);
          alert('שגיאה בעדכון ההופעה');
          this.saving = false;
        }
      });
    } else {
      this.eventService.createEvent(payload as CreateEventDto).subscribe({
        next: () => {
          this.saving = false;
          this.goBack();
        },
        error: (error) => {
          console.error('Error creating event:', error);
          alert('שגיאה ביצירת ההופעה');
          this.saving = false;
        }
      });
    }
  }

  validateForm(): boolean {
    if (!this.event.imageUrl.trim()) {
      alert('נא להעלות תמונה להופעה');
      return false;
    }

    if (!this.event.ticketUrl.trim()) {
      alert('נא להזין קישור לרכישת כרטיסים');
      return false;
    }

    if (!this.event.eventDate) {
      alert('נא לבחור תאריך להופעה');
      return false;
    }

    return true;
  }

  private preparePayload(): CreateEventDto | UpdateEventDto {
    const selectedNames = this.selectedArtistIds
      .map(artistId => this.getArtistName(artistId))
      .filter(Boolean);
    const typedArtistName = this.artistSearchTerm.trim();
    const artistIds = this.selectedArtistIds.length > 0 ? [...this.selectedArtistIds] : [];
    const artistName = artistIds.length > 0 ? '' : typedArtistName;
    const fallbackName = selectedNames[0] || artistName || this.event.location || 'הופעה חדשה';

    return {
      ...this.event,
      name: this.event.name?.trim() || fallbackName,
      artistName,
      artistIds
    };
  }

  goBack(): void {
    this.router.navigate(['/admin/content/events']);
  }
}
