import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnDestroy, OnChanges, HostListener, ViewChild, ElementRef } from '@angular/core';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { MusicServiceProviderDto } from '../../../models/music-service-provider.model';
import { CitiesService, City } from '../../../services/cities.service';

@Component({
  selector: 'app-professional-profile-modal',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './professional-profile-modal.component.html',
  styleUrls: ['./professional-profile-modal.component.css']
})
export class ProfessionalProfileModalComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {

  @Input() professionalId: number | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('professionalHeroBg') professionalHeroBg?: ElementRef<HTMLDivElement>;

  professional: MusicServiceProviderDto | null = null;
  loading = false;
  error: string | null = null;
  cities: City[] = [];
  showContact = false;

  private fullHeroHeight = 0;
  private rafPending = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private professionalService: MusicServiceProviderService,
    private citiesService: CitiesService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) this.loadProfessional(id);
    });
    this.citiesService.getCities().subscribe({
      next: cities => this.cities = cities,
      error: () => {}
    });
  }

  ngOnChanges(): void {
    if (this.professionalId) this.loadProfessional(this.professionalId);
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}

  loadProfessional(id?: number): void {
    const professionalId = id ?? +this.route.snapshot.params['id'];
    if (!professionalId) return;

    this.loading = true;
    this.error = null;

    this.professionalService.getServiceProviderById(professionalId).subscribe({
      next: (professional) => {
        this.professional = professional;
        this.loading = false;
        setTimeout(() => this.initHeroHeight(), 0);
      },
      error: () => {
        this.error = 'שגיאה בטעינת פרטי בעל המקצוע';
        this.loading = false;
      }
    });
  }

  private initHeroHeight(): void {
    const bg = this.professionalHeroBg?.nativeElement;
    if (!bg) return;
    this.fullHeroHeight = Math.round(window.innerHeight * 0.25 - 8);
    bg.style.height = this.fullHeroHeight + 'px';
    this.shrinkHero();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.shrinkHero();
      this.rafPending = false;
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.initHeroHeight();
  }

  private shrinkHero(): void {
    const bg = this.professionalHeroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    const minHeight = 8 + 55;
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = newHeight + 'px';

    const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (collapseOverlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      collapseOverlay.style.opacity = String(collapseProgress);
    }
  }

  toggleContact(): void {
    this.showContact = !this.showContact;
  }

  goBack(): void {
    this.router.navigate(['/professionals']);
  }

  getCityName(cityId: number | null | undefined): string {
    if (!cityId) return '';
    return this.cities.find(c => c.id === cityId)?.name || '';
  }

  getCategoriesDisplay(): string {
    if (!this.professional?.categories?.length) return '';
    return this.professional.categories.map(c => c.categoryName).join(', ');
  }

  getSafeVideoUrl(url: string): SafeResourceUrl {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  openWhatsApp(): void {
    if (this.professional?.whatsAppNumber) {
      window.open(`https://wa.me/${this.professional.whatsAppNumber.replace(/\D/g, '')}`, '_blank');
    }
  }

  callPhone(): void {
    if (this.professional?.phoneNumber) {
      window.location.href = `tel:${this.professional.phoneNumber}`;
    }
  }

  sendEmail(): void {
    if (this.professional?.email) {
      window.location.href = `mailto:${this.professional.email}`;
    }
  }

  visitWebsite(): void {
    if (this.professional?.websiteUrl) {
      window.open(this.professional.websiteUrl, '_blank');
    }
  }
}
