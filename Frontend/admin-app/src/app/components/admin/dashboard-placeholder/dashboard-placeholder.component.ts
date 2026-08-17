import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EMPTY, forkJoin, of } from 'rxjs';
import { catchError, expand, finalize, map, reduce } from 'rxjs/operators';
import { AnalyticsService, AnalyticsDashboard } from '../../../services/analytics.service';
import { ReportService } from '../../../services/report.service';
import { Report } from '../../../models/report.model';
import { UserService } from '../../../services/user.service';
import { UserListDto } from '../../../models/user.model';
import { TeacherService } from '../../../services/teacher.service';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { ArtistService } from '../../../services/artist.service';
import { SongService } from '../../../services/song.service';
import { ArtistListDto, ArtistStatus } from '../../../models/artist.model';
import { TeacherListDto } from '../../../models/teacher.model';
import { MusicServiceProviderListDto } from '../../../models/music-service-provider.model';
import { SongDto } from '../../../models/song.model';
import { Article, ArticleContentType, ArticleStatus } from '../../../models/article.model';
import { ArticleService as AdminArticleService } from '../../../services/admin/article.service';
import { EventService as AdminEventService } from '../../../services/admin/event.service';
import { PodcastService } from '../../../services/podcast.service';
import { Event } from '../../../models/event.model';
import { PodcastEpisode } from '../../../models/podcast.model';

type PeriodKey = 'day' | 'week' | 'month';

interface DashboardQueueItem {
    id: string;
    type: string;
    title: string;
    subtitle: string;
    date: Date | string;
    imageUrl?: string;
    link: any[];
}

@Component({
    selector: 'app-admin-dashboard-placeholder',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './dashboard-placeholder.component.html',
    styleUrls: ['./dashboard-placeholder.component.css']
})
export class AdminDashboardPlaceholderComponent implements OnInit {
    usersLoading = true;
    userMetricsLoading = true;
    reportsLoading = true;
    analyticsLoading = true;
    approvalsLoading = true;
    contentLoading = true;
    today = new Date();
    selectedUserPeriod: PeriodKey = 'day';
    selectedAnalyticsPeriod: PeriodKey = 'day';

    totalUsers = 0;
    joinedLastDay = 0;
    joinedLastWeek = 0;
    recentUsers: UserListDto[] = [];
    dashboard: AnalyticsDashboard | null = null;

    pendingReportsCount = 0;
    pendingReports: Report[] = [];
    pendingTeachersCount = 0;
    pendingTeachers: TeacherListDto[] = [];
    pendingServiceProvidersCount = 0;
    pendingServiceProviders: MusicServiceProviderListDto[] = [];
    pendingArtistsCount = 0;
    pendingArtists: ArtistListDto[] = [];
    pendingSongsCount = 0;
    pendingSongs: SongDto[] = [];
    draftArticlesCount = 0;
    draftArticles: Article[] = [];
    draftNewsCount = 0;
    draftNews: Article[] = [];
    draftPodcastEpisodesCount = 0;
    draftPodcastEpisodes: PodcastEpisode[] = [];
    draftEventsCount = 0;
    draftEvents: Event[] = [];

    get totalPendingApprovals(): number {
        return this.pendingTeachersCount +
               this.pendingServiceProvidersCount +
               this.pendingArtistsCount;
    }

    get totalDraftContent(): number {
        return this.draftArticlesCount +
               this.draftNewsCount +
               this.draftPodcastEpisodesCount +
               this.draftEventsCount +
               this.pendingSongsCount;
    }

    get previousUserPeriodCount(): number {
        const days = this.periodDays(this.selectedUserPeriod);
        const currentStart = this.periodCutoff(this.selectedUserPeriod).getTime();
        const previousStart = currentStart - days * 24 * 60 * 60 * 1000;
        return this.recentUsers.filter(user => {
            const created = new Date(user.createdAt).getTime();
            return created >= previousStart && created < currentStart;
        }).length;
    }

    get userComparisonPercent(): number {
        if (!this.previousUserPeriodCount) return this.recentJoinCount ? 100 : 0;
        return Math.round(((this.recentJoinCount - this.previousUserPeriodCount) / this.previousUserPeriodCount) * 100);
    }

    get userComparisonGaugeOffset(): number {
        if (!this.recentJoinCount && !this.previousUserPeriodCount) return 251;
        const relative = Math.min(100, (this.recentJoinCount / Math.max(1, this.previousUserPeriodCount)) * 100);
        return 251 - (251 * relative / 100);
    }

