import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArtistService } from '../../../services/artist.service';
import { Artist, ArtistStatus, UpdateArtistDto } from '../../../models/artist.model';

interface SocialLinkForm {
  id?: number;
  platform: number;
  url: string;
}

interface GalleryImageForm {
  id?: number;
  imageUrl: string;
  caption?: string;
  displayOrder: number;
}

interface VideoForm {
  id?: number;
  videoUrl: string;
  title?: string;
  displayOrder: number;
}

@Component({
  selector: 'app-artist-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './artist-edit-modal.component.html',
  styleUrls: ['./artist-edit-modal.component.css']
})
export class ArtistEditModalComponent implements OnInit {
  @Input() artistId: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  artist: Artist | null = null;
  loading = false;
  saving = false;
  error: string | null = null;
  isEditMode = false;

  // Edit form
  editForm = {
    name: '',
    englishName: '',
    shortBio: '',
    biography: '',
    imageUrl: '',
    bannerImageUrl: '',
    bannerGifUrl: '',
    websiteUrl: '',
    status: ArtistStatus.Pending,
    isPremium: false,
    socialLinks: [] as SocialLinkForm[],
    galleryImages: [] as GalleryImageForm[],
    videos: [] as VideoForm[]
  };

  ArtistStatus = ArtistStatus;

  constructor(private artistService: ArtistService) { }

  ngOnInit(): void {
    this.isEditMode = this.artistId !== null;

    if (this.artistId) {
      this.loadArtist();
    }
  }

  loadArtist(): void {
    if (!this.artistId) return;

    this.loading = true;
    this.error = null;

    this.artistService.getArtistById(this.artistId).subscribe({
      next: (artist) => {
        this.artist = artist;
        this.editForm = {
          name: artist.name || '',
          englishName: artist.englishName || '',
          shortBio: artist.shortBio || '',
          biography: artist.biography || '',
          imageUrl: artist.imageUrl || '',
          bannerImageUrl: artist.bannerImageUrl || '',
          bannerGifUrl: artist.bannerGifUrl || '',
          websiteUrl: artist.websiteUrl || '',
          status: artist.status,
          isPremium: artist.isPremium,
          socialLinks: artist.socialLinks?.map(link => ({
            id: link.id,
            platform: link.platform,
            url: link.url
          })) || [],
          galleryImages: artist.galleryImages?.map(img => ({
            id: img.id,
            imageUrl: img.imageUrl,
            caption: img.caption,
            displayOrder: img.displayOrder
          })) || [],
          videos: artist.videos?.map(video => ({
            id: video.id,
            videoUrl: video.videoUrl,
            title: video.title,
            displayOrder: video.displayOrder
          })) || []
        };
        this.loading = false;
      },
      error: (err) => {
        console.error('שגיאה בטעינת פרטי אומן:', err);
        this.error = 'שגיאה בטעינת פרטי האומן';
        this.loading = false;
      }
    });
  }

