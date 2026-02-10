import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, UserStats, RecentJoin } from '../../../services/admin.service';

@Component({
    selector: 'app-admin-users',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-users.component.html',
    styleUrls: ['./admin-users.component.css']
})
export class AdminUsersComponent implements OnInit {
    activeTab: string = 'overview';

    stats: { label: string, value: number, icon: string, color: string }[] = [
        { label: 'משתמשים', value: 0, icon: '👥', color: 'blue' },
        { label: 'מנהלים', value: 0, icon: '🛡️', color: 'purple' },
        { label: 'מורים', value: 0, icon: '👨‍🏫', color: 'green' },
        { label: 'אמנים', value: 0, icon: '👨‍🎤', color: 'pink' }
    ];

    recentJoins: RecentJoin[] = [];

    constructor(private adminService: AdminService) { }

    ngOnInit() {
        this.loadStats();
        this.loadRecentJoins();
    }

    loadStats() {
        this.adminService.getUserStats().subscribe({
            next: (data: UserStats) => {
                this.stats = [
                    { label: 'משתמשים', value: data.totalUsers, icon: '👥', color: 'blue' },
                    { label: 'מנהלים', value: data.totalAdmins, icon: '🛡️', color: 'purple' },
                    { label: 'מורים', value: data.totalTeachers, icon: '👨‍🏫', color: 'green' },
                    { label: 'אמנים', value: data.totalArtists, icon: '👨‍🎤', color: 'pink' }
                ];
            },
            error: (err) => console.error('Failed to load stats', err)
        });
    }

    loadRecentJoins() {
        this.adminService.getRecentJoins().subscribe({
            next: (data: RecentJoin[]) => {
                this.recentJoins = data;
            },
            error: (err) => console.error('Failed to load recent joins', err)
        });
    }

    setActiveTab(tab: string) {
        this.activeTab = tab;
    }
}
