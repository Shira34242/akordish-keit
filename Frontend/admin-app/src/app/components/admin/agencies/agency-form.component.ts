import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import {
  AgencyContactMode,
  AgencyContentDto,
  AgencyDto,
  AgencyGalleryImageDto,
  AgencyProfileDto,
  AgencySocialLinkDto,
  CreateAgencyDto,
  UpsertAgencyContentDto,
  UpsertAgencyProfileDto
} from '../../../models/agency.model';
import { AgencyService } from '../../../services/agency.service';
import { SiteAlertService } from '../../../services/site-alert.service';
import { FileUploadInputComponent } from '../../shared/file-upload-input/file-upload-input.component';
import { SocialPlatform } from '../../../models/artist.model';
import { environment } from '../../../../environments/environment';
import { SocialIconsService } from '../../../services/social-icons.service';
import { SafeHtml } from '@angular/platform-browser';

interface SearchResult {
  id: number;
  name: string;
  imageUrl?: string;
  typeLabel?: string;
}

@Component({
  selector: 'app-agency-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './agency-form.component.html',
  styleUrls: ['./agency-form.component.css']
})
export class AgencyFormComponent implements OnInit {
  private readonly agencyService = inject(AgencyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(SiteAlertService);
  private readonly http = inject(HttpClient);
  private readonly socialIcons = inject(SocialIconsService);

  agencyId: number | null = null;
  agency: AgencyDto | null = null;
  loading = false;
  saving = false;
  error: string | null = null;
  AgencyContactMode = AgencyContactMode;
  SocialPlatform = SocialPlatform;

  form: CreateAgencyDto = {
    name: '',
    slug: '',
    logoUrl: '',
    bannerImageUrl: '',
    bannerBlur: 0,
    shortDescription: '',
    fullDescription: '',
    phoneNumber: '',
    whatsAppNumber: '',
    email: '',
    websiteUrl: '',
    brandPrimaryColor: '#ddff53',
    brandSecondaryColor: '#000000',
    brandTextColor: '#000000',
    isActive: true,
    showInIndexBanner: false,
    displayOrder: 0
  };

  profileForm: UpsertAgencyProfileDto = {
    profileType: 'artist',
    profileId: 0,
    contactMode: AgencyContactMode.Agency,
    showBadge: true,
    isFeaturedByAgency: false,
    displayOrder: 0
  };

  contentForm: UpsertAgencyContentDto = {
    contentType: 'article',
    contentId: 0,
    isFeatured: false,
    displayOrder: 0
  };

  galleryForm = { imageUrl: '', caption: '', displayOrder: 0 };
  galleryVideoForm = { videoUrl: '', title: '', displayOrder: 0 };
  galleryVideoUrlError = '';
  socialLinkForm: AgencySocialLinkDto = { id: 0, agencyId: 0, platform: SocialPlatform.Facebook, url: '' };
  socialPlatformOptions = [
    { value: SocialPlatform.Facebook, label: 'Facebook' },
    { value: SocialPlatform.Instagram, label: 'Instagram' },
    { value: SocialPlatform.YouTube, label: 'YouTube' },
    { value: SocialPlatform.Twitter, label: 'Twitter' },
    { value: SocialPlatform.TikTok, label: 'TikTok' },
    { value: SocialPlatform.Spotify, label: 'Spotify' },
    { value: SocialPlatform.Website, label: 'אתר' }
  ];

  // Search
  profileSearch = '';
  profileSearchResults: SearchResult[] = [];
  profileSearchOpen = false;
  profileSort: 'name' | 'id' = 'name';
  contentSearch = '';
  contentSearchResults: SearchResult[] = [];
  contentSearchOpen = false;
  private profileSearchSubject = new Subject<string>();
  private contentSearchSubject = new Subject<string>();

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.agencyId = id;
      this.loadAgency();
    }

