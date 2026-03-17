import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EventService } from '../../../services/admin/event.service';
import { ArtistService } from '../../../services/artist.service';
import { CreateEventDto } from '../../../models/event.model';
import { ArtistListDto } from '../../../models/artist.model';
import { FileUploadInputComponent } from '../../shared/file-upload-input/file-upload-input.component';

@Component({
  selector: 'app-submit-event',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './submit-event.component.html',
  styleUrls: ['./submit-event.component.css']
})
export class SubmitEventComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly artistService = inject(ArtistService);
  private readonly router = inject(Router);

  saving = false;
  submitted = false;
  loadingArtists = false;

  allArtists: ArtistListDto[] = [];
  selectedArtistIds: number[] = [];
  artistSearchTerm = '';
  dropdownOpen = false;

  // Form model — isActive=false means pending admin approval
  event: CreateEventDto = {
    name: '',
    description: '',
    imageUrl: '',
    ticketUrl: '',
    eventDate: '',
    location: '',
    artistName: '',
    price: undefined,
    displayOrder: 0,
    isActive: false,
    artistIds: []
  };

  ngOnInit(): void {
    this.loadArtists();
  }

  loadArtists(): void {
    this.loadingArtists = true;
    this.artistService.getArtists(undefined, 1, 1, 100, 'name').subscribe({
      next: (result) => {
        this.allArtists = result.items;
        this.loadingArtists = false;
      },
      error: () => { this.loadingArtists = false; }
    });
  }

  get filteredArtists(): ArtistListDto[] {
    const term = this.artistSearchTerm.trim().toLowerCase();
    return term ? this.allArtists.filter(a => a.name.toLowerCase().includes(term)) : this.allArtists;
  }

  isArtistSelected(id: number): boolean {
    return this.selectedArtistIds.includes(id);
  }

  toggleArtist(id: number): void {
    const idx = this.selectedArtistIds.indexOf(id);
    if (idx > -1) {
      this.selectedArtistIds.splice(idx, 1);
    } else {
      this.selectedArtistIds.push(id);
    }
    this.event.artistIds = [...this.selectedArtistIds];
  }

  removeArtist(id: number): void {
    this.selectedArtistIds = this.selectedArtistIds.filter(a => a !== id);
    this.event.artistIds = [...this.selectedArtistIds];
  }

  getArtistName(id: number): string {
    return this.allArtists.find(a => a.id === id)?.name || '';
  }

  getArtistImage(id: number): string {
    return this.allArtists.find(a => a.id === id)?.imageUrl || '';
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.artists-dropdown-wrapper')) {
      this.dropdownOpen = false;
    }
  }

  onSubmit(): void {
    if (!this.validateForm()) return;
    this.saving = true;
    this.event.isActive = false; // always pending approval
    this.event.artistIds = [...this.selectedArtistIds];
    this.eventService.submitEvent(this.event).subscribe({
      next: () => {
        this.saving = false;
        this.submitted = true;
      },
      error: (error) => {
        console.error('Error submitting event:', error);
        alert('שגיאה בשליחת ההופעה: ' + (error.error?.message || error.message));
        this.saving = false;
      }
    });
  }

  validateForm(): boolean {
    if (!this.event.name.trim()) {
      alert('נא להזין כותרת להופעה');
      return false;
    }
    if (!this.event.eventDate) {
      alert('נא לבחור תאריך ושעה להופעה');
      return false;
    }
    if (!this.event.location?.trim()) {
      alert('נא להזין מיקום ההופעה');
      return false;
    }
    return true;
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
