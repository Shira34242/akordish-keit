import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ArticleFeedbackService, ArticleRank } from '../../../../services/article-feedback.service';
import { AnalyticsService, AnalyticsDashboard } from '../../../../services/analytics.service';

type Tab = 'articles' | 'events' | 'buttons' | 'ads';

@Component({
  selector: 'app-content-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './content-stats.component.html',
  styleUrls: ['./content-stats.component.css']
})
export class ContentStatsComponent implements OnInit {
  activeTab: Tab = 'articles';

  // Articles tab
  articles: ArticleRank[] = [];
  articlesLoading = true;
  sortBy: 'views' | 'likes' | 'feedback' = 'views';

  // Analytics dashboard (events + buttons + ads)
  dashboard: AnalyticsDashboard | null = null;
  dashboardLoading = true;

  constructor(
    private feedbackService: ArticleFeedbackService,
    private analytics: AnalyticsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadArticles();
    this.loadDashboard();
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
  }

  loadArticles(): void {
    this.articlesLoading = true;
    this.feedbackService.getTopContent(30).subscribe({
      next: (data) => {
        this.articles = data;
        this.sortArticles();
        this.articlesLoading = false;
      },
      error: () => { this.articlesLoading = false; }
    });
  }

  loadDashboard(): void {
    this.dashboardLoading = true;
    this.analytics.getDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.dashboardLoading = false;
      },
      error: () => { this.dashboardLoading = false; }
    });
  }

  load(): void {
    this.loadArticles();
    this.loadDashboard();
  }

  setSort(by: 'views' | 'likes' | 'feedback'): void {
    this.sortBy = by;
    this.sortArticles();
  }

  private sortArticles(): void {
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

  get adsCtr(): number {
    if (!this.dashboard) return 0;
    const { totalViews, totalClicks } = this.dashboard.ads;
    return totalViews > 0 ? Math.round(totalClicks / totalViews * 1000) / 10 : 0;
  }
}
