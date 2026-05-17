import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SeoService } from '../../../services/seo.service';
import { Article, ArticleContentType, ArticleStatus } from '../../../models/article.model';
import { ArticleService } from '../../../services/admin/article.service';
import { ModalService } from '../../../services/modal.service';
import { AutoScrollDirective } from '../../../directives/auto-scroll.directive';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';

@Component({
    selector: 'app-not-found-page',
    standalone: true,
    imports: [CommonModule, RouterModule, AutoScrollDirective, NewsBannerComponent],
    template: `
    <div class="not-found-page">
      <section class="not-found-hero" aria-labelledby="not-found-title">
        <p class="not-found-label">404</p>
        <h1 id="not-found-title" class="not-found-title">הדף לא נמצא</h1>
        <p class="not-found-message">
          אופס... אם הגעתם לפה כנראה שמשהו לא תקין. אפשר לחזור הביתה, ואם נראה לכם שזה באג נשמח שתדווחו לנו.
        </p>
        <div class="not-found-actions">
          <a class="not-found-home-link" routerLink="/">לדף הבית</a>
          <button class="not-found-report-link" type="button" (click)="openReportModal()">לדיווח על תקלה</button>
        </div>
      </section>

      <section class="not-found-section" *ngIf="recommendedArticles.length > 0">
        <div class="section-header">
          <h2 class="section-title">תוכן שיכול לעניין אותך</h2>
          <a routerLink="/articles" class="section-link">הצג הכל</a>
        </div>

        <div class="recommendation-stack">
          <div
            class="recommendation-row"
            *ngIf="recommendedFirstRow.length > 0"
            appAutoScroll
            [autoScrollSpeed]="40"
            autoScrollDirection="left"
            [autoScrollCopies]="3">
            <div class="recommendation-track">
              <ng-container *ngFor="let copy of scrollCopies">
                <app-news-banner
                  *ngFor="let article of recommendedFirstRow; trackBy: trackById"
                  class="recommendation-card"
                  [article]="article"
                  [showDescription]="false"
                  [attr.aria-hidden]="copy > 0 ? true : null">
                </app-news-banner>
              </ng-container>
            </div>
          </div>

          <div
            class="recommendation-row recommendation-row--bottom"
            *ngIf="recommendedSecondRow.length > 0"
            appAutoScroll
            [autoScrollSpeed]="40"
            autoScrollDirection="right"
            [autoScrollCopies]="3">
            <div class="recommendation-track">
              <ng-container *ngFor="let copy of scrollCopies">
                <app-news-banner
                  *ngFor="let article of recommendedSecondRow; trackBy: trackById"
                  class="recommendation-card"
                  [article]="article"
                  [showDescription]="false"
                  [attr.aria-hidden]="copy > 0 ? true : null">
                </app-news-banner>
              </ng-container>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
    styles: [`
    .not-found-page {
      direction: rtl;
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--space-4xl) var(--space-xl);
      display: flex;
      flex-direction: column;
      gap: var(--space-3xl);
      overflow-x: hidden;
    }

    .not-found-hero {
      background: #ddff53;
      border-radius: 28px;
      min-height: 42vh;
      padding: var(--space-3xl) var(--space-xl);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #000000;
    }

    .not-found-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 5.5rem;
      min-height: 3.5rem;
      padding: var(--space-xs) var(--space-lg);
      background: #000000;
      color: #ddff53;
      border-radius: 999px;
      font-family: 'Open Sans', sans-serif;
      font-size: var(--font-4xl);
      font-weight: 800;
      line-height: 1;
      margin: 0 0 var(--space-lg);
    }

    .not-found-title {
      font-family: 'Open Sans', sans-serif;
      font-size: var(--font-4xl);
      font-weight: 800;
      line-height: var(--lh-heading);
      margin: 0 0 var(--space-base);
    }

    .not-found-message {
      max-width: 42rem;
      color: rgba(0, 0, 0, 0.72);
      font-family: 'Open Sans', sans-serif;
      font-size: var(--font-base);
      font-weight: 300;
      line-height: var(--lh-body);
      margin: 0;
    }

    .not-found-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-md);
      margin-top: var(--space-xl);
    }

    .not-found-home-link,
    .not-found-report-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 0 var(--space-base);
      border: 0;
      border-radius: 999px;
      font-family: 'Open Sans', sans-serif;
      font-size: var(--font-sm);
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.2s;
    }

    .not-found-home-link {
      background: #000000;
      color: #ddff53;
    }

    .not-found-report-link {
      background: #ffffff;
      color: #000000;
    }

    .not-found-home-link:hover,
    .not-found-report-link:hover {
      opacity: 0.82;
      transform: translateY(-1px);
    }

    .not-found-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-base);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-base);
    }

    .section-title {
      font-family: 'Open Sans', sans-serif;
      font-size: var(--font-2xl);
      font-weight: 800;
      line-height: var(--lh-heading);
      color: #000000;
      margin: 0;
    }

    .section-link {
      color: #000000;
      font-family: 'Open Sans', sans-serif;
      font-size: var(--font-sm);
      font-weight: 400;
      text-decoration: none;
      white-space: nowrap;
      opacity: 0.6;
      transition: opacity 0.2s;
    }

    .section-link:hover {
      opacity: 1;
    }

    .recommendation-stack {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .recommendation-row {
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: var(--space-xs);
      direction: ltr;
      scrollbar-width: none;
      -ms-overflow-style: none;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
    }

    .recommendation-row::-webkit-scrollbar {
      display: none;
    }

    .recommendation-track {
      display: flex;
      direction: ltr;
      gap: var(--space-md);
      width: max-content;
    }

    .recommendation-card {
      flex: 0 0 19rem;
    }

    .recommendation-card ::ng-deep .news-banner {
      aspect-ratio: 1.35 / 1;
      border-radius: 22px;
    }

    .recommendation-card ::ng-deep .banner-overlay {
      background: linear-gradient(to top, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.44) 48%, rgba(0, 0, 0, 0.08) 100%);
    }

    .recommendation-card ::ng-deep .banner-text {
      right: 16px;
      bottom: 16px;
      left: 68px;
    }

    .recommendation-card ::ng-deep .banner-title {
      font-size: var(--font-lg);
      line-height: 1.12;
      -webkit-line-clamp: 3;
    }

    .recommendation-card ::ng-deep .banner-subtitle {
      margin-top: var(--space-xs);
      font-size: var(--font-sm);
      line-height: 1.25;
      -webkit-line-clamp: 3;
    }

    .recommendation-card ::ng-deep .banner-arrow-btn {
      left: 16px;
      bottom: 16px;
      width: 40px;
      height: 40px;
      border-radius: 12px;
    }

    @media (max-width: 768px) {
      .not-found-page {
        padding: var(--space-3xl) var(--space-lg);
        gap: var(--space-2xl);
      }

      .not-found-hero {
        border-radius: 20px;
        padding: var(--space-2xl) var(--space-lg);
      }

      .not-found-label,
      .not-found-title {
        font-size: var(--font-3xl);
      }

      .section-header {
        align-items: flex-start;
      }

      .section-title {
        font-size: var(--font-xl);
      }

      .recommendation-row--bottom {
        margin-inline-start: var(--space-xl);
      }

      .recommendation-card {
        flex-basis: 16rem;
      }
    }

    @media (max-width: 480px) {
      .not-found-page {
        padding: var(--space-2xl) var(--space-base);
      }

      .not-found-hero {
        border-radius: 18px;
      }

      .not-found-actions {
        flex-direction: column;
        align-items: stretch;
        width: 100%;
      }

      .not-found-home-link,
      .not-found-report-link {
        width: 100%;
      }

      .recommendation-card {
        flex-basis: 14rem;
      }
    }
  `]
})
export class NotFoundPageComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly articleService = inject(ArticleService);
    private readonly modalService = inject(ModalService);
    private readonly destroyRef = inject(DestroyRef);

    readonly scrollCopies = [0, 1, 2];
    recommendedArticles: Article[] = [];

    ngOnInit(): void {
        this.seo.set({
            title: 'דף לא נמצא',
            description: 'הדף שחיפשת לא קיים באתר אקורדישקייט.',
            path: '/404',
            noIndex: true,
            structuredData: this.seo.organizationSchema()
        });

        this.loadRecommendedArticles();
    }

    get recommendedFirstRow(): Article[] {
        return this.splitForRows(this.recommendedArticles).top;
    }

    get recommendedSecondRow(): Article[] {
        return this.splitForRows(this.recommendedArticles).bottom;
    }

    trackById(_index: number, item: { id: number | string }): number | string {
        return item.id;
    }

    openReportModal(): void {
        this.modalService.openReportModal({
            contentType: 'General',
            contentId: 0,
            contentTitle: 'דף 404'
        });
    }

    private loadRecommendedArticles(): void {
        this.articleService.getArticles(1, 12, undefined, undefined, undefined, ArticleStatus.Published)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: res => {
                    this.recommendedArticles = (res.items || [])
                        .filter(article => !!article.slug)
                        .map(article => ({
                            ...article,
                            contentType: this.normalizeContentType(article)
                        }));
                },
                error: err => console.error('not-found: recommended articles', err)
            });
    }

    private splitForRows(articles: Article[]): { top: Article[]; bottom: Article[] } {
        if (articles.length <= 1) return { top: articles, bottom: [] };
        const half = Math.ceil(articles.length / 2);
        return { top: articles.slice(0, half), bottom: articles.slice(half) };
    }

    private normalizeContentType(article: Article): ArticleContentType {
        const rawType = article.contentType as ArticleContentType | string | number | null | undefined;
        if (rawType === ArticleContentType.News || rawType === 0 || rawType === '0') return ArticleContentType.News;

        const textType = String(rawType ?? '').trim().toLowerCase();
        if (textType === 'news' || textType.includes('חדשות')) return ArticleContentType.News;
        return ArticleContentType.Blog;
    }
}
