import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AdminUsersLayoutActionsService } from './users-layout-actions.service';

interface LayoutState {
    title: string;
    subtitle: string;
    actionLabel?: string;
}

@Component({
    selector: 'app-admin-users-layout',
    standalone: true,
    imports: [CommonModule, RouterModule, RouterOutlet],
    templateUrl: './users-layout.component.html',
    styleUrls: ['./users-layout.component.css']
})
export class AdminUsersLayoutComponent {
    state: LayoutState;

    constructor(
        private router: Router,
        private actions: AdminUsersLayoutActionsService
    ) {
        this.state = this.getState(this.router.url);
        this.router.events
            .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
            .subscribe(event => {
                this.state = this.getState(event.urlAfterRedirects);
            });
    }

    onPrimaryAction(): void {
        const url = this.router.url;

        if (url.includes('/users/teachers')) {
            this.router.navigate(['/admin/users/teachers/new']);
            return;
        }

        if (url.includes('/users/service-providers')) {
            this.router.navigate(['/admin/users/service-providers/new']);
            return;
        }

        if (url.includes('/users/artists')) {
            this.actions.requestAddArtist();
        }
    }

    private getState(url: string): LayoutState {
        if (url.includes('/users/teachers')) {
            return {
                title: 'מורים',
                subtitle: 'ניהול פרופילי מורים, סטטוס, מומלצים וקישור למשתמשים.',
                actionLabel: 'מורה חדש'
            };
        }

        if (url.includes('/users/service-providers')) {
            return {
                title: 'בעלי מקצוע',
                subtitle: 'ניהול אנשי מקצוע, קטגוריות, מיקומים וקישורים למשתמשים.',
                actionLabel: 'בעל מקצוע חדש'
            };
        }

        if (url.includes('/users/artists')) {
            return {
                title: 'אומנים',
                subtitle: 'ניהול אומנים, סטטוס תצוגה ופרופילי אמן.',
                actionLabel: 'אומן חדש'
            };
        }

        return {
            title: 'לקוחות',
            subtitle: 'רשימת המשתמשים הרגילים באתר, סטטוס ותפקידי משתמש.'
        };
    }
}
