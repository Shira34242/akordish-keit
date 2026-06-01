import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Article } from '../../../models/article.model';
import { getArticleLink, getArticleRoute } from '../../../utils/article-route.utils';
import { CloudflareImagePipe } from '../../../pipes/cloudflare-image.pipe';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';

@Component({
  selector: 'app-article-card',
  standalone: true,
  imports: [CommonModule, RouterModule, CloudflareImagePipe, ImgFallbackDirective],
  templateUrl: './article-card.component.html',
  styleUrls: ['./article-card.component.css']
})
export class ArticleCardComponent {
  @Input() article!: Article;
  @Input() layout: 'overlay' | 'card' = 'overlay';

  get articleRoute(): string {
    return getArticleRoute(this.article);
  }

  get articleLink(): string[] {
    return getArticleLink(this.article);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
