import { Component, ElementRef, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ArtistService } from '../../../services/artist.service';
import { SongService } from '../../../services/song.service';
import { EventService } from '../../../services/event.service';
import { FileUploadInputComponent } from '../../shared/file-upload-input/file-upload-input.component';
import {
  Artist,
  ArtistStatus,
  BannerMediaType,
  PerformanceEventInput,
  UpdateArtistDto
} from '../../../models/artist.model';
import { UpcomingEventDto } from '../../../models/event.model';

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

interface HitForm {
  id?: number;
  title: string;
  imageUrl: string;
  youTubeUrl: string;
  displayOrder: number;
  isActive: boolean;
}

interface AlbumForm {
  id?: number;
  title: string;
  coverImageUrl: string;
  releaseYear: number | null;
  externalUrl: string;
  displayOrder: number;
  isActive: boolean;
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
  private closeWithoutDraftSave = false;

  readonly MUSIC_PLATFORMS = [3, 7, 8, 9, 10, 11]; // YouTube, Spotify, Zing, Jewzik, 24Six, Apple Music

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
    hits: [] as HitForm[],
    albums: [] as AlbumForm[],
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

  // הופעות קיימות של האמן (לבחירה כבאנר במקום ליצור הופעה חדשה)
  availableEvents: UpcomingEventDto[] = [];
  // 'new' = יצירת הופעה חדשה. אחרת — id של הופעה קיימת.
  performanceEventChoice: 'new' | number = 'new';

  constructor(
    private artistService: ArtistService,
    private songService: SongService,
    private eventService: EventService,
    private host: ElementRef<HTMLElement>
  ) { }

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
          enabled: !!artist.performanceIsActive,
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

        // אם יש כבר אירוע מקושר, ברירת המחדל בבורר היא ההופעה הזו. אחרת — "יצירה חדשה".
        this.performanceEventChoice = ev?.id ?? 'new';
        this.loadArtistEvents();

        this.editForm = {
          name: artist.name || '',
          englishName: artist.englishName || '',
          shortBio: artist.shortBio || '',
          biography: artist.biography || '',
          imageUrl: artist.imageUrl || '',
          bannerMediaType: bannerType,
          bannerUrl: bannerUrl,
          bannerBlur: this.normalizedBannerBlur(artist.bannerBlur),
          websiteUrl: artist.websiteUrl || '',
          status: artist.status,
          isPremium: artist.isPremium,
          socialLinks: artist.socialLinks?.filter(l => !this.isMusicPlatform(l.platform)).map(link => ({
            id: link.id,
            platform: this.normalizePlatform(link.platform),
            url: link.url
          })) || [],
          musicLinks: artist.socialLinks?.filter(l => this.isMusicPlatform(l.platform)).map(link => ({
            id: link.id,
            platform: this.normalizePlatform(link.platform),
            url: link.url
          })) || [],
          galleryItems,
          hits: (artist.hits || []).map((hit, index) => ({
            id: hit.id,
            title: hit.title || '',
            imageUrl: hit.imageUrl || '',
            youTubeUrl: hit.youTubeUrl || hit.youtubeUrl || '',
            displayOrder: hit.displayOrder ?? index,
            isActive: hit.isActive ?? true
          })),
          albums: (artist.albums || []).map((album, index) => ({
            id: album.id,
            title: album.title || '',
            coverImageUrl: album.coverImageUrl || '',
            releaseYear: album.releaseYear ?? null,
            externalUrl: album.externalUrl || '',
            displayOrder: album.displayOrder ?? index,
            isActive: album.isActive ?? true
          })),
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
      this.showValidationError('שם האומן הוא שדה חובה', '[data-validation-target="artist-name"]');
      return;
    }

    const richContentError = this.validateRichContent();
    if (richContentError) {
      this.showValidationError(richContentError, this.getRichContentValidationTarget());
      return;
    }

    this.saving = true;
    this.error = null;

    const commonPayload = this.buildPayload(Number(this.editForm.status));

