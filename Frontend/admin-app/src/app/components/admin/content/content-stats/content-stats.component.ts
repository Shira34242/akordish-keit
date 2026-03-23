import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ArticleFeedbackService, ArticleRank } from '../../../../services/article-feedback.service';

@Component({
  selector: 'app-content-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './content-stats.component.html',
  styleUrls: ['./content-stats.component.css']
})
export class ContentStatsComponent implements OnInit {
  articles: ArticleRank[] = [];
  loading = true;
  sortBy: 'views' | 'likes' | 'feedback' = 'views';

  constructor(
    private feedbackService: ArticleFeedbackService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.feedbackService.getTopContent(30).subscribe({
      next: (data) => {
        this.articles = data;
        this.sort();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  setSort(by: 'views' | 'likes' | 'feedback'): void {
    this.sortBy = by;
    this.sort();
  }

  private sort(): void {
    this.articles = [...this.articles].sort((a, b) => {
      if (this.sortBy === 'views') return b.viewCount - a.viewCount;
      if (this.sortBy === 'likes') return b.likeCount - a.likeCount;
      return b.feedbackTotal - a.feedbackTotal;
    });
  }

  getContentTypeLabel(type: number): string {
    return type === 1 ? 'חדשות' : 'בלוג';
  }

  navigateToArticle(slug?: string): void {
    if (!slug) return;
    this.router.navigate(['/news', slug]);
  }
}
