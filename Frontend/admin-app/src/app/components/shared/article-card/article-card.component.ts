import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Article, ArticleContentType } from '../../../models/article.model';

@Component({
  selector: 'app-article-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './article-card.component.html',
  styleUrls: ['./article-card.component.css']
})
export class ArticleCardComponent {
  @Input() article!: Article;
  @Input() layout: 'overlay' | 'card' = 'overlay';

  get articleRoute(): string {
    return this.article.contentType === ArticleContentType.News ? '/news' : '/blog';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
