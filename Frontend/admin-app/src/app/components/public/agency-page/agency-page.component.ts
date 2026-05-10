import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AgencyProfileCardDto, AgencyPublicDto } from '../../../models/agency.model';
import { Article } from '../../../models/article.model';
import { SongDto } from '../../../models/song.model';
import { AgencyService } from '../../../services/agency.service';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { AnalyticsService } from '../../../services/analytics.service';

@Component({
  selector: 'app-agency-page',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './agency-page.component.html',
  styleUrls: ['./agency-page.component.css']
})
export class AgencyPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agencyService = inject(AgencyService);
  private readonly analytics = inject(AnalyticsService);

  agency: AgencyPublicDto | null = null;
  loading = true;
  error: string | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) this.loadAgency(slug);
    });
  }

  loadAgency(slug: string): void {
    this.loading = true;
    this.error = null;
    this.agencyService.getAgencyBySlug(slug).subscribe({
      next: agency => {
        this.agency = agency;
        this.analytics.trackInteraction('agency_view', agency.id, agency.name);
        this.loading = false;
      },
      error: () => {
        this.error = 'לא מצאנו את דף הסוכנות';
        this.loading = false;
      }
    });
  }

  get heroImage(): string {
    return this.agency?.bannerImageUrl || this.agency?.logoUrl || '/collection-guitars-guitars-are-display-room.png';
  }

  get allProfiles(): AgencyProfileCardDto[] {
    if (!this.agency) return [];
    return [...this.agency.artists, ...this.agency.teachers, ...this.agency.serviceProviders];
  }

  get directContentCount(): number {
    if (!this.agency) return 0;
    return this.agency.directArticles.length + this.agency.directSongs.length;
  }

  get memberContentCount(): number {
    if (!this.agency) return 0;
    return this.agency.memberArticles.length + this.agency.memberSongs.length;
  }

  get agencyThemeVars(): Record<string, string> {
    const primary = this.agency?.brandPrimaryColor || '#ddff53';
    const secondary = this.agency?.brandSecondaryColor || '#000000';
    const text = this.agency?.brandTextColor || '#000000';
    return {
      '--agency-primary': primary,
      '--agency-secondary': secondary,
      '--agency-text': text
    };
  }

  goToProfile(profile: AgencyProfileCardDto): void {
    if (this.agency) {
      this.analytics.trackInteraction('agency_profile_click', this.agency.id, `${this.agency.name} | ${profile.profileType} | ${profile.name}`);
    }
    this.router.navigateByUrl(profile.profileUrl);
  }

  goToArticle(article: Article): void {
    if (this.agency) {
      this.analytics.trackInteraction('agency_content_click', this.agency.id, `${this.agency.name} | article | ${article.title}`);
    }
    this.router.navigate(['/news', article.slug]);
  }

  goToSong(song: SongDto): void {
    if (this.agency) {
      this.analytics.trackInteraction('agency_content_click', this.agency.id, `${this.agency.name} | song | ${song.title}`);
    }
    this.router.navigate(['/song', song.id]);
  }

  trackContact(type: 'phone' | 'whatsapp' | 'email' | 'website'): void {
    if (!this.agency) return;
    this.analytics.trackInteraction(`agency_contact_${type}`, this.agency.id, this.agency.name);
  }

  getWhatsAppUrl(phoneNumber: string): string {
    let digits = phoneNumber.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `972${digits.slice(1)}`;
    return `https://wa.me/${digits}?text=${encodeURIComponent('היי, הגעתי דרך אקורדישקייט')}`;
  }
}