  onSave(): void {
    if (this.saving) return;

    // Validate required fields
    if (!this.editForm.name?.trim()) {
      this.error = 'שם האומן הוא שדה חובה';
      return;
    }

    this.saving = true;
    this.error = null;

    if (this.isEditMode && this.artistId) {
      // Update existing artist
      const updateDto: UpdateArtistDto = {
        englishName: this.editForm.englishName || undefined,
        shortBio: this.editForm.shortBio || undefined,
        biography: this.editForm.biography || undefined,
        imageUrl: this.editForm.imageUrl || undefined,
        bannerImageUrl: this.editForm.bannerImageUrl || undefined,
        bannerGifUrl: this.editForm.bannerGifUrl || undefined,
        websiteUrl: this.editForm.websiteUrl || undefined,
        status: Number(this.editForm.status),  // Convert to number
        isPremium: this.editForm.isPremium,
        socialLinks: this.editForm.socialLinks.filter(link => link.url?.trim()).map(link => ({
          id: link.id,
          platform: Number(link.platform),
          url: link.url
        })),
        galleryImages: this.editForm.galleryImages.filter(img => img.imageUrl?.trim()).map(img => ({
          imageUrl: img.imageUrl,
          caption: img.caption,
          displayOrder: img.displayOrder
        })),
        videos: this.editForm.videos.filter(video => video.videoUrl?.trim()).map(video => ({
          videoUrl: video.videoUrl,
          title: video.title,
          displayOrder: video.displayOrder
        }))
      };

      this.artistService.updateArtist(this.artistId, updateDto).subscribe({
        next: () => {
          this.saving = false;
          this.saved.emit();
          this.onClose();
        },
        error: (err) => {
          console.error('שגיאה בעדכון אומן:', err);
          this.error = 'שגיאה בעדכון פרטי האומן';
          this.saving = false;
        }
      });
    } else {
      // Create new artist
      const createDto: any = {
        name: this.editForm.name,
        englishName: this.editForm.englishName || undefined,
        shortBio: this.editForm.shortBio || undefined,
        biography: this.editForm.biography || undefined,
        imageUrl: this.editForm.imageUrl || undefined,
        bannerImageUrl: this.editForm.bannerImageUrl || undefined,
        bannerGifUrl: this.editForm.bannerGifUrl || undefined,
        websiteUrl: this.editForm.websiteUrl || undefined,
        status: Number(this.editForm.status),  // Convert to number
        isPremium: this.editForm.isPremium,
        socialLinks: this.editForm.socialLinks.filter(link => link.url?.trim()).map(link => ({
          platform: Number(link.platform),
          url: link.url
        })),
        galleryImages: this.editForm.galleryImages.filter(img => img.imageUrl?.trim()).map(img => ({
          imageUrl: img.imageUrl,
          caption: img.caption,
          displayOrder: img.displayOrder
        })),
        videos: this.editForm.videos.filter(video => video.videoUrl?.trim()).map(video => ({
          videoUrl: video.videoUrl,
          title: video.title,
          displayOrder: video.displayOrder
        }))
      };

      console.log('Creating artist with DTO:', createDto);

      this.artistService.createArtist(createDto).subscribe({
        next: () => {
          this.saving = false;
          this.saved.emit();
          this.onClose();
        },
        error: (err) => {
          console.error('שגיאה ביצירת אומן:', err);
          // Show the actual error message from backend
          this.error = err.error || err.message || 'שגיאה ביצירת האומן';
          this.saving = false;
        }
      });
    }
  }

  // Social Links Management
  addSocialLink(): void {
    this.editForm.socialLinks.push({
      platform: 1, // Facebook as default
      url: ''
    });
  }

  removeSocialLink(index: number): void {
    this.editForm.socialLinks.splice(index, 1);
  }

  // Gallery Images Management
  addGalleryImage(): void {
    this.editForm.galleryImages.push({
      imageUrl: '',
      caption: '',
      displayOrder: this.editForm.galleryImages.length
    });
  }

  removeGalleryImage(index: number): void {
    this.editForm.galleryImages.splice(index, 1);
  }

  // Videos Management
  addVideo(): void {
    this.editForm.videos.push({
      videoUrl: '',
      title: '',
      displayOrder: this.editForm.videos.length
    });
  }

  removeVideo(index: number): void {
    this.editForm.videos.splice(index, 1);
  }

  // Helper Methods
  getCharCount(text: string | undefined): number {
    return text?.length || 0;
  }

  getStatusLabel(status: ArtistStatus): string {
    switch (status) {
      case ArtistStatus.Pending: return 'ממתין לאישור';
      case ArtistStatus.Active: return 'פעיל';
      case ArtistStatus.Hidden: return 'מוסתר';
      default: return 'לא ידוע';
    }
  }

  getStatusBadgeClass(status: ArtistStatus): string {
    switch (status) {
      case ArtistStatus.Pending: return 'pending';
      case ArtistStatus.Active: return 'active';
      case ArtistStatus.Hidden: return 'hidden';
      default: return '';
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
