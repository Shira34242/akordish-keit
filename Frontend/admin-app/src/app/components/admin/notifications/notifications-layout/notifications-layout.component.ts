import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, RouterModule, RouterOutlet, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

interface LayoutState {
  title: string;
  subtitle: string;
  actionLabel?: string;
}

@Component({
  selector: 'app-admin-notifications-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './notifications-layout.component.html',
  styleUrls: ['./notifications-layout.component.css']
})
export class AdminNotificationsLayoutComponent {
  state: LayoutState;

  constructor(private router: Router) {
    this.state = this.getState(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.state = this.getState(event.urlAfterRedirects);
      });
  }

  private getState(url: string): LayoutState {
    if (url.includes('/notifications/reports')) {
      return {
        title: 'דוחות התראות',
        subtitle: 'פתיחות ולחיצות בשליחות לקבוצות ולכל המשתמשים.'
      };
    }

    if (url.includes('/notifications/email')) {
      return {
        title: 'מיילים',
        subtitle: 'שליחת מיילים לקבוצות משתמשים מתוך אזור ההתראות.'
      };
    }

    return {
      title: 'צ׳אטים וקבוצות',
      subtitle: 'ניהול הודעות אישיות וקבוצתיות במבנה קל ונקי.'
    };
  }
}
