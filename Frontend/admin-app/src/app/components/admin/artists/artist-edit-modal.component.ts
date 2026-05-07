import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArtistService } from '../../../services/artist.service';
import { FileUploadInputComponent } from '../../shared/file-upload-input/file-upload-input.component';
import {
  Artist,
  ArtistStatus,
  BannerMediaType,
  PerformanceEventInput,
  UpdateArtistDto
} from '../../../models/artist.model';

interface SocialLinkForm {
  id?: number;
  platform: number;
  url: string;
}

type GalleryItemKind = 'image' | 'video';

interface GalleryItemForm {
  id?: number;
  kind: GalleryItemKind;
  imageUrl?: string;
  caption?: string;
  videoUrl?: string;
  title?: string;
  displayOrder: number;
}

interface PerformanceEventForm {
  enabled: boolean;
  eventId?: number;
  name: string;
  description: string;
  imageUrl: string;        // פוסטר ריבועי לדף ההופעות
  bannerImageUrl: string;  // באנר רחב לדף האמן
  ticketUrl: string;
  eventDate: string;       // datetime-local
  location: string;
  price: number | null;
  isActive: boolean;
}

@Component({
  selector: 'app-artist-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
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

  readonly MUSIC_PLATFORMS = [3, 7, 8]; // YouTube, Spotify, Zing

  readonly GALLERY_MIN_ITEMS = 5;

  // Edit form
  editForm = {
    name: '',
    englishName: '',
    shortBio: '',
    biography: '',
    imageUrl: '',
    bannerMediaType: 'image' as BannerMediaType,
    bannerUrl: '',           // URL פעיל אחד לפי הסוג
    bannerBlur: 0,
    websiteUrl: '',
    status: ArtistStatus.Pending,
    isPremium: false,
    socialLinks: [] as SocialLinkForm[],
    musicLinks: [] as SocialLinkForm[],
    galleryItems: [] as GalleryItemForm[],
    performance: {
      enabled: false,
      eventId: undefined,
      name: '',
      description: '',
      imageUrl: '',
      bannerImageUrl: '',
      ticketUrl: '',
      eventDate: '',
      location: '',
      price: null,
      isActive: true
    } as PerformanceEventForm
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
        const bannerType: BannerMediaType = (artist.bannerMediaType as BannerMediaType)
          || (artist.bannerGifUrl ? 'gif' : 'image');
        const bannerUrl = bannerType === 'image' ? (artist.bannerImageUrl || '') : (artist.bannerGifUrl || '');

        const galleryItems: GalleryItemForm[] = [];
        (artist.galleryImages || []).forEach((img, idx) => {
          galleryItems.push({
            id: img.id,
            kind: 'image',
            imageUrl: img.imageUrl,
            caption: img.caption,
            displayOrder: img.displayOrder ?? idx
          });
        });
        (artist.videos || []).forEach((vid, idx) => {
          galleryItems.push({
            id: vid.id,
            kind: 'video',
            videoUrl: vid.videoUrl,
            title: vid.title,
            displayOrder: (vid.displayOrder ?? idx) + 1000
          });
        });
        galleryItems.sort((a, b) => a.displayOrder - b.displayOrder);

        const ev = artist.performanceEvent;
        const performance: PerformanceEventForm = {
          enabled: !!(artist.performanceIsActive && ev),
          eventId: ev?.id,
          name: ev?.name || '',
          description: ev?.description || '',
          imageUrl: ev?.imageUrl || artist.performanceImageUrl || '',
          bannerImageUrl: ev?.bannerImageUrl || artist.performanceImageUrl || '',
          ticketUrl: ev?.ticketUrl || artist.performanceTicketUrl || '',
          eventDate: ev?.eventDate ? this.toLocalDateInput(ev.eventDate) : '',
          location: ev?.location || '',
          price: ev?.price ?? null,
          isActive: ev?.isActive ?? true
        };

        this.editForm = {
          name: artist.name || '',
          englishName: artist.englishName || '',
          shortBio: artist.shortBio || '',
          biography: artist.biography || '',
          imageUrl: artist.imageUrl || '',
          bannerMediaType: bannerType,
          bannerUrl: bannerUrl,
          bannerBlur: artist.bannerBlur ?? 0,
          websiteUrl: artist.websiteUrl || '',
          status: artist.status,
          isPremium: artist.isPremium,
          socialLinks: artist.socialLinks?.filter(l => !this.MUSIC_PLATFORMS.includes(l.platform)).map(link => ({
            id: link.id,
            platform: link.platform,
            url: link.url
          })) || [],
          musicLinks: artist.socialLinks?.filter(l => this.MUSIC_PLATFORMS.includes(l.platform)).map(link => ({
            id: link.id,
            platform: link.platform,
            url: link.url
          })) || [],
          galleryItems,
          performance
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

    const bannerType = this.editForm.bannerMediaType;
    const bannerUrl = this.optionalText(this.editForm.bannerUrl);

    const commonPayload: Partial<UpdateArtistDto> = {
      englishName: this.optionalText(this.editForm.englishName),
      shortBio: this.optionalText(this.editForm.shortBio),
      biography: this.optionalText(this.editForm.biography),
      imageUrl: this.optionalText(this.editForm.imageUrl),
      // רק שדה אחד מתאים מתמלא — בחירה אחת בלבד
      bannerImageUrl: bannerType === 'image' ? bannerUrl : undefined,
      bannerGifUrl: (bannerType === 'gif' || bannerType === 'video') ? bannerUrl : undefined,
      bannerMediaType: bannerUrl ? bannerType : null,
      bannerBlur: Number(this.editForm.bannerBlur) || 0,
      websiteUrl: this.optionalText(this.editForm.websiteUrl),
      status: Number(this.editForm.status),
      isPremium: this.editForm.isPremium,
      performanceIsActive: this.editForm.performance.enabled,
      performanceEvent: this.buildPerformanceEvent(),
      socialLinks: this.normalizedLinks(),
      galleryImages: this.normalizedGalleryImages(),
      videos: this.normalizedVideos()
    };

    if (this.isEditMode && this.artistId) {
      // Update existing artist
      const updateDto: UpdateArtistDto = {
        ...commonPayload
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
        ...commonPayload,
        name: this.editForm.name.trim()
      };

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
    this.editForm.socialLinks.push({ platform: 1, url: '' });
  }

  removeSocialLink(index: number): void {
    this.editForm.socialLinks.splice(index, 1);
  }

  addMusicLink(): void {
    this.editForm.musicLinks.push({ platform: 7, url: '' }); // Spotify default
  }

  removeMusicLink(index: number): void {
    this.editForm.musicLinks.splice(index, 1);
  }

  // Gallery Management (תמונות + וידאו תחת אזור אחד)
  addGalleryImage(): void {
    this.editForm.galleryItems.push({
      kind: 'image',
      imageUrl: '',
      caption: '',
      displayOrder: this.editForm.galleryItems.length
    });
  }

  addGalleryVideo(): void {
    this.editForm.galleryItems.push({
      kind: 'video',
      videoUrl: '',
      title: '',
      displayOrder: this.editForm.galleryItems.length
    });
  }

  removeGalleryItem(index: number): void {
    this.editForm.galleryItems.splice(index, 1);
  }

  get galleryItemsCount(): number {
    return this.editForm.galleryItems.filter(it => {
      if (it.kind === 'image') return !!it.imageUrl?.trim();
      return !!it.videoUrl?.trim();
    }).length;
  }

  setBannerType(type: BannerMediaType): void {
    this.editForm.bannerMediaType = type;
  }

  private toLocalDateInput(iso: string): string {
    // ISO -> "yyyy-MM-ddTHH:mm" לטופס datetime-local
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  }

  private buildPerformanceEvent(): PerformanceEventInput | null {
    const p = this.editForm.performance;
    if (!p.enabled) return null;
    if (!p.name?.trim() || !p.eventDate) return null;
    return {
      eventId: p.eventId,
      name: p.name.trim(),
      description: p.description?.trim() || undefined,
      imageUrl: p.imageUrl?.trim() || '',
      bannerImageUrl: p.bannerImageUrl?.trim() || undefined,
      ticketUrl: p.ticketUrl?.trim() || '',
      eventDate: new Date(p.eventDate).toISOString(),
      location: p.location?.trim() || undefined,
      price: p.price ?? null,
      isActive: p.isActive
    };
  }

  private optionalText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private normalizedLinks() {
    return [
      ...this.editForm.socialLinks,
      ...this.editForm.musicLinks
    ]
      .filter(link => link.url?.trim())
      .map(link => ({
        id: link.id,
        platform: Number(link.platform),
        url: link.url.trim()
      }));
  }

  private normalizedGalleryImages() {
    return this.editForm.galleryItems
      .filter(it => it.kind === 'image' && it.imageUrl?.trim())
      .map((it, index) => ({
        imageUrl: it.imageUrl!.trim(),
        caption: this.optionalText(it.caption),
        displayOrder: index
      }));
  }

  private normalizedVideos() {
    return this.editForm.galleryItems
      .filter(it => it.kind === 'video' && it.videoUrl?.trim())
      .map((it, index) => ({
        videoUrl: it.videoUrl!.trim(),
        title: this.optionalText(it.title),
        displayOrder: index
      }));
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
