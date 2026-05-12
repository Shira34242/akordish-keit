import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ModalService } from '../../../../services/modal.service';

interface LayoutState {
    title: string;
    subtitle: string;
    actionLabel?: string;
}

@Component({
    selector: 'app-admin-content-layout',
    standalone: true,
    imports: [CommonModule, RouterModule, RouterOutlet],
    templateUrl: './content-layout.component.html',
    styleUrls: ['./content-layout.component.css']
})
export class AdminContentLayoutComponent {
    state: LayoutState;

    constructor(
        private router: Router,
        private modalService: ModalService
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

        if (url.includes('/content/songs')) {
            this.modalService.openAddSongModal();
            return;
        }

        if (url.includes('/content/articles')) {
            this.router.navigate(['/admin/content/articles/new'], { queryParams: { type: 'news' } });
            return;
        }

        if (url.includes('/content/events')) {
            this.router.navigate(['/admin/content/events/new']);
            return;
        }

        if (url.includes('/content/podcasts')) {
            this.router.navigate(['/admin/content/podcasts/episodes/new']);
        }
    }

    private getState(url: string): LayoutState {
        if (url.includes('/content/smart-add')) {
            return {
                title: 'הוספה חכמה',
                subtitle: 'מקום אחד להתחיל ממנו ייבוא אקורדים והוספה מהירה של תוכן.'
            };
        }

        if (url.includes('/content/articles')) {
            return {
                title: 'חדשות ובלוג',
                subtitle: 'כתבות, חדשות ופוסטים שמופיעים באזורי התוכן של האתר.',
                actionLabel: 'כתבה חדשה'
            };
        }

        if (url.includes('/content/featured')) {
            return {
                title: 'תוכן מרכזי',
                subtitle: 'בחירת התוכן המודגש שמופיע באזורים המרכזיים.'
            };
        }

        if (url.includes('/content/news-sections')) {
            return {
                title: 'פסי חדשות',
                subtitle: 'סידור מקטעי החדשות והפסים שמופיעים בעמודי התוכן.'
            };
        }

        if (url.includes('/content/ticker')) {
            return {
                title: 'פס חדשות הירו',
                subtitle: 'ניהול הפס הקצר שמופיע בחלק העליון של האתר.'
            };
        }

        if (url.includes('/content/events')) {
            return {
                title: 'הופעות',
                subtitle: 'ניהול הופעות קרובות, תאריכים, מיקומים וכרטיסים.',
                actionLabel: 'הופעה חדשה'
            };
        }

        if (url.includes('/content/podcasts')) {
            return {
                title: 'פודקאסטים',
                subtitle: 'ניהול סדרות ופרקים שמוטמעים באתר מקישורים חיצוניים.',
                actionLabel: 'פרק חדש'
            };
        }

        if (url.includes('/content/stats')) {
            return {
                title: 'סטטיסטיקות',
                subtitle: 'מבט מהיר על נתוני צפייה, שימוש ותוכן.'
            };
        }

        return {
            title: 'אקורדים',
            subtitle: 'כל השירים והאקורדים באתר.',
            actionLabel: 'שיר חדש'
        };
    }
}