    this.profileSearchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(q => {
      const query = q.trim();
      if (query.length === 0 || query.length >= 2) this.searchProfiles(query);
    });
    this.contentSearchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(q => {
      if (q.length >= 2) this.searchContent(q);
    });
  }

  setProfileType(type: 'artist' | 'serviceProvider' | 'teacher'): void {
    this.profileForm.profileType = type;
    this.profileForm.profileId = 0;
    this.profileSearch = '';
    this.profileSearchResults = [];
    this.profileSearchOpen = false;
    this.searchProfiles('');
  }

  loadAgency(): void {
    if (!this.agencyId) return;
    this.loading = true;
    this.agencyService.getAgency(this.agencyId).subscribe({
      next: agency => {
        this.agency = agency;
        this.form = {
          name: agency.name,
          slug: agency.slug,
          logoUrl: agency.logoUrl || '',
          bannerImageUrl: agency.bannerImageUrl || '',
          bannerBlur: this.normalizedBannerBlur(agency.bannerBlur),
          shortDescription: agency.shortDescription || '',
          fullDescription: agency.fullDescription || '',
          phoneNumber: agency.phoneNumber || '',
          whatsAppNumber: agency.whatsAppNumber || '',
          email: agency.email || '',
          websiteUrl: agency.websiteUrl || '',
          brandPrimaryColor: agency.brandPrimaryColor || '#ddff53',
          brandSecondaryColor: agency.brandSecondaryColor || '#000000',
          brandTextColor: agency.brandTextColor || '#000000',
          isActive: agency.isActive,
          showInIndexBanner: agency.showInIndexBanner,
          displayOrder: agency.displayOrder
        };
        this.loading = false;
        this.searchProfiles('');
      },
      error: (err) => {
        const detail = err?.error?.detail || '';
        const type = err?.error?.type || '';
        this.error = detail ? `${err?.error?.message || 'שגיאה'}: ${type} — ${detail}` : (err?.error?.message || err?.message || 'לא הצלחנו לטעון את הסוכנות');
        this.loading = false;
      }
    });
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.error = 'שם סוכנות הוא שדה חובה';
      return;
    }

    this.saving = true;
    this.error = null;
    const payload = this.cleanAgencyPayload();
    const request = this.agencyId
      ? this.agencyService.updateAgency(this.agencyId, payload)
      : this.agencyService.createAgency(payload);

    request.subscribe({
      next: agency => {
        this.saving = false;
        this.agency = agency;
        if (!this.agencyId) {
          this.router.navigate(['/admin/users/agencies/edit', agency.id]);
        }
      },
      error: err => {
        this.error = err?.error?.message || err?.message || 'לא הצלחנו לשמור את הסוכנות';
        this.saving = false;
      }
    });
  }

  private cleanAgencyPayload(): CreateAgencyDto {
    const clean = (value?: string) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    };

    const color = (value?: string, fallback?: string) => {
      const trimmed = value?.trim();
      return /^#[0-9a-fA-F]{6}$/.test(trimmed || '') ? trimmed : fallback;
    };

    return {
      name: this.form.name.trim(),
      slug: clean(this.form.slug),
      logoUrl: clean(this.form.logoUrl),
      bannerImageUrl: clean(this.form.bannerImageUrl),
      bannerBlur: this.normalizedBannerBlur(this.form.bannerBlur),
      shortDescription: clean(this.form.shortDescription),
      fullDescription: clean(this.form.fullDescription),
      phoneNumber: clean(this.form.phoneNumber),
      whatsAppNumber: clean(this.form.whatsAppNumber),
      email: clean(this.form.email),
      websiteUrl: clean(this.form.websiteUrl),
      brandPrimaryColor: color(this.form.brandPrimaryColor, '#ddff53'),
      brandSecondaryColor: color(this.form.brandSecondaryColor, '#000000'),
      brandTextColor: color(this.form.brandTextColor, '#000000'),
      isActive: this.form.isActive,
      showInIndexBanner: this.form.showInIndexBanner,
      displayOrder: Number(this.form.displayOrder) || 0
    };
  }

  normalizedBannerBlur(value: number | undefined): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(20, Math.round(numeric)));
  }

  // ============================================================
  // Profile search
  // ============================================================

  onProfileSearchChange(q: string): void {
    this.profileSearchSubject.next(q);
  }

  selectProfile(result: SearchResult): void {
    this.profileForm.profileId = result.id;
    this.profileSearch = result.name;
    this.profileSearchOpen = false;
  }

  clearProfileSelection(): void {
    this.profileForm.profileId = 0;
    this.profileSearch = '';
  }

  private searchProfiles(q: string): void {
    let endpoint: Observable<any>;
    switch (this.profileForm.profileType) {
      case 'artist': endpoint = this.searchArtists(q); break;
      case 'teacher': endpoint = this.searchTeachers(q); break;
      default: endpoint = this.searchProviders(q); break;
    }
    endpoint.subscribe({
      next: (data: any) => {
        this.profileSearchResults = (data?.items || data || []).map((item: any) => ({
          id: item.id,
          name: item.name || item.displayName || '',
          imageUrl: item.imageUrl || item.profileImageUrl || '',
          typeLabel: this.getProfileFormTypeLabel()
        })).filter((r: SearchResult) => r.name);
        this.profileSearchOpen = false;
      },
      error: () => this.profileSearchResults = []
    });
  }

  private searchArtists(q: string): Observable<any> {
    const params: Record<string, string | number> = { pageSize: 30 };
    if (q) params['search'] = q;
    return this.http.get(`${environment.apiBaseUrl}/api/Artists`, { params });
  }

  private searchProviders(q: string): Observable<any> {
    const params: Record<string, string | number> = { pageSize: 30 };
    if (q) params['search'] = q;
    return this.http.get(`${environment.apiBaseUrl}/api/MusicServiceProviders`, { params });
  }

  private searchTeachers(q: string): Observable<any> {
    const params: Record<string, string | number> = { pageSize: 30 };
    if (q) params['search'] = q;
    return this.http.get(`${environment.apiBaseUrl}/api/Teachers`, { params });
  }

  // ============================================================
  // Content search
  // ============================================================

  onContentSearchChange(q: string): void {
    this.contentSearchSubject.next(q);
  }

  selectContent(result: SearchResult): void {
    this.contentForm.contentId = result.id;
    this.contentSearch = result.name;
    this.contentSearchOpen = false;
  }

  private searchContent(q: string): void {
    const endpoint = this.getContentSearchEndpoint(q);
    endpoint.subscribe({
      next: (data: any) => {
        this.contentSearchResults = (data?.items || data || []).map((item: any) => ({
          id: item.id,
          name: item.title || item.name || ''
        })).filter((r: SearchResult) => r.name);
        this.contentSearchOpen = this.contentSearchResults.length > 0;
      },
      error: () => this.contentSearchResults = []
    });
  }

  private getContentSearchEndpoint(q: string): Observable<any> {
    switch (this.contentForm.contentType) {
      case 'article':
        return this.http.get(`${environment.apiBaseUrl}/api/Articles`, { params: { search: q, pageSize: 10 } });
      case 'podcast':
        return this.http.get(`${environment.apiBaseUrl}/api/Podcasts`, { params: { search: q, pageSize: 10 } });
      default:
        return this.http.get(`${environment.apiBaseUrl}/api/Songs`, { params: { search: q, pageSize: 10 } });
    }
  }

  // ============================================================
  // Profiles
  // ============================================================

  addProfile(): void {
    if (!this.agencyId || !this.profileForm.profileId) return;
    this.agencyService.addProfile(this.agencyId, this.profileForm).subscribe({
      next: () => {
        this.profileForm.profileId = 0;
        this.profileSearch = '';
        this.loadAgency();
      },
      error: err => alert(err?.error?.message || 'לא הצלחנו לשייך את הפרופיל')
    });
  }

  async removeProfile(profile: AgencyProfileDto): Promise<void> {
    if (!this.agencyId || !await this.alerts.confirm('להסיר את הפרופיל מהסוכנות?')) return;
    this.agencyService.removeProfile(this.agencyId, profile.id).subscribe({
      next: () => this.loadAgency(),
      error: () => alert('לא הצלחנו להסיר את הפרופיל')
    });
  }

  getContactModeLabel(mode: AgencyContactMode): string {
    if (mode === AgencyContactMode.Agency) return 'דרך הסוכנות';
    if (mode === AgencyContactMode.Both) return 'גם וגם';
    return 'ישיר';
  }

  getProfileFormTypeLabel(): string {
    if (this.profileForm.profileType === 'artist') return 'אמן';
    if (this.profileForm.profileType === 'teacher') return 'מורה';
    return 'נותן שירות';
  }

  getProfileTypeLabel(profile: AgencyProfileDto): string {
    if (profile.isTeacher) return 'מורה';
    if (profile.profileType === 'artist') return 'אמן';
    return 'נותן שירות';
  }

  getSelectedProfileSearchResult(): SearchResult | null {
    if (!this.profileForm.profileId) return null;
    return this.profileSearchResults.find(r => r.id === this.profileForm.profileId) || {
      id: this.profileForm.profileId,
      name: this.profileSearch,
      typeLabel: this.getProfileFormTypeLabel()
    };
  }

  getSortedProfileSearchResults(): SearchResult[] {
    const items = [...this.profileSearchResults];
    return items.sort((a, b) => {
      if (this.profileSort === 'id') return a.id - b.id;
      return a.name.localeCompare(b.name, 'he');
    });
  }

  isProfileCandidateLinked(result: SearchResult): boolean {
    if (!this.agency) return false;
    const normalizedType = this.profileForm.profileType === 'teacher' ? 'serviceProvider' : this.profileForm.profileType;
    return this.agency.profiles.some(profile =>
      profile.profileId === result.id &&
      profile.profileType === normalizedType &&
      (this.profileForm.profileType !== 'teacher' || profile.isTeacher)
    );
  }

  updateProfileContactMode(profile: AgencyProfileDto, contactMode: AgencyContactMode): void {
    if (!this.agencyId) return;
    const profileType = profile.isTeacher ? 'teacher' : profile.profileType;
    this.agencyService.addProfile(this.agencyId, {
      profileType,
      profileId: profile.profileId,
      contactMode,
      showBadge: profile.showBadge,
      isFeaturedByAgency: profile.isFeaturedByAgency,
      displayOrder: profile.displayOrder
    }).subscribe({
      next: () => this.loadAgency(),
      error: err => alert(err?.error?.message || 'לא הצלחנו לעדכן את יצירת הקשר')
    });
  }

  // ============================================================
  // Content
  // ============================================================

  addContent(): void {
    if (!this.agencyId || !this.contentForm.contentId) return;
    this.agencyService.addContent(this.agencyId, this.contentForm).subscribe({
      next: () => {
        this.contentForm.contentId = 0;
        this.contentSearch = '';
        this.loadAgency();
      },
      error: err => alert(err?.error?.message || 'לא הצלחנו לשייך את התוכן')
    });
  }

  async removeContent(content: AgencyContentDto): Promise<void> {
    if (!this.agencyId || !await this.alerts.confirm('להסיר את התוכן מהסוכנות?')) return;
    this.agencyService.removeContent(this.agencyId, content.id).subscribe({
      next: () => this.loadAgency(),
      error: () => alert('לא הצלחנו להסיר את התוכן')
    });
  }

  getContentTypeLabel(contentType: AgencyContentDto['contentType']): string {
    if (contentType === 'article') return 'כתבה';
    if (contentType === 'podcast') return 'פודקאסט';
    return 'שיר';
  }

  // ============================================================
  // Gallery
  // ============================================================

  addGalleryImage(): void {
    if (!this.agencyId || !this.galleryForm.imageUrl) return;
    this.agencyService.addGalleryImage(this.agencyId, {
      mediaType: 'image',
      imageUrl: this.galleryForm.imageUrl.trim(),
      caption: this.galleryForm.caption?.trim() || undefined,
      displayOrder: this.galleryForm.displayOrder || 0
    }).subscribe({
      next: () => {
        this.galleryForm = { imageUrl: '', caption: '', displayOrder: 0 };
        this.loadAgency();
      },
      error: err => alert(err?.error?.message || 'לא הצלחנו להוסיף תמונה')
    });
  }

  addGalleryVideo(): void {
    if (!this.agencyId || !this.galleryVideoForm.videoUrl) return;
    const videoUrl = this.galleryVideoForm.videoUrl.trim();

    if (!/(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(videoUrl)) {
      this.galleryVideoUrlError = 'קישורי יוטיוב בלבד';
      return;
    }
    this.galleryVideoUrlError = '';

    const title = this.galleryVideoForm.title?.trim() || 'וידאו';
    this.agencyService.addGalleryImage(this.agencyId, {
      mediaType: 'video',
      videoUrl,
      title,
      imageUrl: videoUrl,
      caption: `[VIDEO]${title}`,
      displayOrder: this.galleryVideoForm.displayOrder || 0
    }).subscribe({
      next: () => {
    this.galleryVideoForm = { videoUrl: '', title: '', displayOrder: 0 };
    this.galleryVideoUrlError = '';
    this.loadAgency();
      },
      error: err => alert(err?.error?.message || 'לא הצלחנו להוסיף וידאו')
    });
  }

  isVideoItem(img: AgencyGalleryImageDto): boolean {
    return img.mediaType === 'video' || (img.caption || '').startsWith('[VIDEO]');
  }

  getGalleryItemLabel(img: AgencyGalleryImageDto): string {
    if (this.isVideoItem(img)) {
      if (img.title) return img.title;
      return (img.caption || 'וידאו').replace('[VIDEO]', '');
    }
    return img.caption || 'תמונה #' + img.id;
  }

  getGalleryItemUrl(img: AgencyGalleryImageDto): string {
    return img.videoUrl || img.imageUrl || '';
  }

  async removeGalleryImage(image: AgencyGalleryImageDto): Promise<void> {
    if (!this.agencyId || !await this.alerts.confirm('להסיר את התמונה?')) return;
    this.agencyService.removeGalleryImage(this.agencyId, image.id).subscribe({
      next: () => this.loadAgency(),
      error: () => alert('לא הצלחנו להסיר את התמונה')
    });
  }

  // ============================================================
  // Social Links
  // ============================================================

  upsertSocialLink(): void {
    if (!this.agencyId || !this.socialLinkForm.url) return;
    this.agencyService.upsertSocialLink(this.agencyId, this.socialLinkForm).subscribe({
      next: () => {
        this.socialLinkForm = { id: 0, agencyId: 0, platform: SocialPlatform.Facebook, url: '' };
        this.loadAgency();
      },
      error: err => alert(err?.error?.message || 'לא הצלחנו לשמור קישור')
    });
  }

  async removeSocialLink(link: AgencySocialLinkDto): Promise<void> {
    if (!this.agencyId || !await this.alerts.confirm('להסיר את הקישור?')) return;
    this.agencyService.removeSocialLink(this.agencyId, link.id).subscribe({
      next: () => this.loadAgency(),
      error: () => alert('לא הצלחנו להסיר את הקישור')
    });
  }

  getSocialLinkUrl(platform: SocialPlatform): string {
    const links = this.agency?.socialLinks || [];
    return links.find(l => l.platform === platform)?.url || '';
  }

  setSocialLinkUrl(platform: SocialPlatform, url: string): void {
    if (!this.agencyId) return;
    const trimmed = url.trim();
    const links = this.agency?.socialLinks || [];
    const existing = links.find(l => l.platform === platform);

    if (!trimmed) {
      if (existing) this.removeSocialLink(existing);
      return;
    }

    if (existing) {
      this.agencyService.upsertSocialLink(this.agencyId, { ...existing, url: trimmed }).subscribe({
        next: () => this.loadAgency(),
        error: err => alert(err?.error?.message || 'לא הצלחנו לעדכן קישור')
      });
    } else {
      this.agencyService.upsertSocialLink(this.agencyId, {
        id: 0, agencyId: this.agencyId, platform, url: trimmed
      }).subscribe({
        next: () => this.loadAgency(),
        error: err => alert(err?.error?.message || 'לא הצלחנו לשמור קישור')
      });
    }
  }

  getSocialIconSvg(platform: SocialPlatform): SafeHtml {
    return this.socialIcons.getIconSvg(platform);
  }

  getPlatformLabel(platform: SocialPlatform): string {
    const opt = this.socialPlatformOptions.find(o => o.value === platform);
    return opt?.label || String(platform);
  }

  back(): void {
    this.router.navigate(['/admin/users/agencies']);
  }
}
