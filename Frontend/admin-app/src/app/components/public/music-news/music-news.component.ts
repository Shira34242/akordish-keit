import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FeaturedContentService } from '../../../services/admin/featured-content.service';
import { ArticleService } from '../../../services/admin/article.service';
import { EventService } from '../../../services/admin/event.service';
import { FeaturedContent } from '../../../models/featured-content.model';
import { Article, ArticleCategory, ArticleContentType, ArticleStatus } from '../../../models/article.model';
import { UpcomingEventDto } from '../../../models/event.model';

@Component({
  selector: 'app-music-news',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './music-news.component.html',
  styleUrl: './music-news.component.css'
})
export class MusicNewsComponent implements OnInit {
  private readonly featuredContentService = inject(FeaturedContentService);
  private readonly articleService = inject(ArticleService);
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // שורה ראשונה - 4 כתבות מרכזיות
  featuredArticles: FeaturedContent[] = [];

  // פופולאריים - קטגוריה 10
  popularArticles: Article[] = [];

  // קליפים - קטגוריה 11
  clipsArticles: Article[] = [];

  // תוכן - בלוגים
  blogArticles: Article[] = [];

  // הופעות קרובות
  upcomingEvents: UpcomingEventDto[] = [];

  isLoading = true;

  ngOnInit(): void {
    this.loadAllContent();
  }

  private loadAllContent(): void {
    this.isLoading = true;

    // טען את כל התוכן במקביל
    Promise.all([
      this.loadFeaturedContent(),
      this.loadPopularArticles(),
      this.loadClips(),
      this.loadBlogContent(),
      this.loadUpcomingEvents()
    ]).then(() => {
      this.isLoading = false;
    }).catch(error => {
      console.error('Error loading content:', error);
      this.isLoading = false;
    });
  }

  /**
   * טען 4 כתבות מרכזיות
   */
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
   * טען כתבות פופולאריות - קטגוריה Popular - 10 באנרים
   */
  private loadPopularArticles(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.articleService.getArticles(
        1, // page
        10, // page size - 10 באנרים
        undefined, // search
        ArticleCategory.Popular, // categoryId: פופולאריים
        undefined, // contentType
        ArticleStatus.Published, // status: Published
        undefined, // isFeatured
        undefined, // isPremium
        undefined  // authorName
      ).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => {
            // מיין לפי תאריך פרסום (החדשים ראשון)
            this.popularArticles = result.items.sort((a, b) =>
              new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
            );
            resolve();
          },
          error: (error) => {
            console.error('Error loading popular articles:', error);
            reject(error);
          }
        });
    });
  }

  /**
   * טען קליפים - קטגוריה Clips - 10 באנרים
   */
  private loadClips(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.articleService.getArticles(
        1, // page
        10, // page size - 10 באנרים
        undefined, // search
        ArticleCategory.Clips, // categoryId: קליפים
        undefined, // contentType
        ArticleStatus.Published, // status: Published
        undefined, // isFeatured
        undefined, // isPremium
        undefined  // authorName
      ).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => {
            // מיין לפי תאריך פרסום (החדשים ראשון)
            this.clipsArticles = result.items.sort((a, b) =>
              new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
            );
            resolve();
          },
          error: (error) => {
            console.error('Error loading clips:', error);
            reject(error);
          }
        });
    });
  }

  /**
   * טען תוכן (בלוגים) - ContentType = Blog - 10 באנרים
   */
  private loadBlogContent(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.articleService.getArticles(
        1, // page
        10, // page size - 10 באנרים עם גלילה
        undefined, // search
        undefined, // categoryId
        ArticleContentType.Blog, // contentType: Blog
        ArticleStatus.Published, // status: Published
        undefined, // isFeatured
        undefined, // isPremium
        undefined  // authorName
      ).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => {
            this.blogArticles = result.items;
            resolve();
          },
          error: (error) => {
            console.error('Error loading blog content:', error);
            reject(error);
          }
        });
    });
  }

  /**
   * טען הופעות קרובות - 10 באנרים
   */
  private loadUpcomingEvents(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventService.getUpcomingEvents(10)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (events) => {
            // מיין את ההופעות: ראשון היום, אחר כך קרובות, בסוף שחלפו
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

  /**
   * מיין הופעות לפי עדיפות: היום -> קרובות -> שחלפו
   */
  private sortEventsByPriority(events: UpcomingEventDto[]): UpcomingEventDto[] {
    return events.sort((a, b) => {
      const priorityA = this.getEventPriority(a);
      const priorityB = this.getEventPriority(b);

      // אם יש אותה עדיפות, מיין לפי תאריך
      if (priorityA === priorityB) {
        return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      }

      return priorityA - priorityB;
    });
  }

  /**
   * החזר מספר עדיפות להופעה: 1=היום, 2=קרובות, 3=שחלפו
   */
  private getEventPriority(event: UpcomingEventDto): number {
    if (event.eventStatus === 'היום') {
      return 1;
    } else if (event.eventStatus === 'אירוע שחלף') {
      return 3;
    } else {
      return 2; // קרובות (מחר, בעוד X ימים)
    }
  }

  /**
   * ניווט לכתבה
   */
  navigateToArticle(article: Article): void {
    const route = article.contentType === 0 ? '/news' : '/blog';
    this.router.navigate([route, article.slug]);
  }

  /**
   * ניווט לכתבה מתוך FeaturedContent
   */
  navigateToFeaturedArticle(featured: FeaturedContent): void {
    this.navigateToArticle(featured.article);
  }

  /**
   * פתח קישור לרכישת כרטיסים להופעה
   */
  openTicketLink(event: UpcomingEventDto): void {
    window.open(event.ticketUrl, '_blank');
  }

  /**
   * ניווט לדף כתבות מסוננות לפי קטגוריה
   */
  navigateToCategory(categoryId: ArticleCategory): void {
    this.router.navigate(['/articles'], {
      queryParams: { category: categoryId }
    });
  }

  /**
   * ניווט לדף כתבות מסוננות לפי סוג תוכן
   */
  navigateToContentType(contentType: ArticleContentType): void {
    this.router.navigate(['/articles'], {
      queryParams: { contentType: contentType }
    });
  }
}
