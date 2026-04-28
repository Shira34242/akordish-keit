import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminService, UserStats, RecentJoin } from '../../../services/admin.service';
import { AnalyticsService, AnalyticsDashboard } from '../../../services/analytics.service';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';

@Component({
    selector: 'app-admin-dashboard-placeholder',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './dashboard-placeholder.component.html',
    styleUrls: ['./dashboard-placeholder.component.css']
})
export class AdminDashboardPlaceholderComponent implements OnInit {
    loading = true;
    today = new Date();

    userStats: UserStats | null = null;
    totalServiceProviders = 0;
    recentJoins: RecentJoin[] = [];
    dashboard: AnalyticsDashboard | null = null;

    constructor(
        private adminService: AdminService,
        private analyticsService: AnalyticsService,
        private serviceProviderService: MusicServiceProviderService
    ) {}

    ngOnInit(): void {
        this.loadAll();
    }

    loadAll(): void {
        this.loading = true;
        forkJoin({
            stats: this.adminService.getUserStats().pipe(catchError(() => of(null))),
            joins: this.adminService.getRecentJoins().pipe(catchError(() => of([]))),
            dash: this.analyticsService.getDashboard().pipe(catchError(() => of(null))),
            providers: this.serviceProviderService
                .getServiceProviders(undefined, undefined, undefined, undefined, undefined, undefined, 1, 1)
                .pipe(catchError(() => of(null)))
        }).subscribe(({ stats, joins, dash, providers }) => {
            this.userStats = stats;
            this.recentJoins = joins as RecentJoin[];
            this.dashboard = dash;
            this.totalServiceProviders = providers?.totalCount ?? 0;
            this.loading = false;
            this.today = new Date();
        });
    }

    barWidth(val: number, max: number): number {
        if (!max) return 0;
        return Math.min(100, Math.round((val / max) * 100));
    }

    fmt(n: number): string {
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }

    roleLabel(type: string): string {
        const map: Record<string, string> = {
            Regular: 'לקוח',
            Teacher: 'מורה',
            Artist: 'אומן',
            Admin: 'מנהל',
            Manager: 'מנהל'
        };
        return map[type] ?? type;
    }

    fmtDate(d: Date | string): string {
        return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    }

    get articleViewsLast30(): number { return this.dashboard?.articles?.viewsLast30Days ?? 0; }
    get articleViewsTotal(): number  { return this.dashboard?.articles?.totalViews ?? 0; }

    get ticketLast30(): number  { return this.dashboard?.buttons?.ticketClicks?.last30Days ?? 0; }
    get contactLast30(): number { return this.dashboard?.buttons?.contactClicks?.last30Days ?? 0; }
    get notifLast30(): number   { return this.dashboard?.buttons?.notificationLinkClicks?.last30Days ?? 0; }

    get totalInteractions(): number { return this.ticketLast30 + this.contactLast30 + this.notifLast30; }

    get maxButtonClicks(): number {
        return Math.max(this.ticketLast30, this.contactLast30, this.notifLast30, 1);
    }

    get adsTotalViews(): number  { return this.dashboard?.ads?.totalViews ?? 0; }
    get adsTotalClicks(): number { return this.dashboard?.ads?.totalClicks ?? 0; }
    get adsAvgCtr(): string {
        const v = this.adsTotalViews;
        return v ? ((this.adsTotalClicks / v) * 100).toFixed(1) : '0.0';
    }
    get topCampaigns() { return this.dashboard?.ads?.topCampaigns ?? []; }

    get topEvents() { return this.dashboard?.events?.topEvents ?? []; }
    get eventPageViewsTotal(): number   { return this.dashboard?.events?.listPageViews?.total ?? 0; }
    get eventPageViews30(): number      { return this.dashboard?.events?.listPageViews?.last30Days ?? 0; }

    get maxEventViews(): number {
        return Math.max(...this.topEvents.map(e => e.totalViews), 1);
    }

    get maxCampaignViews(): number {
        return Math.max(...this.topCampaigns.map(c => c.viewCount), 1);
    }
}