    get currentUserPeriodLabel(): string {
        return this.selectedUserPeriod === 'day' ? 'היום' : this.selectedUserPeriod === 'week' ? 'השבוע' : 'החודש';
    }

    get previousUserPeriodLabel(): string {
        return this.selectedUserPeriod === 'day' ? 'אתמול' : this.selectedUserPeriod === 'week' ? 'שבוע שעבר' : 'חודש שעבר';
    }

    get userComparisonCaption(): string {
        if (!this.recentJoinCount && !this.previousUserPeriodCount) return 'אין עדיין הצטרפויות בשתי התקופות';
        if (this.userComparisonPercent === 0) return 'אותו מספר הצטרפויות כמו בתקופה הקודמת';
        return `${Math.abs(this.userComparisonPercent)}% ${this.userComparisonPercent > 0 ? 'יותר' : 'פחות'} מהתקופה הקודמת`;
    }

    get approvalSegments(): { label: string; count: number; icon: string; link: string }[] {
        return [
            { label: 'מורים', count: this.pendingTeachersCount, icon: 'school', link: '/admin/users/teachers' },
            { label: 'נותני שירות', count: this.pendingServiceProvidersCount, icon: 'business_center', link: '/admin/users/service-providers' },
            { label: 'אמנים', count: this.pendingArtistsCount, icon: 'artist', link: '/admin/users/artists' }
        ];
    }