    if (this.isEditMode && this.artistId) {
      // Update existing artist
      const updateDto: UpdateArtistDto = {
        ...commonPayload
      };

      this.artistService.updateArtist(this.artistId, updateDto).subscribe({
        next: () => {
          this.saving = false;
          this.saved.emit();
          this.closeImmediately();
        },
        error: (err) => {
          console.error('שגיאה בעדכון אומן:', err);
          const message = this.extractErrorMessage(err, 'שגיאה בעדכון פרטי האומן');
          this.error = message;
          this.saving = false;
          window.alert(message);
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
          this.closeImmediately();
        },
        error: (err) => {
          console.error('שגיאה ביצירת אומן:', err);
          const message = this.extractErrorMessage(err, 'שגיאה ביצירת האומן');
          this.error = message;
          this.saving = false;
          window.alert(message);
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

  addHit(): void {
    this.editForm.hits.push({
      title: '',
      imageUrl: '',
      youTubeUrl: '',
      displayOrder: this.editForm.hits.length,
      isActive: true
    });
  }

  removeHit(index: number): void {
    this.editForm.hits.splice(index, 1);
  }

  onHitYouTubeUrlChange(index: number): void {
    const hit = this.editForm.hits[index];
    if (!hit || !hit.youTubeUrl?.trim() || hit.imageUrl?.trim()) return;

    this.songService.getYouTubeMetadata(hit.youTubeUrl.trim()).subscribe({
      next: (meta) => {
        if (meta?.title && !hit.title?.trim()) {
          hit.title = meta.title;
        }
        if (meta?.thumbnailUrl && !hit.imageUrl?.trim()) {
          hit.imageUrl = meta.thumbnailUrl;
        }
      },
      error: () => { /* ignore — user can add image manually */ }
    });
  }

  addAlbum(): void {
    this.editForm.albums.push({
      title: '',
      coverImageUrl: '',
      releaseYear: null,
      externalUrl: '',
      displayOrder: this.editForm.albums.length,
      isActive: true
    });
  }

  removeAlbum(index: number): void {
    this.editForm.albums.splice(index, 1);
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

  private loadArtistEvents(): void {
    if (!this.artistId) return;
    this.artistService.getArtistEvents(this.artistId).subscribe({
      next: (events) => { this.availableEvents = events || []; },
      error: () => { this.availableEvents = []; }
    });
  }

  /**
   * המשתמש בחר באנר הופעה — או יצירה חדשה, או הופעה קיימת.
   * בבחירה קיימת אנחנו מושכים את כל פרטי האירוע מ-/api/Events/{id}
   * וממלאים את הטופס. שדה bannerImageUrl נשאר עריך — הוא ייחודי לבאנר דף האמן.
   */
  onPerformanceEventChoiceChange(value: 'new' | number | string): void {
    if (value === 'new' || value === '' || value == null) {
      this.performanceEventChoice = 'new';
      this.editForm.performance.eventId = undefined;
      this.editForm.performance.name = '';
      this.editForm.performance.description = '';
      this.editForm.performance.eventDate = '';
      this.editForm.performance.location = '';
      this.editForm.performance.price = null;
      this.editForm.performance.ticketUrl = '';
      this.editForm.performance.imageUrl = '';
      this.editForm.performance.bannerImageUrl = '';
      this.editForm.performance.isActive = true;
      return;
    }

    const eventId = Number(value);
    this.performanceEventChoice = eventId;

    this.eventService.getEventById(eventId).subscribe({
      next: (event) => {
        this.editForm.performance.eventId = event.id;
        this.editForm.performance.name = event.name || '';
        this.editForm.performance.description = event.description || '';
        this.editForm.performance.eventDate = event.eventDate ? this.toLocalDateInput(event.eventDate) : '';
        this.editForm.performance.location = event.location || '';
        this.editForm.performance.price = event.price ?? null;
        this.editForm.performance.ticketUrl = event.ticketUrl || '';
        // פוסטר ההופעה (ריבוע) — מהאירוע הקיים
        this.editForm.performance.imageUrl = event.imageUrl || '';
        // באנר רחב לדף האמן — אם להופעה כבר יש אחד נטען אותו, אחרת ריק כדי שהמשתמש יעלה תמונה חדשה
        this.editForm.performance.bannerImageUrl = event.bannerImageUrl || '';
        this.editForm.performance.isActive = event.isActive ?? true;
      },
      error: (err) => {
        console.error('שגיאה בטעינת הופעה קיימת:', err);
        window.alert('לא ניתן לטעון את ההופעה שנבחרה');
      }
    });
  }

  formatEventOptionLabel(event: UpcomingEventDto): string {
    if (!event) return '';
    const date = event.eventDate ? new Date(event.eventDate).toLocaleDateString('he-IL') : '';
    return date ? `${event.name} — ${date}` : event.name;
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
    const imageUrl = this.optionalText(p.imageUrl) || this.optionalText(p.bannerImageUrl) || '';
    const bannerImageUrl = this.optionalText(p.bannerImageUrl) || imageUrl;
    return {
      eventId: p.eventId,
      name: p.name?.trim() || this.editForm.name.trim(),
      description: p.description?.trim() || undefined,
      imageUrl,
      bannerImageUrl,
      ticketUrl: p.ticketUrl?.trim() || '',
      eventDate: p.eventDate ? new Date(p.eventDate).toISOString() : new Date().toISOString(),
      location: p.location?.trim() || undefined,
      price: p.price ?? null,
      isActive: p.isActive
    };
  }

  private validateRichContent(): string | null {
    const p = this.editForm.performance;
    if (p.enabled) {
      const isExisting = this.performanceEventChoice !== 'new';
      if (isExisting) {
        // בחירת הופעה קיימת — חובה רק תמונת באנר רחבה לדף האמן
        if (!p.bannerImageUrl?.trim()) return 'יש להעלות תמונת באנר רחבה לדף האמן';
      } else {
        // יצירת הופעה חדשה — דורש פוסטר ושם ותאריך
        this.mirrorPerformanceImageFields(p);
        if (!p.name?.trim()) return 'יש למלא שם להופעה';
        if (!p.eventDate?.trim()) return 'יש למלא תאריך להופעה';
        if (!p.imageUrl?.trim()) return 'בבאנר הופעה יש להוסיף תמונה לפני שמירה';
        if (p.eventDate && Number.isNaN(new Date(p.eventDate).getTime())) return 'תאריך ההופעה לא תקין';
      }
    }

    for (let i = 0; i < this.editForm.hits.length; i++) {
      const message = this.getHitValidationMessage(i);
      if (message) return message;
    }

    for (let i = 0; i < this.editForm.albums.length; i++) {
      const message = this.getAlbumValidationMessage(i);
      if (message) return message;
    }

    return null;
  }

  private getRichContentValidationTarget(): string {
    const p = this.editForm.performance;
    if (p.enabled) {
      const isExisting = this.performanceEventChoice !== 'new';
      if (isExisting) {
        if (!p.bannerImageUrl?.trim()) return '[data-validation-target="performance-banner-image"]';
      } else {
        this.mirrorPerformanceImageFields(p);
        if (!p.name?.trim()) return '[name="perfName"]';
        if (!p.eventDate?.trim()) return '[name="perfDate"]';
        if (!p.imageUrl?.trim()) return '[data-validation-target="performance-image"]';
        if (p.eventDate && Number.isNaN(new Date(p.eventDate).getTime())) return '[name="perfDate"]';
      }
    }

    for (let i = 0; i < this.editForm.hits.length; i++) {
      if (this.getHitValidationMessage(i)) return `[data-validation-target="hit-youtube-${i}"]`;
    }

    for (let i = 0; i < this.editForm.albums.length; i++) {
      if (this.getAlbumValidationMessage(i)) return `[data-validation-target="album-cover-${i}"]`;
    }

    return '[data-validation-target="artist-name"]';
  }

  private showValidationError(message: string, targetSelector: string): void {
    this.error = message;
    window.alert(message);
    setTimeout(() => this.scrollToValidationTarget(targetSelector));
  }

  private scrollToValidationTarget(targetSelector: string): void {
    const target = this.host.nativeElement.querySelector<HTMLElement>(targetSelector);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    const focusable = target.matches('input, textarea, select, button')
      ? target
      : target.querySelector<HTMLElement>('input, textarea, select, button');
    focusable?.focus({ preventScroll: true });
  }

  getHitValidationMessage(index: number): string | null {
    const hit = this.editForm.hits[index];
    if (!hit || this.isBlankHit(hit) || this.isCompleteHit(hit)) return null;
    return `להיט מספר ${index + 1}: יש להוסיף קישור YouTube, או למחוק את השורה`;
  }

  getAlbumValidationMessage(index: number): string | null {
    const album = this.editForm.albums[index];
    if (!album || this.isBlankAlbum(album) || this.isCompleteAlbum(album)) return null;
    return `אלבום מספר ${index + 1}: יש להוסיף תמונת עטיפה, או למחוק את השורה`;
  }

  private isBlankHit(hit: HitForm): boolean {
    return !hit.title?.trim() && !hit.imageUrl?.trim() && !hit.youTubeUrl?.trim();
  }

  private isCompleteHit(hit: HitForm): boolean {
    return !!hit.youTubeUrl?.trim();
  }

  private isBlankAlbum(album: AlbumForm): boolean {
    return !album.title?.trim() && !album.coverImageUrl?.trim() && !album.externalUrl?.trim() && !album.releaseYear;
  }

  private isCompleteAlbum(album: AlbumForm): boolean {
    return !!album.coverImageUrl?.trim();
  }

  private optionalText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private mirrorPerformanceImageFields(performance: PerformanceEventForm): void {
    const imageUrl = performance.imageUrl?.trim();
    const bannerImageUrl = performance.bannerImageUrl?.trim();
    if (!imageUrl && bannerImageUrl) performance.imageUrl = bannerImageUrl;
    if (!bannerImageUrl && imageUrl) performance.bannerImageUrl = imageUrl;
  }

  private normalizedBannerBlur(value: number | null | undefined): number {
    const numericValue = Number(value) || 0;
    return Math.max(0, Math.min(20, numericValue));
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
      }))
      .filter(link => Number.isFinite(link.platform) && link.platform >= 1 && link.platform <= 11);
  }

  private isMusicPlatform(platform: number | string): boolean {
    return this.MUSIC_PLATFORMS.includes(this.normalizePlatform(platform));
  }

  private normalizePlatform(platform: number | string): number {
    if (typeof platform === 'number') return platform;

    const numericPlatform = Number(platform);
    if (Number.isFinite(numericPlatform)) return numericPlatform;

    const platformNames: Record<string, number> = {
      Instagram: 1,
      Facebook: 2,
      YouTube: 3,
      TikTok: 4,
      Website: 5,
      Twitter: 6,
      Spotify: 7,
      Zing: 8,
      Jewzik: 9,
      TwentyFourSix: 10,
      AppleMusic: 11
    };
    return platformNames[platform] ?? 0;
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

  private normalizedHits() {
    return this.editForm.hits
      .filter(hit => hit.youTubeUrl?.trim())
      .map((hit, index) => ({
        title: hit.title?.trim() || 'להיט גדול',
        imageUrl: this.optionalText(hit.imageUrl),
        youTubeUrl: hit.youTubeUrl.trim(),
        displayOrder: index,
        isActive: hit.isActive
      }));
  }

  private normalizedAlbums() {
    return this.editForm.albums
      .filter(album => album.coverImageUrl?.trim())
      .map((album, index) => ({
        title: album.title?.trim() || 'אלבום',
        coverImageUrl: album.coverImageUrl.trim(),
        releaseYear: album.releaseYear ?? undefined,
        externalUrl: album.externalUrl?.trim() || '',
        displayOrder: index,
        isActive: album.isActive
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
      case ArtistStatus.Draft: return 'טיוטה';
      default: return 'לא ידוע';
    }
  }

  getStatusBadgeClass(status: ArtistStatus): string {
    switch (status) {
      case ArtistStatus.Pending: return 'pending';
      case ArtistStatus.Active: return 'active';
      case ArtistStatus.Hidden: return 'hidden';
      case ArtistStatus.Draft: return 'draft';
      default: return '';
    }
  }

  get draftCloseLabel(): string {
    return (!this.isEditMode || Number(this.editForm.status) === ArtistStatus.Draft)
      ? 'סגור ושמור טיוטה'
      : 'ביטול';
  }

  onClose(): void {
    if (this.saving) return;

    if (!this.closeWithoutDraftSave && this.shouldSaveDraftOnClose()) {
      this.saveDraftAndClose();
      return;
    }

    this.closeImmediately();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  private extractErrorMessage(err: any, fallback: string): string {
    if (err.error) {
      if (err.error.errors && typeof err.error.errors === 'object') {
        const messages: string[] = [];
        for (const [, fieldErrors] of Object.entries(err.error.errors)) {
          if (Array.isArray(fieldErrors)) {
            for (const msg of fieldErrors) {
              if (typeof msg === 'string') messages.push(msg);
            }
          } else if (typeof fieldErrors === 'string') {
            messages.push(fieldErrors as string);
          }
        }
        if (messages.length > 0) return messages.join('\n');
      }
      if (typeof err.error === 'string' && err.error.trim()) return err.error.trim();
      if (err.error.message) return err.error.message;
      if (err.error.error) return err.error.error;
      if (typeof err.error === 'object') {
        try { return JSON.stringify(err.error); } catch { /* ignore */ }
      }
    }
    if (err.message) return err.message;
    return fallback;
  }

  private buildPayload(status: ArtistStatus): UpdateArtistDto {
    const isDraft = status === ArtistStatus.Draft;
    const bannerType = this.editForm.bannerMediaType;
    const bannerUrl = this.optionalText(this.editForm.bannerUrl);

    return {
      name: this.optionalText(this.editForm.name),
      englishName: this.optionalText(this.editForm.englishName),
      shortBio: this.optionalText(this.editForm.shortBio),
      biography: this.optionalText(this.editForm.biography),
      imageUrl: this.optionalText(this.editForm.imageUrl),
      bannerImageUrl: bannerType === 'image' ? bannerUrl : undefined,
      bannerGifUrl: (bannerType === 'gif' || bannerType === 'video') ? bannerUrl : undefined,
      bannerMediaType: bannerUrl ? bannerType : null,
      bannerBlur: this.normalizedBannerBlur(this.editForm.bannerBlur),
      websiteUrl: this.optionalText(this.editForm.websiteUrl),
      status,
      isPremium: this.editForm.isPremium,
      performanceIsActive: isDraft ? false : this.editForm.performance.enabled,
      performanceEvent: isDraft ? null : this.buildPerformanceEvent(),
      socialLinks: this.normalizedLinks(),
      galleryImages: this.normalizedGalleryImages(),
      videos: this.normalizedVideos(),
      hits: this.normalizedHits(),
      albums: this.normalizedAlbums()
    };
  }

  private shouldSaveDraftOnClose(): boolean {
    const isNewOrDraft = !this.isEditMode || Number(this.editForm.status) === ArtistStatus.Draft;
    return isNewOrDraft && this.hasMeaningfulDraftContent();
  }

  private hasMeaningfulDraftContent(): boolean {
    const textValues = [
      this.editForm.name,
      this.editForm.englishName,
      this.editForm.shortBio,
      this.editForm.biography,
      this.editForm.imageUrl,
      this.editForm.bannerUrl,
      this.editForm.websiteUrl
    ];

    return textValues.some(value => !!value?.trim()) ||
      this.normalizedLinks().length > 0 ||
      this.normalizedGalleryImages().length > 0 ||
      this.normalizedVideos().length > 0 ||
      this.normalizedHits().length > 0 ||
      this.normalizedAlbums().length > 0 ||
      this.editForm.performance.enabled;
  }

  private saveDraftAndClose(): void {
    this.saving = true;
    this.error = null;
    const draftPayload = this.buildPayload(ArtistStatus.Draft);
    const request: Observable<unknown> = this.isEditMode && this.artistId
      ? this.artistService.updateArtist(this.artistId, draftPayload)
      : this.artistService.createArtist(draftPayload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.saved.emit();
        this.closeImmediately();
      },
      error: (err: any) => {
        this.saving = false;
        const message = this.extractErrorMessage(err, 'לא ניתן לשמור את טיוטת האמן');
        this.error = message;
        window.alert(message);
      }
    });
  }

  private closeImmediately(): void {
    this.closeWithoutDraftSave = true;
    this.close.emit();
  }
}
