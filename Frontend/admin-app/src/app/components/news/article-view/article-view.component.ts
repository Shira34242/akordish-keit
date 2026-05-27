import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, HostListener, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ArticleService } from '../../../services/admin/article.service';
import { Article, ArticleCategory, ArticleContentType, ArticleStatus } from '../../../models/article.model';
import { AdDisplayComponent } from '../../public/ad-display/ad-display.component';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { LikedContentService } from '../../../services/liked-content.service';
import { AuthService } from '../../../services/auth.service';
import { ReportModalComponent } from '../../shared/report-modal/report-modal.component';
import { ContentPageService } from '../../../services/content-page.service';
import { ArticleFeedbackService } from '../../../services/article-feedback.service';
import { ContentUploaderBadgeComponent } from '../../shared/content-uploader-badge/content-uploader-badge.component';
import { SeoService } from '../../../services/seo.service';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-article-view',
  standalone: true,
  imports: [CommonModule, RouterLink, AdDisplayComponent, NewsBannerComponent, ReportModalComponent, ContentUploaderBadgeComponent],
  templateUrl: './article-view.component.html',
  styleUrls: ['./article-view.component.css']
})
export class ArticleViewComponent implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly sanitizer = inject(DomSanitizer);
  private readonly articleService = inject(ArticleService);
  private readonly likedContentService = inject(LikedContentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contentPageService = inject(ContentPageService);
  private readonly feedbackService = inject(ArticleFeedbackService);
  private readonly authService = inject(AuthService);
  private readonly seo = inject(SeoService);
  private readonly langService = inject(LanguageService);

  constructor() {
    this.destroyRef.onDestroy(() => this.contentPageService.clearCurrentArticle());
  }

  private _heroEl: ElementRef<HTMLElement> | undefined;

  /* סטר — מופעל ברגע ש-*ngIf הופך true ואלמנט ה-hero מופיע ב-DOM */
  @ViewChild('articleHero')
  set heroEl(el: ElementRef<HTMLElement> | undefined) {
    this._heroEl = el;
    if (el) {
      this.fullHeroHeight = window.innerHeight - 16;
      el.nativeElement.style.height = this.fullHeroHeight + 'px';
      this.shrinkHero();
    }
  }

  article: Article | null = null;
  loading = true;
  safeVideoUrl: SafeResourceUrl | null = null;
  isFavorite = false;
  feedbackGiven = false;
  feedbackChoice: 'yes' | 'no' | null = null;
  feedbackYesCount = 0;
  feedbackNoCount = 0;
  relatedArticles: Article[] = [];
  relatedArticlesVisibleCount = 4;
  isReportModalOpen = false;
  fullHeroHeight = 0;
  lightboxIndex: number | null = null;

  feedbackPct(type: 'yes' | 'no'): number {
    const total = this.feedbackYesCount + this.feedbackNoCount;
    if (total === 0) return 50;
    const count = type === 'yes' ? this.feedbackYesCount : this.feedbackNoCount;
    return Math.round((count / total) * 100);
  }

  feedbackCircleSize(type: 'yes' | 'no'): number {
    const pct = this.feedbackGiven ? this.feedbackPct(type) : 50;
    return 72 + Math.round((pct / 100) * 40); /* 72px–112px */
  }

  get visibleRelatedArticles(): Article[] {
    return this.relatedArticles.slice(0, this.relatedArticlesVisibleCount);
  }

  get articleTags(): { id: number; name: string }[] {
    if (!this.article?.tagIds?.length) return [];
    const names = this.article.tags || [];
    return this.article.tagIds.map((id, i) => ({ id, name: names[i] ?? `#${id}` }));
  }

  get hasMoreRelatedArticles(): boolean {
    return this.relatedArticlesVisibleCount < this.relatedArticles.length;
  }

  showMoreRelatedArticles(): void {
    this.relatedArticlesVisibleCount = Math.min(this.relatedArticlesVisibleCount + 4, this.relatedArticles.length);
  }

  ngAfterViewInit(): void { /* hero מאותחל ע"י הסטר */ }

  @HostListener('window:scroll')
  onScroll(): void {
    this.shrinkHero();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.fullHeroHeight = window.innerHeight - 16;
    this.shrinkHero();
  }

  shrinkHero(): void {
    const hero = this._heroEl?.nativeElement;
    if (!hero || this.fullHeroHeight === 0) return;

    const minHeight = 56; /* גובה ה-navbar — hero מתכווץ לשורת הכותרת */
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    hero.style.height = newHeight + 'px';

    const progress = Math.min(1, window.scrollY / 160);
    const content = hero.querySelector('.hero-content') as HTMLElement | null;
    if (content) content.style.opacity = String(1 - progress);

    const collapseOverlay = hero.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (collapseOverlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      collapseOverlay.style.opacity = String(collapseProgress);
    }
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params.get('id');
        const slug = params.get('slug');
        if (id) {
          this.loadArticleById(+id);
          return;
        }

        if (slug) {
          this.loadArticle(slug);
        }
      });
  }

  loadArticleById(id: number): void {
    this.loading = true;
    this.safeVideoUrl = null;
    this.articleService.getArticle(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (article) => this.handleLoadedArticle(article),
        error: (error) => {
          console.error('Error loading article:', error);
          this.loading = false;
          this.router.navigate(['/404']);
        }
      });
  }

  loadArticle(slug: string): void {
    this.loading = true;
    this.safeVideoUrl = null;
    this.articleService.getArticleBySlug(slug, ArticleContentType.News)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (article) => {
          this.handleLoadedArticle(article);
        },
        error: (error) => {
          console.error('Error loading article:', error);
          this.loading = false;
          this.router.navigate(['/404']);
        }
      });
  }

  private handleLoadedArticle(article: Article): void {
    this.article = article;
    this.contentPageService.setCurrentArticle(article.id);
    this.applySeo(article);

    this.articleService.incrementView(article.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    if (article.videoEmbedUrl) {
      const embedUrl = this.convertToYouTubeEmbedUrl(article.videoEmbedUrl);
      this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    }

    this.loadRelatedArticles(article);
    this.checkIfLiked(article.id);
    this.loadFeedback(article.id);
    this.loading = false;
  }

  loadRelatedArticles(article: Article): void {
    this.relatedArticlesVisibleCount = 4;
    // Load articles from the same category and content type, excluding current article
    const categoryId = article.categoryIds && article.categoryIds.length > 0 ? article.categoryIds[0] : undefined;
    this.articleService.getArticles(
      1,
      12, // Get 12 related articles
      undefined,
      categoryId,
      article.contentType,
      ArticleStatus.Published,
      undefined
    ).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          // Filter out the current article
          this.relatedArticles = result.items.filter(a => a.id !== article.id).slice(0, 12);
        },
        error: (error) => {
          console.error('Error loading related articles:', error);
        }
      });
  }

  private applySeo(article: Article): void {
    const path = article.canonicalUrl || `/news/${article.slug}`;
    const description = article.metaDescription || article.subtitle || this.stripHtml(article.content).slice(0, 155);
    this.seo.set({
      title: article.metaTitle || article.title,
      description,
      path,
      imageUrl: article.featuredImageUrl,
      type: 'article',
      structuredData: [
        this.seo.organizationSchema(),
        this.seo.breadcrumbSchema([
          { name: this.langService.translate('nav.home_label'), path: '/' },
          { name: this.langService.translate('nav.music_news_label'), path: '/music-news' },
          { name: article.title, path }
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description,
          image: article.featuredImageUrl ? this.seo.absoluteUrl(article.featuredImageUrl) : undefined,
          datePublished: article.publishDate,
          author: article.authorName ? { '@type': 'Person', name: article.authorName } : undefined,
          mainEntityOfPage: this.seo.absoluteUrl(path)
        }
      ]
    });
  }

  private stripHtml(value: string | undefined): string {
    return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  getCategoryName(): string {
    if (!this.article) return '';
    return this.article.categoryNames.join(', ') || '';
  }

  convertToYouTubeEmbedUrl(url: string): string {
    if (!url) return url;

    // If already an embed URL, return as is
    if (url.includes('/embed/')) {
      return url;
    }

    // Extract video ID from various YouTube URL formats
    let videoId = '';

    // Format: https://www.youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) {
      videoId = watchMatch[1];
    }

    // Format: https://youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([^?]+)/);
    if (shortMatch) {
      videoId = shortMatch[1];
    }

    // If we found a video ID, return embed URL
    if (videoId) {
      return `https://www.youtube-nocookie.com/embed/${videoId}?origin=https://akordishkayt.com`;
    }

    // Return original URL if we couldn't parse it
    return url;
  }

  isAudioFileUrl(url: string | undefined): boolean {
    return !!url && /\.(mp3|wav|m4a|aac|ogg)(\?.*)?$/i.test(url);
  }

  getAudioDownloadUrl(url: string | undefined): string {
    if (!url) return '';
    if (!url.includes('/upload/')) return url;
    if (!url.includes('res.cloudinary.com')) return url;
    return url.replace('/upload/', '/upload/fl_attachment/');
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  goBack(): void {
    this.router.navigate(['/music-news']);
  }

  // Share article
  shareArticle(): void {
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: this.article?.title || '',
        text: this.article?.subtitle || '',
        url: url
      }).catch(() => {});
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url).then(() => {
        alert(this.langService.translate('common.link_copied'));
      });
    }
  }

  // Check if article is liked
  checkIfLiked(articleId: number): void {
    this.likedContentService.isContentLiked('Article', articleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isFavorite = result.isLiked;
        },
        error: (error) => {
          console.error('Error checking if article is liked:', error);
        }
      });
  }

  // Toggle favorite
  toggleFavorite(): void {
    if (!this.article) return;
    if (!this.authService.isLoggedIn) {
      this.authService.requestLogin(this.router.url);
      return;
    }

    const wasLiked = this.isFavorite;
    this.isFavorite = !this.isFavorite;

    if (this.isFavorite) {
      // Add to favorites
      this.likedContentService.addLikedContent({
        contentType: 'Article',
        contentId: this.article.id
      }).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {},
          error: (error) => {
            console.error('Error adding article to favorites:', error);
            this.isFavorite = wasLiked;
          }
        });
    } else {
      // Remove from favorites
      this.likedContentService.removeLikedContent('Article', this.article.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {},
          error: (error) => {
            console.error('Error removing article from favorites:', error);
            this.isFavorite = wasLiked;
          }
        });
    }
  }

  // ─── Feedback ─────────────────────────────────────────────────────────────

  loadFeedback(articleId: number): void {
    this.feedbackService.getFeedback(articleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.feedbackYesCount = result.yesCount;
          this.feedbackNoCount = result.noCount;
          if (result.hasVoted) {
            this.feedbackGiven = true;
            this.feedbackChoice = result.userChoice ? 'yes' : 'no';
          }
        },
        error: () => { /* silent — feedback is non-critical */ }
      });
  }

  giveFeedbackYes(): void {
    if (this.feedbackGiven || !this.article) return;
    this.feedbackGiven = true;
    this.feedbackChoice = 'yes';
    this.feedbackService.submitFeedback(this.article.id, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.feedbackYesCount = result.yesCount;
          this.feedbackNoCount = result.noCount;
        },
        error: () => {
          this.feedbackGiven = false;
          this.feedbackChoice = null;
        }
      });
  }

  giveFeedbackNo(): void {
    if (this.feedbackGiven || !this.article) return;
    this.feedbackGiven = true;
    this.feedbackChoice = 'no';
    this.feedbackService.submitFeedback(this.article.id, false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.feedbackYesCount = result.yesCount;
          this.feedbackNoCount = result.noCount;
        },
        error: () => {
          this.feedbackGiven = false;
          this.feedbackChoice = null;
        }
      });
  }

  // Lightbox
  openLightbox(index: number): void {
    this.lightboxIndex = index;
  }

  closeLightbox(): void {
    this.lightboxIndex = null;
  }

  lightboxStep(dir: 1 | -1): void {
    if (this.lightboxIndex === null || !this.article) return;
    const len = this.article.galleryImages.length;
    this.lightboxIndex = (this.lightboxIndex + dir + len) % len;
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.lightboxIndex === null) return;
    if (e.key === 'ArrowLeft') this.lightboxStep(1);
    if (e.key === 'ArrowRight') this.lightboxStep(-1);
    if (e.key === 'Escape') this.closeLightbox();
  }

  // Report Modal
  openReportModal(): void {
    this.isReportModalOpen = true;
  }

  closeReportModal(): void {
    this.isReportModalOpen = false;
  }
}
