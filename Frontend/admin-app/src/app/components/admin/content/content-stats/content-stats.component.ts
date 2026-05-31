import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ArticleFeedbackService, ArticleRank } from '../../../../services/article-feedback.service';
import { AnalyticsService, AnalyticsDashboard } from '../../../../services/analytics.service';
import { AgencyService, AgencyAnalyticsSummary } from '../../../../services/agency.service';

type Tab = 'articles' | 'events' | 'buttons' | 'ads' | 'adblock' | 'agencies';
type Preset = '7' | '30' | '90' | '365';

@Component({
  selector: 'app-content-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-stats.component.html',
  styleUrls: ['./content-stats.component.css']
})
export class ContentStatsComponent implements OnInit {
  activeTab: Tab = 'articles';

  articles: ArticleRank[] = [];
  articlesLoading = true;
  sortBy: 'views' | 'likes' | 'feedback' = 'views';

  dashboard: AnalyticsDashboard | null = null;
  dashboardLoading = true;
  dashboardError = false;

  agencySummary: AgencyAnalyticsSummary | null = null;
  agencyLoading = false;

  dateFrom = '';
  dateTo = '';
  activePreset: Preset | '' = '30';

  constructor(
    private feedbackService: ArticleFeedbackService,
    private analytics: AnalyticsService,
    private agencyService: AgencyService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as Tab;
      if (tab && ['articles', 'events', 'buttons', 'ads', 'adblock', 'agencies'].includes(tab)) {
        this.activeTab = tab;
      }
    });
    this.applyPreset('30');
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
    if (tab === 'agencies') this.loadAgencyAnalytics();
  }

  applyPreset(days: Preset): void {
    this.activePreset = days;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - parseInt(days));
    this.dateTo = this.toDateInput(to);
    this.dateFrom = this.toDateInput(from);
    this.loadAll();
  }

  applyCustomRange(): void {
    this.activePreset = '';
    this.loadAll();
  }

  private toDateInput(d: Date): string {
    return d.toISOString().substring(0, 10);
  }

  private loadAll(): void {
    this.loadArticles();
    this.loadDashboard();
    if (this.activeTab === 'agencies') this.loadAgencyAnalytics();
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
    this.dashboardError = false;
    this.analytics.getDashboard(this.dateFrom, this.dateTo).subscribe({
      next: (data) => {
        this.dashboard = data;
        this.dashboardLoading = false;
      },
      error: () => {
        this.dashboardLoading = false;
        this.dashboardError = true;
      }
    });
  }

  load(): void {
    this.loadAll();
  }

  loadAgencyAnalytics(): void {
    this.agencyLoading = true;
    this.agencyService.getAnalytics(this.dateFrom, this.dateTo).subscribe({
      next: (data) => {
        this.agencySummary = data;
        this.agencyLoading = false;
      },
      error: () => {
        this.agencySummary = null;
        this.agencyLoading = false;
      }
    });
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

  get adBlockRate(): number {
    return this.dashboard?.adBlock.detectionRate ?? 0;
  }

  getAdBlockDailyWidth(value: number): number {
    const max = Math.max(...(this.dashboard?.adBlock.daily.map(day => day.checks) ?? [0]));
    return max > 0 ? Math.max(8, Math.round(value / max * 100)) : 8;
  }

  formatShortDate(value: string): string {
    return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' }).format(new Date(value));
  }

  get periodLabel(): string {
    const presetMap: Record<string, string> = { '7': '7 ימים', '30': '30 יום', '90': '90 יום', '365': 'שנה' };
    return this.activePreset ? presetMap[this.activePreset] : `${this.dateFrom} - ${this.dateTo}`;
  }
}
