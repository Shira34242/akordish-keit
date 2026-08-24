import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ArticleRank } from '../../../../services/article-feedback.service';
import { AgencyAnalyticsSummary, AgencyService } from '../../../../services/agency.service';
import { AnalyticsDashboard, AnalyticsService, IndexProfileAnalyticsSummary } from '../../../../services/analytics.service';
import { getArticleLink } from '../../../../utils/article-route.utils';

type Tab = 'overview' | 'traffic' | 'articles' | 'chords' | 'events' | 'podcasts' | 'buttons' | 'ads' | 'adblock' | 'agencies' | 'index';
type Preset = 'today' | 'yesterday' | '7' | '30' | '90' | '365' | 'ytd' | 'all';

@Component({
  selector: 'app-content-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-stats.component.html',
  styleUrls: ['./content-stats.component.css']
})
export class ContentStatsComponent implements OnInit {
  readonly math = Math;
  private readonly analytics = inject(AnalyticsService);
  private readonly agencyService = inject(AgencyService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  activeTab: Tab = 'overview';
  selectedMetric: 'all' | 'pages' | 'articles' | 'chords' | 'events' | 'podcasts' | 'clicks' = 'all';
  articles: ArticleRank[] = [];
  articleSearch = '';
  articleTypeFilter: 'all' | 'news' | 'blog' = 'all';
  sortBy: 'views' | 'likes' | 'feedback' = 'views';
  dashboard: AnalyticsDashboard | null = null;
  agencySummary: AgencyAnalyticsSummary | null = null;
  indexSummary: IndexProfileAnalyticsSummary | null = null;
  indexSearch = '';
  indexProfileTypeFilter: 'all' | 'teacher' | 'professional' = 'all';
  dateFrom = '';
  dateTo = '';
  activePreset: Preset | '' = '30';
  loading = true;
  articleLoading = true;
  agencyLoading = false;
  indexLoading = false;
  error = false;

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'סקירה', icon: 'dashboard' },
    { key: 'traffic', label: 'תנועה באתר', icon: 'language' },
    { key: 'articles', label: 'כתבות', icon: 'article' },
    { key: 'chords', label: 'אקורדים', icon: 'music_note' },
    { key: 'events', label: 'הופעות', icon: 'event' },
    { key: 'podcasts', label: 'פודקאסטים', icon: 'podcasts' },
    { key: 'buttons', label: 'פעולות', icon: 'touch_app' },
    { key: 'ads', label: 'פרסום', icon: 'campaign' },
    { key: 'index', label: 'אינדקס', icon: 'badge' },
    { key: 'agencies', label: 'סוכנויות', icon: 'business' },
    { key: 'adblock', label: 'AdBlock', icon: 'shield' }
  ];

  readonly rangeOptions: { key: Preset; label: string }[] = [
    { key: 'today', label: 'היום' },
    { key: 'yesterday', label: 'אתמול' },
    { key: '7', label: '7 ימים' },
    { key: '30', label: '30 ימים' },
    { key: '90', label: '90 ימים' },
    { key: '365', label: 'שנה' },
    { key: 'ytd', label: 'מתחילת השנה' },
    { key: 'all', label: 'מההתחלה ועד היום' }
  ];

  get activeTabDefinition(): { key: Tab; label: string; icon: string } {
    return this.tabs.find(item => item.key === this.activeTab) ?? this.tabs[0];
  }

  get trendMiddleIndex(): number { return Math.floor((this.dashboard?.trend.length ?? 1) / 2); }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as Tab;
      if (this.tabs.some(item => item.key === tab)) this.activeTab = tab;
    });
    this.applyPreset('30');
  }

  applyPreset(days: Preset): void {
    this.activePreset = days;
    const today = new Date();
    const from = new Date(today);
    const to = new Date(today);

    if (days === 'today') {
      // Same start/end day.
    } else if (days === 'yesterday') {
      from.setDate(today.getDate() - 1);
      to.setDate(today.getDate() - 1);
    } else if (days === 'ytd') {
      from.setMonth(0, 1);
    } else if (days === 'all') {
      from.setFullYear(2000, 0, 1);
    } else {
      from.setDate(today.getDate() - (Number(days) - 1));
    }

    this.dateTo = this.toDateInput(to);
    this.dateFrom = this.toDateInput(from);
    this.loadAll();
  }

  applyCustomRange(): void {
    this.activePreset = '';
    this.loadAll();
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' });
    if (tab === 'agencies') this.loadAgencyAnalytics();
    if (tab === 'index') this.loadIndexAnalytics();
  }

  setMetric(metric: 'all' | 'pages' | 'articles' | 'chords' | 'events' | 'podcasts' | 'clicks'): void {
    this.selectedMetric = metric;
  }

  get filteredArticles(): ArticleRank[] {
    const query = this.articleSearch.trim().toLocaleLowerCase();
    return this.articles.filter(article => {
      const matchesText = !query || article.title.toLocaleLowerCase().includes(query);
      const matchesType = this.articleTypeFilter === 'all'
        || (this.articleTypeFilter === 'news' && article.contentType === 1)
        || (this.articleTypeFilter === 'blog' && article.contentType !== 1);
      return matchesText && matchesType;
    });
  }

  get filteredIndexProfiles(): IndexProfileAnalyticsSummary['profiles'] {
    const query = this.indexSearch.trim().toLocaleLowerCase();
    return (this.indexSummary?.profiles ?? []).filter(profile =>
      (this.indexProfileTypeFilter === 'all' || profile.profileType === this.indexProfileTypeFilter) &&
      (!query || profile.profileName.toLocaleLowerCase().includes(query))
    );
  }

  loadAll(): void {
    this.loading = true;
    this.error = false;
    this.loadArticles();
    this.analytics.getDashboard(this.dateFrom, this.dateTo).subscribe({
      next: dashboard => { this.dashboard = dashboard; this.loading = false; },
      error: () => { this.loading = false; this.error = true; }
    });
    if (this.activeTab === 'agencies') this.loadAgencyAnalytics();
    if (this.activeTab === 'index') this.loadIndexAnalytics();
  }

  loadArticles(): void {
    this.articleLoading = true;
    this.analytics.getArticleRanking(this.dateFrom, this.dateTo, this.sortBy).subscribe({
      next: data => { this.articles = data; this.articleLoading = false; },
      error: () => { this.articles = []; this.articleLoading = false; }
    });
  }

  loadAgencyAnalytics(): void {
    this.agencyLoading = true;
    this.agencyService.getAnalytics(this.dateFrom, this.dateTo).subscribe({
      next: data => { this.agencySummary = data; this.agencyLoading = false; },
      error: () => { this.agencySummary = null; this.agencyLoading = false; }
    });
  }

  loadIndexAnalytics(): void {
    this.indexLoading = true;
    this.analytics.getIndexProfiles(this.dateFrom, this.dateTo).subscribe({
      next: data => { this.indexSummary = data; this.indexLoading = false; },
      error: () => { this.indexSummary = null; this.indexLoading = false; }
    });
  }

  setSort(by: 'views' | 'likes' | 'feedback'): void {
    this.sortBy = by;
    this.loadArticles();
  }

  navigateToArticle(article: ArticleRank): void { this.router.navigate(getArticleLink(article as any)); }

  get adsCtr(): number {
    const ads = this.dashboard?.ads;
    return ads && ads.totalViews > 0 ? Math.round(ads.totalClicks / ads.totalViews * 10000) / 100 : 0;
  }

  get adBlockRate(): number { return this.dashboard?.adBlock.detectionRate ?? 0; }

  get totalViews(): number {
    const d = this.dashboard;
    return d ? d.articles.viewsLast30Days + d.chords.viewsLast30Days + d.events.listPageViews.last30Days + d.podcasts.viewsLast30Days : 0;
  }

  get trackedVisits(): number {
    return this.dashboard?.traffic.views ?? 0;
  }

  get uniqueVisitors(): number { return this.dashboard?.traffic.uniqueVisitors ?? 0; }

  get totalClicks(): number {
    const b = this.dashboard?.buttons;
    return b ? b.ticketClicks.last30Days + b.contactClicks.last30Days + b.notificationLinkClicks.last30Days : 0;
  }

  get trendMax(): number {
    return Math.max(1, ...(this.dashboard?.trend ?? []).map(point => this.trendValue(point)));
  }

  percentChange(current: number, previous: number): number {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round((current - previous) / previous * 1000) / 10;
  }

  get contentChange(): number {
    const comparison = this.dashboard?.comparison.contentViews;
    return comparison ? this.percentChange(comparison.current, comparison.previous) : 0;
  }

  get clicksChange(): number {
    const comparison = this.dashboard?.comparison.clicks;
    return comparison ? this.percentChange(comparison.current, comparison.previous) : 0;
  }

  get trafficChange(): number {
    const traffic = this.dashboard?.traffic;
    return traffic ? this.percentChange(traffic.views, traffic.previousViews) : 0;
  }

  get averageViewsPerVisitor(): number {
    const traffic = this.dashboard?.traffic;
    return traffic?.uniqueVisitors ? Math.round(traffic.views / traffic.uniqueVisitors * 10) / 10 : 0;
  }

  get deviceItems(): { key: 'desktop' | 'tablet' | 'mobile'; label: string; icon: string; users: number; views: number; share: number }[] {
    const devices = this.dashboard?.traffic.devices;
    const total = devices ? devices.desktop.uniqueVisitors + devices.tablet.uniqueVisitors + devices.mobile.uniqueVisitors : 0;
    const item = (key: 'desktop' | 'tablet' | 'mobile', label: string, icon: string) => ({
      key,
      label,
      icon,
      users: devices?.[key].uniqueVisitors ?? 0,
      views: devices?.[key].views ?? 0,
      share: total ? Math.round((devices?.[key].uniqueVisitors ?? 0) / total * 100) : 0
    });
    return [item('desktop', 'מחשב', 'desktop_windows'), item('mobile', 'מובייל', 'smartphone'), item('tablet', 'טאבלט', 'tablet_mac')];
  }

  get deviceDonutStyle(): string {
    const [desktop, mobile] = this.deviceItems;
    const desktopEnd = desktop.share;
    const mobileEnd = desktop.share + mobile.share;
    return `conic-gradient(#000 0 ${desktopEnd}%, #ddff53 ${desktopEnd}% ${mobileEnd}%, #b9b9b9 ${mobileEnd}% 100%)`;
  }

  trendBarHeight(point: { articles: number; chords: number; events: number; clicks: number; podcasts: number; pages: number }): number {
    return Math.max(3, Math.round(this.trendValue(point) / this.trendMax * 100));
  }

  get primaryInsight(): string {
    if (!this.dashboard) return '';
    if (this.contentChange > 5) return `צפיות התוכן בעלייה של ${this.contentChange}% לעומת התקופה הקודמת.`;
    if (this.contentChange < -5) return `צפיות התוכן ירדו ב־${Math.abs(this.contentChange)}% לעומת התקופה הקודמת.`;
    if (this.dashboard.chords.viewsLast30Days > this.dashboard.articles.viewsLast30Days) return 'האקורדים הם ערוץ התוכן החזק ביותר בתקופה הנבחרת.';
    return 'הפעילות יציבה בתקופה הנבחרת. כדאי לבדוק את התוכן המוביל לפי סוג.';
  }

  get trendPoints(): string {
    const trend = this.dashboard?.trend ?? [];
    if (!trend.length) return '';
    const width = 720;
    const height = 220;
    return trend.map((point, index) => {
      const x = trend.length === 1 ? width / 2 : index / (trend.length - 1) * width;
      const y = height - (this.trendValue(point) / this.trendMax) * (height - 18) - 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  trendValue(point: { articles: number; chords: number; events: number; clicks: number; podcasts: number; pages: number }): number {
    if (this.selectedMetric === 'pages') return point.pages;
    if (this.selectedMetric === 'articles') return point.articles;
    if (this.selectedMetric === 'chords') return point.chords;
    if (this.selectedMetric === 'events') return point.events;
    if (this.selectedMetric === 'podcasts') return point.podcasts;
    if (this.selectedMetric === 'clicks') return point.clicks;
    return point.articles + point.chords + point.events + point.podcasts;
  }

  get trendLabel(): string {
    return ({ all: 'כל צפיות התוכן', pages: 'צפיות באתר', articles: 'צפיות כתבות', chords: 'צפיות אקורדים', events: 'צפיות הופעות', podcasts: 'צפיות פודקאסטים', clicks: 'פעולות וקליקים' } as any)[this.selectedMetric];
  }

  get periodLabel(): string {
    const labels: Record<string, string> = {
      today: 'היום', yesterday: 'אתמול', '7': '7 ימים', '30': '30 ימים', '90': '90 ימים',
      '365': 'שנה', ytd: 'מתחילת השנה', all: 'מההתחלה ועד היום'
    };
    return this.activePreset ? labels[this.activePreset] : `${this.dateFrom} — ${this.dateTo}`;
  }

  getContentTypeLabel(type: number): string { return type === 1 ? 'חדשות' : 'בלוג'; }
  formatShortDate(value: string): string { return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' }).format(new Date(value)); }
  getAdBlockDailyWidth(value: number): number {
    const max = Math.max(...(this.dashboard?.adBlock.daily.map(day => day.checks) ?? [0]));
    return max > 0 ? Math.max(8, Math.round(value / max * 100)) : 8;
  }
  toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
