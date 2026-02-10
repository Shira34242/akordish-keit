import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ArticleService } from '../../../services/admin/article.service';
import { Article, ArticleCategory, ArticleContentType } from '../../../models/article.model';
import { AdDisplayComponent } from '../../public/ad-display/ad-display.component';
import { ArticleCardComponent } from '../../shared/article-card/article-card.component';
import { LikedContentService } from '../../../services/liked-content.service';
import { ReportModalComponent } from '../../shared/report-modal/report-modal.component';

@Component({
  selector: 'app-article-view',
  standalone: true,
  imports: [CommonModule, RouterLink, AdDisplayComponent, ArticleCardComponent, ReportModalComponent],
  templateUrl: './article-view.component.html',
  styleUrls: ['./article-view.component.css']
})
export class ArticleViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly articleService = inject(ArticleService);
  private readonly likedContentService = inject(LikedContentService);
  private readonly destroyRef = inject(DestroyRef);

  article: Article | null = null;
  loading = true;
  safeVideoUrl: SafeResourceUrl | null = null;
  isFavorite = false;
  feedbackGiven = false;
  relatedArticles: Article[] = [];
  isReportModalOpen = false;

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.loadArticle(slug);
    }
  }

  loadArticle(slug: string): void {
    this.loading = true;
    this.articleService.getArticleBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (article) => {
          this.article = article;

          // Increment view count
          this.articleService.incrementView(article.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();

          // Set safe video URL if exists - convert to embed URL if needed
          if (article.videoEmbedUrl) {
            const embedUrl = this.convertToYouTubeEmbedUrl(article.videoEmbedUrl);
            this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
          }

          // Load related articles
          this.loadRelatedArticles(article);

          // Check if article is liked
          this.checkIfLiked(article.id);

          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading article:', error);
          this.loading = false;
          // Navigate back to home on error
          this.router.navigate(['/']);
        }
      });
  }

  loadRelatedArticles(article: Article): void {
    // Load articles from the same category and content type, excluding current article
    const categoryId = article.categoryIds && article.categoryIds.length > 0 ? article.categoryIds[0] : undefined;
    this.articleService.getArticles(
      1,
      6, // Get 6 related articles
      undefined,
      categoryId,
      article.contentType,
      undefined,
      undefined
    ).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          // Filter out the current article
          this.relatedArticles = result.items.filter(a => a.id !== article.id).slice(0, 6);
        },
        error: (error) => {
          console.error('Error loading related articles:', error);
        }
      });
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
      return `https://www.youtube.com/embed/${videoId}`;
    }

    // Return original URL if we couldn't parse it
    return url;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  goBack(): void {
    this.router.navigate(['/news']);
  }

  // Share article
  shareArticle(): void {
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: this.article?.title || '',
        text: this.article?.subtitle || '',
        url: url
      }).catch((error) => console.log('Error sharing:', error));
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url).then(() => {
        alert('הקישור הועתק ללוח');
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

    const wasLiked = this.isFavorite;
    this.isFavorite = !this.isFavorite;

    if (this.isFavorite) {
      // Add to favorites
      this.likedContentService.addLikedContent({
        contentType: 'Article',
        contentId: this.article.id
      }).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            console.log('Article added to favorites');
          },
          error: (error) => {
            console.error('Error adding article to favorites:', error);
            this.isFavorite = wasLiked; // Revert on error
          }
        });
    } else {
      // Remove from favorites
      this.likedContentService.removeLikedContent('Article', this.article.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            console.log('Article removed from favorites');
          },
          error: (error) => {
            console.error('Error removing article from favorites:', error);
            this.isFavorite = wasLiked; // Revert on error
          }
        });
    }
  }

  // Feedback - Yes
  giveFeedbackYes(): void {
    if (this.feedbackGiven) return;
    this.feedbackGiven = true;
    // TODO: Send feedback to backend
    console.log('User gave positive feedback');
  }

  // Feedback - No
  giveFeedbackNo(): void {
    if (this.feedbackGiven) return;
    this.feedbackGiven = true;
    // TODO: Send feedback to backend
    console.log('User gave negative feedback');
  }

  // Report Modal
  openReportModal(): void {
    this.isReportModalOpen = true;
  }

  closeReportModal(): void {
    this.isReportModalOpen = false;
  }
}
