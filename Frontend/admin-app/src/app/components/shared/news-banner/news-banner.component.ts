import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink } from '@angular/router';
import { ArticleBanner } from '../../../models/article.model';
import { getArticleLink, getArticleRoute, getArticleSlug } from '../../../utils/article-route.utils';
import { CloudflareImagePipe, CloudflareImagePreset, CloudflareImageSrcsetPipe } from '../../../pipes/cloudflare-image.pipe';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';

@Component({
  selector: 'app-news-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, CloudflareImagePipe, CloudflareImageSrcsetPipe, ImgFallbackDirective],
  templateUrl: './news-banner.component.html',
  styleUrls: ['./news-banner.component.css']
})
export class NewsBannerComponent {
  @Input() article!: ArticleBanner;
  @Input() showDescription = true;
  @Input() routePrefix?: '/news' | '/blog';
  @Input() imagePreset: CloudflareImagePreset | number = 'card';
  @Input() imageSizes = '(max-width: 600px) 92vw, (max-width: 1024px) 46vw, 360px';
  @Input() imageWidths: number[] = [];
  @Input() imageLoading: 'eager' | 'lazy' = 'lazy';
  @Input() imageFetchPriority: 'high' | 'low' | 'auto' = 'auto';

  get titleLengthClass(): string {
    const length = this.article?.title?.trim().length ?? 0;
    if (length > 70) return 'title-long';
    if (length > 42) return 'title-medium';
    return '';
  }

  get articleRoute(): string {
    return this.routePrefix ?? getArticleRoute(this.article);
  }

  get articleLink(): string[] {
    const slug = getArticleSlug(this.article);
    return slug ? [this.articleRoute, String(this.article.id), slug] : getArticleLink(this.article);
  }
}
