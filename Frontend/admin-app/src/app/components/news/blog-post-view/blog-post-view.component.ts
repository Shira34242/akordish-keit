import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ArticleService } from '../../../services/admin/article.service';
import { Article, ArticleCategory } from '../../../models/article.model';
import { AdDisplayComponent } from '../../public/ad-display/ad-display.component';
import { LikedContentService } from '../../../services/liked-content.service';

@Component({
  
  selector: 'app-blog-post-view',
  standalone: true,
  imports: [CommonModule, AdDisplayComponent],
  templateUrl: './blog-post-view.component.html',
  styleUrls: ['./blog-post-view.component.css']
})
export class BlogPostViewComponent implements OnInit {
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

          // Check if blog post is liked
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
    this.router.navigate(['/blog']);
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

  // Check if blog post is liked
  checkIfLiked(articleId: number): void {
    this.likedContentService.isContentLiked('BlogPost', articleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isFavorite = result.isLiked;
        },
        error: (error) => {
          console.error('Error checking if blog post is liked:', error);
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
        contentType: 'BlogPost',
        contentId: this.article.id
      }).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            console.log('Blog post added to favorites');
          },
          error: (error) => {
            console.error('Error adding blog post to favorites:', error);
            this.isFavorite = wasLiked; // Revert on error
          }
        });
    } else {
      // Remove from favorites
      this.likedContentService.removeLikedContent('BlogPost', this.article.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            console.log('Blog post removed from favorites');
          },
          error: (error) => {
            console.error('Error removing blog post from favorites:', error);
            this.isFavorite = wasLiked; // Revert on error
          }
        });
    }
  }

  // Report error
  reportError(): void {
    // TODO: Implement report error functionality
    alert('תודה על הדיווח! נטפל בכך בהקדם.');
    console.log('Error reported for article:', this.article?.id);
  }
}
