import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink } from '@angular/router';
import { Article } from '../../../models/article.model';
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
  @Input() article!: Article;
  @Input() showDescription = true;
  @Input() routePrefix?: '/news' | '/blog';
  @Input() imagePreset: CloudflareImagePreset | number = 'card';
  @Input() imageSizes = '(max-width: 600px) 92vw, (max-width: 1024px) 46vw, 360px';
  @Input() imageWidths: number[] = [];

  get articleRoute(): string {
    return this.routePrefix ?? getArticleRoute(this.article);
  }

  get articleLink(): string[] {
    const slug = getArticleSlug(this.article);
    return slug ? [this.articleRoute, String(this.article.id), slug] : getArticleLink(this.article);
  }
}
