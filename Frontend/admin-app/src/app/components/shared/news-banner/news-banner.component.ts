import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, RouterLink } from '@angular/router';
import { Article } from '../../../models/article.model';
import { getArticleRoute } from '../../../utils/article-route.utils';

@Component({
  selector: 'app-news-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink],
  templateUrl: './news-banner.component.html',
  styleUrls: ['./news-banner.component.css']
})
export class NewsBannerComponent {
  @Input() article!: Article;
  @Input() showDescription = true;

  constructor(private router: Router) {}

  get articleRoute(): string {
    return getArticleRoute(this.article);
  }

  navigate(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
    }
    if (!this.article.slug) return;
    this.router.navigate([this.articleRoute, this.article.slug]);
  }
}
