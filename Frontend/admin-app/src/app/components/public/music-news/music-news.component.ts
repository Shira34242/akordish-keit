import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { CarouselComponent } from '../../shared/carousel/carousel.component';
import { FeaturedContentService } from '../../../services/admin/featured-content.service';
import { EventService } from '../../../services/admin/event.service';
import { NewsPageSectionService } from '../../../services/news-page-section.service';
import { FeaturedContent } from '../../../models/featured-content.model';
import { Article } from '../../../models/article.model';
import { NewsPageSection } from '../../../models/news-page-section.model';
import { UpcomingEventDto } from '../../../models/event.model';

@Component({
  selector: 'app-music-news',
  standalone: true,
  imports: [CommonModule, RouterModule, NewsBannerComponent, CarouselComponent],
  templateUrl: './music-news.component.html',
  styleUrl: './music-news.component.css'
})
export class MusicNewsComponent implements OnInit, OnDestroy {
  @ViewChild('pageHero', { static: false }) pageHeroRef!: ElementRef;

  private readonly featuredContentService = inject(FeaturedContentService);
  private readonly eventService = inject(EventService);
  private readonly newsPageSectionService = inject(NewsPageSectionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // שורה ראשונה - 4 כתבות מרכזיות
  featuredArticles: FeaturedContent[] = [];

  // פסים דינמיים מה-API
  sections: NewsPageSection[] = [];

  // הופעות קרובות
  upcomingEvents: UpcomingEventDto[] = [];

  isLoading = true;

  // ───── הרחבת קטגוריות ─────
  expandedSections = new Set<number>();

  toggleSection(index: number): void {
    if (this.expandedSections.has(index)) {
      this.expandedSections.delete(index);
    } else {
      this.expandedSections.add(index);
    }
  }

  isExpanded(index: number): boolean {
    return this.expandedSections.has(index);
  }

  // ───── layout per section ─────
  // a: 3 כתבות | b: 5 כתבות | c: 4 כתבות | d: 4 כתבות
  getSectionLayout(index: number): string {
    return ['a', 'b', 'c', 'd'][index % 4];
  }

  getInitialArticleCount(index: number): number {
    return [3, 5, 4, 4][index % 4];
  }

  private fullHeroHeight = 0;
  private scrollListener?: () => void;

  ngOnInit(): void {
    this.loadAllContent();
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }

  private initHero(): void {
    const hero = this.pageHeroRef?.nativeElement as HTMLElement | null;
    if (!hero) return;
    this.fullHeroHeight = Math.round(window.innerHeight * 0.48);
    hero.style.height = this.fullHeroHeight + 'px';
    this.scrollListener = () => this.shrinkHero();
    window.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  private shrinkHero(): void {
    const hero = this.pageHeroRef?.nativeElement as HTMLElement | null;
    if (!hero) return;

    const minHeight = Math.round(window.innerHeight * 0.02 + 60);
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    hero.style.height = newHeight + 'px';

    const progress = Math.min(1, window.scrollY / 160);
    const inner = hero.querySelector('.hero-inner') as HTMLElement | null;
    if (inner) inner.style.opacity = String(1 - progress);

    const overlay = hero.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (overlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      overlay.style.opacity = String(collapseProgress);
    }
  }

  private loadAllContent(): void {
    this.isLoading = true;

    Promise.all([
      this.loadFeaturedContent(),
      this.loadSections(),
      this.loadUpcomingEvents()
    ]).then(() => {
      this.isLoading = false;
      setTimeout(() => this.initHero(), 0);
    }).catch(error => {
      console.error('Error loading content:', error);
      this.isLoading = false;
    });
  }

  private loadFeaturedContent(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.featuredContentService.getActiveFeaturedContent()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (content) => {
            this.featuredArticles = content.sort((a, b) => a.displayOrder - b.displayOrder);
            resolve();
          },
          error: (error) => {
            console.error('Error loading featured content:', error);
            reject(error);
          }
        });
    });
  }

  /**
   * טוען את הפסים הדינמיים מה-API — כולל הכתבות של כל פס
   */
  private loadSections(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.newsPageSectionService.getActiveSections()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (sections) => {
            this.sections = sections;
            resolve();
          },
          error: (error) => {
            console.error('Error loading news page sections:', error);
            reject(error);
          }
        });
    });
  }

  private loadUpcomingEvents(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventService.getUpcomingEvents(10)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (events) => {
            this.upcomingEvents = this.sortEventsByPriority(events);
            resolve();
          },
          error: (error) => {
            console.error('Error loading upcoming events:', error);
            reject(error);
          }
        });
    });
  }

  private sortEventsByPriority(events: UpcomingEventDto[]): UpcomingEventDto[] {
    return events.sort((a, b) => {
      const priorityA = this.getEventPriority(a);
      const priorityB = this.getEventPriority(b);
      if (priorityA === priorityB) {
        return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      }
      return priorityA - priorityB;
    });
  }

  private getEventPriority(event: UpcomingEventDto): number {
    if (event.eventStatus === 'היום') return 1;
    if (event.eventStatus === 'אירוע שחלף') return 3;
    return 2;
  }

  navigateToArticle(article: Article): void {
    const route = article.contentType === 0 ? '/news' : '/blog';
    this.router.navigate([route, article.slug]);
  }

  navigateToFeaturedArticle(featured: FeaturedContent): void {
    this.navigateToArticle(featured.article);
  }

  openTicketLink(event: UpcomingEventDto): void {
    window.open(event.ticketUrl, '_blank');
  }

  /**
   * ניווט ל"כל הכתבות" של פס — לפי קטגוריה או סוג תוכן
   */
  navigateToSection(section: NewsPageSection): void {
    if (section.sectionType === 0 && section.categoryId !== undefined) {
      this.router.navigate(['/articles'], { queryParams: { category: section.categoryId } });
    } else if (section.sectionType === 1 && section.contentTypeId !== undefined) {
      this.router.navigate(['/articles'], { queryParams: { contentType: section.contentTypeId } });
    }
  }
}
