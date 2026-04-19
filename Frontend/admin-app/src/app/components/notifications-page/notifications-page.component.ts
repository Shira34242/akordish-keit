import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NotificationDto } from '../../models/notification.model';
import { NotificationService } from '../../services/notification.service';

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

  openNotification(notification: NotificationDto): void {
    const openAction = () => {
      if (notification.actionUrl) {
        this.router.navigateByUrl(notification.actionUrl);
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
}
