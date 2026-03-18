import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TeacherService } from '../../../services/teacher.service';
import { TeacherDto } from '../../../models/teacher.model';
import { CitiesService, City } from '../../../services/cities.service';
import { TeachingLanguage } from '../../../models/teaching-language.enum';
import { TargetAudience } from '../../../models/target-audience.enum';
import { Article } from '../../../models/article.model';
import { SongCardComponent } from '../../shared/song-card/song-card.component';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';

@Component({
  selector: 'app-teacher-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, SongCardComponent, NewsBannerComponent],
  templateUrl: './teacher-detail.component.html',
  styleUrls: ['./teacher-detail.component.css']
})
export class TeacherDetailComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('teacherHeroBg') teacherHeroBg?: ElementRef<HTMLDivElement>;

  teacher: TeacherDto | null = null;
  cities: City[] = [];
  loading = true;
  showContact = false;

  // ⚠️ ממתין לחיבור בקאנד: אקורדים שהמורה העלה
  teacherSongs: any[] = [];

  // ⚠️ ממתין לחיבור בקאנד: כתבות שהמורה העלה
  teacherArticles: Article[] = [];

  // ⚠️ ממתין לחיבור בקאנד: המלצות תלמידים (דורש הוספת שדה testimonials למודל)
  teacherTestimonials: { text: string; studentName: string }[] = [];

  private fullHeroHeight = 0;
  private rafPending = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private teacherService: TeacherService,
    private citiesService: CitiesService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) this.loadTeacher(id);
    });
    this.citiesService.getCities().subscribe({
      next: cities => this.cities = cities,
      error: () => {}
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}

  loadTeacher(id: number): void {
    this.loading = true;
    this.teacherService.getTeacherById(id).subscribe({
      next: teacher => {
        this.teacher = teacher;
        this.loading = false;
        setTimeout(() => this.initHeroHeight(), 0);
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/teachers']);
      }
    });
  }

  private initHeroHeight(): void {
    const bg = this.teacherHeroBg?.nativeElement;
    if (!bg) return;
    if (this.heroBannerSrc) {
      bg.style.backgroundImage = `url('${this.heroBannerSrc}')`;
    }
    this.fullHeroHeight = Math.round(window.innerHeight - 16);
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
    const bg = this.teacherHeroBg?.nativeElement;
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

  get heroBannerSrc(): string {
    // placeholder — bannerImageUrl יתווסף לאחר אישור המתכנת
    return '';
  }

  getCityName(cityId?: number | null): string {
    if (!cityId) return '';
    return this.cities.find(c => c.id === cityId)?.name || '';
  }

  getLanguagesDisplay(languages?: TeachingLanguage): string {
    if (!languages) return '';
    const list: string[] = [];
    if (languages & TeachingLanguage.Hebrew) list.push('עברית');
    if (languages & TeachingLanguage.English) list.push('אנגלית');
    if (languages & TeachingLanguage.Russian) list.push('רוסית');
    if (languages & TeachingLanguage.French) list.push('צרפתית');
    if (languages & TeachingLanguage.Spanish) list.push('ספרדית');
    if (languages & TeachingLanguage.Arabic) list.push('ערבית');
    return list.join('، ');
  }

  getTargetAudienceList(audience?: TargetAudience): string[] {
    if (!audience) return [];
    const list: string[] = [];
    if (audience & TargetAudience.Children) list.push('ילדים');
    if (audience & TargetAudience.Teenagers) list.push('נוער');
    if (audience & TargetAudience.Adults) list.push('מבוגרים');
    if (audience & TargetAudience.Seniors) list.push('גיל הזהב');
    if (audience & TargetAudience.Beginners) list.push('מתחילים');
    if (audience & TargetAudience.Intermediate) list.push('בינוניים');
    if (audience & TargetAudience.Advanced) list.push('מתקדמים');
    if (audience & TargetAudience.Professional) list.push('מקצועיים');
    return list;
  }

  getSafeVideoUrl(url: string): SafeResourceUrl {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  toggleContact(): void {
    this.showContact = !this.showContact;
  }
}
