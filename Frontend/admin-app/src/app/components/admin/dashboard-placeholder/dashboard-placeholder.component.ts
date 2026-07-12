import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EMPTY, forkJoin, of } from 'rxjs';
import { catchError, expand, map, reduce } from 'rxjs/operators';
import { AdminService, UserStats } from '../../../services/admin.service';
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
    selectedUserPeriod: PeriodKey = 'day';
    selectedAnalyticsPeriod: PeriodKey = 'day';

    userStats: UserStats | null = null;
    recentUsers: UserListDto[] = [];
    dashboard: AnalyticsDashboard | null = null;

    pendingReportsCount = 0;
    pendingReports: Report[] = [];
    chordRequestsCount = 0;
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
        private adminService: AdminService,
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
        this.loading = true;
        const analyticsFrom = this.isoDate(this.periodCutoff(this.selectedAnalyticsPeriod));
        const analyticsTo = this.isoDate(new Date());
        forkJoin({
            stats: this.adminService.getUserStats().pipe(catchError(() => of(null))),
            users: this.loadRecentUsersWindow().pipe(catchError(() => of([]))),
            dash: this.analyticsService.getDashboard(analyticsFrom, analyticsTo).pipe(catchError(() => of(null))),
            reports: this.reportService.getReports(1, 6, 'Pending').pipe(catchError(() => of(null))),
            chordReqs: this.reportService.getChordRequests(1, 1).pipe(catchError(() => of(null))),
            teachers: this.teacherService
                .getTeachers(undefined, undefined, 0, undefined, 1, 4)
                .pipe(catchError(() => of(null))),
            providers: this.serviceProviderService
                .getServiceProviders(undefined, undefined, undefined, 0, undefined, undefined, 1, 4)
                .pipe(catchError(() => of(null))),
            artists: this.artistService
                .getArtists(undefined, ArtistStatus.Pending, 1, 4)
                .pipe(catchError(() => of(null))),
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
        }).subscribe(({ stats, users, dash, reports, chordReqs, teachers, providers, artists, songs, draftArticles, draftNews, draftEvents, draftEpisodes }) => {
            this.userStats = stats;
            this.recentUsers = users as UserListDto[];
            this.dashboard = dash;

            this.pendingReportsCount = reports?.totalCount ?? 0;
            this.pendingReports = reports?.items?.slice(0, 6) ?? [];
            this.chordRequestsCount = chordReqs?.totalCount ?? 0;
            this.pendingTeachersCount = teachers?.totalCount ?? 0;
            this.pendingTeachers = teachers?.items?.slice(0, 4) ?? [];
            this.pendingServiceProvidersCount = providers?.totalCount ?? 0;
            this.pendingServiceProviders = providers?.items?.slice(0, 4) ?? [];
            this.pendingArtistsCount = artists?.totalCount ?? 0;
            this.pendingArtists = artists?.items?.slice(0, 4) ?? [];
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

            this.loading = false;
            this.today = new Date();
        });
    }

    setUserPeriod(period: PeriodKey): void {
        this.selectedUserPeriod = period;
    }

    setAnalyticsPeriod(period: PeriodKey): void {
        this.selectedAnalyticsPeriod = period;
        this.loadAll();
    }

    private loadRecentUsersWindow() {
        const cutoff = this.periodCutoff('month');
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
            reduce((users, result) => users.concat(result.items ?? []), [] as UserListDto[]),
            map(users => users.filter(user => new Date(user.createdAt).getTime() >= cutoff.getTime()))
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
        const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
        date.setDate(date.getDate() - days);
        return date;
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

    get userCount(): number { return this.userStats?.totalUsers ?? 0; }
    get articlesViews30(): number { return this.dashboard?.articles?.viewsLast30Days ?? 0; }
    get activeCampaigns(): number { return this.dashboard?.ads?.activeCampaigns ?? 0; }
}
