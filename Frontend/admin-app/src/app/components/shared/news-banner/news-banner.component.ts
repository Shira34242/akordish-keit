import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Article, ArticleContentType } from '../../../models/article.model';

@Component({
  selector: 'app-news-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './news-banner.component.html',
  styleUrls: ['./news-banner.component.css']
})
export class NewsBannerComponent {
  @Input() article!: Article;
  @Input() showDescription = true;

  constructor(private router: Router) {}

  get articleRoute(): string {
    return this.article.contentType === ArticleContentType.News ? '/news' : '/blog';
  }

  navigate(): void {
    this.router.navigate([this.articleRoute, this.article.slug]);
  }
}