    get contentQueue(): DashboardQueueItem[] {
        return [
            ...this.draftArticles.map(item => ({ id: `article-${item.id}`, type: 'כתבה', title: item.title, subtitle: 'טיוטת כתבה', date: this.contentDate(item), imageUrl: item.featuredImageUrl, link: ['/admin/content/articles/edit', item.id] })),
            ...this.draftNews.map(item => ({ id: `news-${item.id}`, type: 'חדשות', title: item.title, subtitle: 'ידיעה לפני פרסום', date: this.contentDate(item), imageUrl: item.featuredImageUrl, link: ['/admin/content/articles/edit', item.id] })),
            ...this.draftEvents.map(item => ({ id: `event-${item.id}`, type: 'הופעה', title: item.name, subtitle: item.location || 'אירוע לפני פרסום', date: this.contentDate(item), imageUrl: item.imageUrl, link: ['/admin/content/events/edit', item.id] })),
            ...this.draftPodcastEpisodes.map(item => ({ id: `episode-${item.id}`, type: 'פודקאסט', title: item.title, subtitle: item.podcastName, date: this.contentDate(item), imageUrl: item.thumbnailUrl, link: ['/admin/content/podcasts/episodes/edit', item.id] })),
            ...this.pendingSongs.map(item => ({ id: `song-${item.id}`, type: 'אקורד', title: item.title, subtitle: item.artists?.map(artist => artist.name).join(', ') || 'שיר לפני אישור', date: this.contentDate(item), imageUrl: item.imageUrl, link: ['/admin/content/songs'] }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    }

    get trendPoints(): { x: number; y: number; clicksY: number; label: string; value: number }[] {
        const trend = this.dashboard?.trend ?? [];
        if (!trend.length) return [];
        const totals = trend.map(point => point.articles + point.chords + point.events + point.podcasts + point.pages);
        const maxValue = Math.max(1, ...totals, ...trend.map(point => point.clicks));
        const width = 960;
        return trend.map((point, index) => {
            const x = 20 + (trend.length === 1 ? width / 2 : index * width / (trend.length - 1));
            return {
                x,
                y: 210 - (totals[index] / maxValue) * 170,
                clicksY: 210 - (point.clicks / maxValue) * 170,
                label: this.fmtDate(point.date),
                value: totals[index]
            };
        });
    }

    get trendLine(): string {
        return this.trendPoints.map(point => `${point.x},${point.y}`).join(' ');
    }

    get clicksLine(): string {
        return this.trendPoints.map(point => `${point.x},${point.clicksY}`).join(' ');
    }

    get trendArea(): string {
        if (!this.trendPoints.length) return '';
        return `20,210 ${this.trendLine} 980,210`;
    }

    get chartLabels(): { x: number; label: string }[] {
        const points = this.trendPoints;
        if (points.length <= 6) return points;
        const step = Math.ceil(points.length / 6);
        return points.filter((_, index) => index % step === 0 || index === points.length - 1);
    }

    get analyticsClickCount(): number {
        const buttons = this.dashboard?.buttons;
        return (buttons?.ticketClicks.last30Days ?? 0) +
               (buttons?.contactClicks.last30Days ?? 0) +
               (buttons?.notificationLinkClicks.last30Days ?? 0);
    }

    get popularContent(): { title: string; type: string; views: number; icon: string; link: any[] }[] {
        const items = [
            ...((this.dashboard?.chords.topSongs ?? []).map(item => ({ title: item.songTitle, type: 'אקורדים', views: item.views, icon: 'music_note', link: ['/admin/content/songs'] }))),
            ...((this.dashboard?.events.topEvents ?? []).map(item => ({ title: item.eventName, type: 'הופעה', views: item.viewsLast30, icon: 'event', link: ['/admin/content/events'] }))),
            ...((this.dashboard?.podcasts.topEpisodes ?? []).map(item => ({ title: item.episodeTitle, type: 'פודקאסט', views: item.views, icon: 'podcasts', link: ['/admin/content/podcasts/episodes/edit', item.episodeId] }))),
            { title: 'כתבות ותוכן מגזין', type: 'כתבות', views: this.dashboard?.articles.viewsLast30Days ?? 0, icon: 'article', link: ['/admin/content/articles'] }
        ];
        return items.filter(item => item.views > 0).sort((a, b) => b.views - a.views).slice(0, 4);
    }

    get popularPeriodLabel(): string {
        return this.selectedAnalyticsPeriod === 'day' ? 'ב־24 השעות האחרונות' : this.selectedAnalyticsPeriod === 'week' ? 'בשבוע האחרון' : 'בחודש האחרון';
    }

    get userJoinBuckets(): { label: string; count: number }[] {
        const bucketCount = this.selectedUserPeriod === 'day' ? 12 : this.selectedUserPeriod === 'week' ? 7 : 10;
        const start = this.periodCutoff(this.selectedUserPeriod).getTime();
        const end = Date.now();
        const bucketSize = (end - start) / bucketCount;
        const buckets = Array.from({ length: bucketCount }, (_, index) => ({
            label: this.selectedUserPeriod === 'day'
                ? new Date(start + index * bucketSize).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                : new Date(start + index * bucketSize).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
            count: 0
        }));

        this.filteredRecentUsers.forEach(user => {
            const created = new Date(user.createdAt).getTime();
            const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((created - start) / bucketSize)));
            buckets[index].count++;
        });

        return buckets;
    }

    joinBarHeight(count: number): number {
        const maxCount = Math.max(1, ...this.userJoinBuckets.map(bucket => bucket.count));
        return count ? 16 + (count / maxCount) * 84 : 4;
    }

    get periodOptions(): { key: PeriodKey; label: string }[] {
        return [
            { key: 'day', label: '24 שעות' },
            { key: 'week', label: 'שבוע' },
            { key: 'month', label: 'חודש' }
        ];
    }

    get filteredRecentUsers(): UserListDto[] {
        const cutoff = this.periodCutoff(this.selectedUserPeriod);
        return this.recentUsers
            .filter(user => new Date(user.createdAt).getTime() >= cutoff.getTime());
    }

    get recentJoinCount(): number {
        return this.filteredRecentUsers.length;
    }

    get joinedLastDayCount(): number {
        return this.joinedLastDay;
    }

    get joinedLastWeekCount(): number {
        return this.joinedLastWeek;
    }

    get displayedRecentUsers(): UserListDto[] {
        return this.filteredRecentUsers.slice(0, 12);
    }

    get recentActiveUsersCount(): number {
        return this.filteredRecentUsers.filter(user => user.isActive).length;
    }

    get recentProfileUsersCount(): number {
        return this.filteredRecentUsers.filter(user => user.roleName === 'Teacher' || user.roleName === 'Artist').length;
    }

    get analyticsViews(): number {
        if (!this.dashboard) return 0;
        return (this.dashboard.events?.listPageViews?.last30Days ?? 0) +
               (this.dashboard.articles?.viewsLast30Days ?? 0);
    }

    get topArticles(): { title: string; views: number }[] {
        return [
            { title: 'כתבות תוכן', views: this.dashboard?.articles?.viewsLast30Days ?? 0 },
            ...((this.dashboard?.events?.topEvents ?? [])
                .slice(0, 2)
                .map(event => ({ title: event.eventName, views: event.viewsLast30 })))
        ].filter(item => item.views > 0).slice(0, 3);
    }

    get popularPages(): { title: string; value: number }[] {
        return [
            { title: 'עמוד הופעות', value: this.dashboard?.events?.listPageViews?.last30Days ?? 0 },
            ...((this.dashboard?.adBlock?.topPages ?? [])
                .slice(0, 3)
                .map(page => ({ title: page.pagePath, value: page.checks })))
        ].filter(item => item.value > 0).slice(0, 4);
    }

    constructor(
        private analyticsService: AnalyticsService,
        private reportService: ReportService,
        private userService: UserService,
        private teacherService: TeacherService,
        private serviceProviderService: MusicServiceProviderService,
        private artistService: ArtistService,
        private songService: SongService,
        private articleService: AdminArticleService,
        private eventService: AdminEventService,
        private podcastService: PodcastService
    ) {}

    ngOnInit(): void {
        this.loadAll();
    }

    loadAll(): void {
        this.today = new Date();
        this.loadUserMetrics();
        this.loadUsers();
        this.loadReports();
        this.loadAnalytics();
        this.loadApprovals();
        this.loadContentQueue();
    }

    private loadUsers(): void {
        this.usersLoading = true;
        this.loadRecentUsersWindow()
            .pipe(
                catchError(() => of({ totalCount: 0, users: [] as UserListDto[] })),
                finalize(() => this.usersLoading = false)
            )
            .subscribe(result => {
                this.totalUsers = result.totalCount;
                this.recentUsers = result.users;
            });
    }

    private loadUserMetrics(): void {
        this.userMetricsLoading = true;
        this.userService.getDashboardSummary()
            .pipe(
                catchError(() => of({ totalUsers: 0, joinedLastDay: 0, joinedLastWeek: 0 })),
                finalize(() => this.userMetricsLoading = false)
            )
            .subscribe(summary => {
                this.totalUsers = summary.totalUsers;
                this.joinedLastDay = summary.joinedLastDay;
                this.joinedLastWeek = summary.joinedLastWeek;
            });
    }

    private loadReports(): void {
        this.reportsLoading = true;
        this.reportService.getReports(1, 6, 'Pending')
            .pipe(
                catchError(() => of(null)),
                finalize(() => this.reportsLoading = false)
            )
            .subscribe(reports => {
                this.pendingReportsCount = reports?.totalCount ?? 0;
                this.pendingReports = reports?.items?.slice(0, 6) ?? [];
            });
    }

    private loadAnalytics(): void {
        this.analyticsLoading = true;
        const analyticsFrom = this.isoDate(this.periodCutoff(this.selectedAnalyticsPeriod));
        const analyticsTo = this.isoDate(new Date());
        this.analyticsService.getDashboard(analyticsFrom, analyticsTo)
            .pipe(
                catchError(() => of(null)),
                finalize(() => this.analyticsLoading = false)
            )
            .subscribe(dashboard => this.dashboard = dashboard);
    }

    private loadApprovals(): void {
        this.approvalsLoading = true;
        forkJoin({
            teachers: this.teacherService
                .getTeachers(undefined, undefined, 0, undefined, 1, 4)
                .pipe(catchError(() => of(null))),
            providers: this.serviceProviderService
                .getServiceProviders(undefined, undefined, undefined, 0, undefined, undefined, 1, 4)
                .pipe(catchError(() => of(null))),
            artists: this.artistService
                .getArtists(undefined, ArtistStatus.Pending, 1, 4)
                .pipe(catchError(() => of(null)))
        }).pipe(finalize(() => this.approvalsLoading = false)).subscribe(({ teachers, providers, artists }) => {
            this.pendingTeachersCount = teachers?.totalCount ?? 0;
            this.pendingTeachers = teachers?.items?.slice(0, 4) ?? [];
            this.pendingServiceProvidersCount = providers?.totalCount ?? 0;
            this.pendingServiceProviders = providers?.items?.slice(0, 4) ?? [];
            this.pendingArtistsCount = artists?.totalCount ?? 0;
            this.pendingArtists = artists?.items?.slice(0, 4) ?? [];
        });
    }

    private loadContentQueue(): void {
        this.contentLoading = true;
        forkJoin({
            songs: this.songService
                .getSongsForAdmin(undefined, 1, 4, undefined, undefined, undefined, 'date', undefined, undefined, undefined, undefined, false)
                .pipe(catchError(() => of(null))),
            draftArticles: this.articleService
                .getArticles(1, 4, undefined, undefined, ArticleContentType.Blog, ArticleStatus.Draft, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'date')
                .pipe(catchError(() => of(null))),
            draftNews: this.articleService
                .getArticles(1, 4, undefined, undefined, ArticleContentType.News, ArticleStatus.Draft, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'date')
                .pipe(catchError(() => of(null))),
            draftEvents: this.eventService
                .getEvents(1, 4, undefined, false, undefined, undefined, undefined, undefined, undefined, undefined, 'date')
                .pipe(catchError(() => of(null))),
            draftEpisodes: this.podcastService
                .getEpisodes(1, 4, undefined, undefined, false, undefined, undefined, 'date')
                .pipe(catchError(() => of(null)))
        }).pipe(finalize(() => this.contentLoading = false)).subscribe(({ songs, draftArticles, draftNews, draftEvents, draftEpisodes }) => {
            this.pendingSongs = (songs?.songs ?? songs?.items ?? songs?.data ?? []).slice(0, 4);
            this.pendingSongsCount = songs?.totalCount ?? songs?.total ?? this.pendingSongs.length;
            this.draftArticlesCount = draftArticles?.totalCount ?? 0;
            this.draftArticles = draftArticles?.items?.slice(0, 4) ?? [];
            this.draftNewsCount = draftNews?.totalCount ?? 0;
            this.draftNews = draftNews?.items?.slice(0, 4) ?? [];
            this.draftEventsCount = draftEvents?.totalCount ?? 0;
            this.draftEvents = draftEvents?.items?.slice(0, 4) ?? [];
            this.draftPodcastEpisodesCount = draftEpisodes?.totalCount ?? 0;
            this.draftPodcastEpisodes = draftEpisodes?.items?.slice(0, 4) ?? [];
        });
    }

    setUserPeriod(period: PeriodKey): void {
        this.selectedUserPeriod = period;
    }

    setAnalyticsPeriod(period: PeriodKey): void {
        this.selectedAnalyticsPeriod = period;
        this.loadAnalytics();
    }

    private loadRecentUsersWindow() {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 60);
        const pageSize = 100;

        return this.userService.getUsers(undefined, undefined, undefined, 1, pageSize, undefined, undefined, 'created_desc').pipe(
            expand(result => {
                const items = result.items ?? [];
                const lastUser = items[items.length - 1];
                const loadedCount = result.pageNumber * result.pageSize;
                const shouldLoadMore = !!lastUser &&
                    loadedCount < result.totalCount &&
                    new Date(lastUser.createdAt).getTime() >= cutoff.getTime();

                if (!shouldLoadMore) return EMPTY;

                return this.userService.getUsers(
                    undefined,
                    undefined,
                    undefined,
                    result.pageNumber + 1,
                    pageSize,
                    undefined,
                    undefined,
                    'created_desc'
                );
            }),
            reduce((accumulator, result) => ({
                totalCount: result.totalCount,
                users: accumulator.users.concat(result.items ?? [])
            }), { totalCount: 0, users: [] as UserListDto[] }),
            map(result => ({
                totalCount: result.totalCount,
                users: result.users.filter(user => new Date(user.createdAt).getTime() >= cutoff.getTime())
            }))
        );
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

    profileName(item: any): string {
        return item?.fullName || item?.name || item?.stageName || item?.artistName || item?.displayName || 'פרופיל ללא שם';
    }

    contentDate(item: any): string {
        return item?.createdAt || item?.publishDate || item?.publishedAt || item?.eventDate || this.today;
    }

    private periodCutoff(period: PeriodKey): Date {
        const date = new Date();
        const days = this.periodDays(period);
        date.setDate(date.getDate() - days);
        return date;
    }

    private periodDays(period: PeriodKey): number {
        return period === 'day' ? 1 : period === 'week' ? 7 : 30;
    }

    private isoDate(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    reportTypeLabel(t: string): string {
        const map: Record<string, string> = {
            ContentError: 'טעות בתוכן',
            InappropriateContent: 'תוכן לא ראוי',
            Other: 'אחר',
            ChordRequest: 'בקשת אקורדים',
            NewArtist: 'אמן חדש',
            NewGenre: 'ז\'אנר שירים',
            NewTag: 'תגיות שירים',
            NewPerson: 'מלחין חדש'
        };
        return map[t] ?? t;
    }

    get userCount(): number { return this.totalUsers; }
    get articlesViews30(): number { return this.dashboard?.articles?.viewsLast30Days ?? 0; }
    get activeCampaigns(): number { return this.dashboard?.ads?.activeCampaigns ?? 0; }
}
