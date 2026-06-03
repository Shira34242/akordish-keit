import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminService, UserStats, RecentJoin } from '../../../services/admin.service';
import { AnalyticsService, AnalyticsDashboard } from '../../../services/analytics.service';
import { ReportService } from '../../../services/report.service';
import { Report } from '../../../models/report.model';
import { TeacherService } from '../../../services/teacher.service';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { ArtistService } from '../../../services/artist.service';
import { SongService } from '../../../services/song.service';
import { ArtistStatus } from '../../../models/artist.model';

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
    recentJoins: RecentJoin[] = [];
    dashboard: AnalyticsDashboard | null = null;

    pendingReportsCount = 0;
    pendingReports: Report[] = [];
    chordRequestsCount = 0;
    pendingTeachersCount = 0;
    pendingServiceProvidersCount = 0;
    pendingArtistsCount = 0;
    pendingSongsCount = 0;

    get totalPendingApprovals(): number {
        return this.pendingTeachersCount +
               this.pendingServiceProvidersCount +
               this.pendingArtistsCount +
               this.pendingSongsCount;
    }

    constructor(
        private adminService: AdminService,
        private analyticsService: AnalyticsService,
        private reportService: ReportService,
        private teacherService: TeacherService,
        private serviceProviderService: MusicServiceProviderService,
        private artistService: ArtistService,
        private songService: SongService
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
            reports: this.reportService.getReports(1, 6, 'Pending').pipe(catchError(() => of(null))),
            chordReqs: this.reportService.getChordRequests(1, 1).pipe(catchError(() => of(null))),
            teachers: this.teacherService
                .getTeachers(undefined, undefined, 0, undefined, 1, 1)
                .pipe(catchError(() => of(null))),
            providers: this.serviceProviderService
                .getServiceProviders(undefined, undefined, undefined, 0, undefined, undefined, 1, 1)
                .pipe(catchError(() => of(null))),
            artists: this.artistService
                .getArtists(undefined, ArtistStatus.Pending, 1, 1)
                .pipe(catchError(() => of(null))),
            songs: this.songService
                .getSongs(undefined, 1, 50, undefined, undefined, undefined, 'date')
                .pipe(catchError(() => of(null)))
        }).subscribe(({ stats, joins, dash, reports, chordReqs, teachers, providers, artists, songs }) => {
            this.userStats = stats;
            this.recentJoins = joins as RecentJoin[];
            this.dashboard = dash;

            this.pendingReportsCount = reports?.totalCount ?? 0;
            this.pendingReports = reports?.items?.slice(0, 6) ?? [];
            this.chordRequestsCount = chordReqs?.totalCount ?? 0;
            this.pendingTeachersCount = teachers?.totalCount ?? 0;
            this.pendingServiceProvidersCount = providers?.totalCount ?? 0;
            this.pendingArtistsCount = artists?.totalCount ?? 0;
            this.pendingSongsCount = (songs?.items ?? []).filter((s: any) => !s.isApproved).length;

            this.loading = false;
            this.today = new Date();
        });
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
