import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { EventService } from '../../../../services/admin/event.service';
import { MediaService } from '../../../../services/admin/media.service';
import { ArtistService } from '../../../../services/artist.service';
import { CreateEventDto, UpdateEventDto, Event } from '../../../../models/event.model';
import { ArtistListDto } from '../../../../models/artist.model';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-form.component.html',
  styleUrls: ['./event-form.component.css']
})
export class EventFormComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly mediaService = inject(MediaService);
  private readonly artistService = inject(ArtistService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isEditMode = false;
  eventId?: number;
  loading = false;
  saving = false;
  uploadingImage = false;
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
        // Convert Event to UpdateEventDto
        this.event = {
          name: event.name,
          description: event.description,
          imageUrl: event.imageUrl,
          ticketUrl: event.ticketUrl,
          eventDate: this.formatDateForInput(event.eventDate),
          location: event.location,
          artistName: event.artistName,
          price: event.price,
          displayOrder: event.displayOrder,
          isActive: event.isActive,
          artistIds: event.taggedArtists.map(a => a.artistId)
        };

        // טעינת האמנים המתוייגים
        this.selectedArtistIds = event.taggedArtists.map(a => a.artistId);

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

  formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  }

  onImageFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.uploadingImage = true;
      this.mediaService.uploadMedia(file).subscribe({
        next: (response) => {
          this.event.imageUrl = response.url;
          this.uploadingImage = false;
        },
        error: (error) => {
          console.error('Error uploading image:', error);
          alert('שגיאה בהעלאת התמונה');
          this.uploadingImage = false;
        }
      });
    }
  }

  toggleArtistSelection(artistId: number): void {
    const index = this.selectedArtistIds.indexOf(artistId);
    if (index > -1) {
      // כבר נבחר - הסר אותו
      this.selectedArtistIds.splice(index, 1);
    } else {
      // לא נבחר - הוסף אותו
      this.selectedArtistIds.push(artistId);
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

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;

    // ודא ש-artistIds מעודכן
    this.event.artistIds = this.selectedArtistIds.length > 0 ? [...this.selectedArtistIds] : [];

    if (this.isEditMode && this.eventId) {
      this.eventService.updateEvent(this.eventId, this.event as UpdateEventDto).subscribe({
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
      this.eventService.createEvent(this.event as CreateEventDto).subscribe({
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
    if (!this.event.name.trim()) {
      alert('נא להזין כותרת להופעה');
      return false;
    }

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

  goBack(): void {
    this.router.navigate(['/admin/content/events']);
  }
}
