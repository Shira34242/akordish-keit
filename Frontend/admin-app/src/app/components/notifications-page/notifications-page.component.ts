import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NotificationDto } from '../../models/notification.model';
import { NotificationService } from '../../services/notification.service';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notifications-page.component.html',
  styleUrls: ['./notifications-page.component.css']
})
export class NotificationsPageComponent implements OnInit {
  notifications: NotificationDto[] = [];
  isLoading = true;
  errorMessage = '';

  private readonly analytics = inject(AnalyticsService);

  constructor(
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  get hasUnread(): boolean {
    return this.notifications.some(notification => !notification.isRead);
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.notificationService.getNotifications().subscribe({
      next: notifications => {
        this.notifications = notifications;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לטעון את ההתראות כרגע.';
        this.isLoading = false;
      }
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map(notification => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt ?? new Date().toISOString()
        }));
      }
    });
  }

  deleteAllNotifications(): void {
    this.notificationService.deleteAllNotifications().subscribe({
      next: () => {
        this.notifications = [];
      }
    });
  }

  onNotificationLinkClick(notification: NotificationDto): void {
    this.analytics.trackButtonClick('notification_link', notification.id, notification.title || notification.message?.slice(0, 50));
  }

  openNotification(notification: NotificationDto): void {
    const openAction = () => {
      if (notification.actionUrl) {
        this.analytics.trackButtonClick('notification_link', notification.id, notification.title || notification.message?.slice(0, 50));
        this.openActionUrl(notification.actionUrl);
      }
    };

    if (notification.isRead) {
      openAction();
      return;
    }

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
        openAction();
      },
      error: openAction
    });
  }

  deleteNotification(event: Event, notificationId: number): void {
    event.stopPropagation();

    this.notificationService.deleteNotification(notificationId).subscribe({
      next: () => {
        const deleted = this.notifications.find(notification => notification.id === notificationId);
        this.notifications = this.notifications.filter(notification => notification.id !== notificationId);
        if (deleted && !deleted.isRead) {
          this.notificationService.refreshUnreadCount();
        }
      }
    });
  }

  formatDate(dateValue: string): string {
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(dateValue));
  }

  shouldShowTitle(notification: NotificationDto): boolean {
    return notification.type !== 3
      && notification.type !== 6
      && !!notification.title
      && notification.title.trim() !== notification.message.trim();
  }

  getAttachmentIcon(type: string): string {
    switch (type) {
      case 'image':
        return 'image';
      case 'video':
        return 'smart_display';
      case 'file':
        return 'attach_file';
      default:
        return 'link';
    }
  }

  private openActionUrl(actionUrl: string): void {
    if (/^https?:\/\//i.test(actionUrl)) {
      window.open(actionUrl, '_blank', 'noopener');
      return;
    }

    this.router.navigateByUrl(actionUrl);
  }
}
