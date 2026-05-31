import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink } from '@angular/router';
import { Article } from '../../../models/article.model';
import { getArticleRoute } from '../../../utils/article-route.utils';
import { CloudflareImagePipe, CloudflareImageSrcsetPipe } from '../../../pipes/cloudflare-image.pipe';

@Component({
  selector: 'app-news-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, CloudflareImagePipe, CloudflareImageSrcsetPipe],
  templateUrl: './news-banner.component.html',
  styleUrls: ['./news-banner.component.css']
})
export class NewsBannerComponent {
  @Input() article!: Article;
  @Input() showDescription = true;
  @Input() routePrefix?: '/news' | '/blog';
  @Input() imageSizes = '(max-width: 600px) 92vw, (max-width: 1024px) 46vw, 360px';
  @Input() imageWidths = [320, 480, 600, 900, 1200];

  get articleRoute(): string {
    return this.routePrefix ?? getArticleRoute(this.article);
  }

  get articleLink(): string[] {
    return [this.articleRoute, 'id', String(this.article.id)];
  }
}
