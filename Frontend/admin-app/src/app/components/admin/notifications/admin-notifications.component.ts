import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationDto } from '../../../models/notification.model';
import { UserListDto } from '../../../models/user.model';
import { NotificationService } from '../../../services/notification.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.css']
})
export class AdminNotificationsComponent implements OnInit {
  users: UserListDto[] = [];
  selectedUser: UserListDto | null = null;
  selectedUserId: number | null = null;
  threadNotifications: NotificationDto[] = [];
  searchTerm = '';
  contentTagFilter: number | null = null;
  instrumentFilter: number | null = null;
  activityFilter: 'all' | 'active' | 'inactive' = 'all';
  sortMode: 'newest' | 'oldest' = 'newest';
  title = '';
  message = '';
  actionUrl = '';
  totalUsers = 0;
  pageNumber = 1;
  pageSize = 30;
  isLoadingUsers = false;
  isLoadingThread = false;
  isSending = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private userService: UserService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  get selectedUserTitle(): string {
    return this.selectedUser?.username ?? 'בחר משתמש';
  }

  get availableInstruments(): Array<{ id: number; name: string }> {
    const instruments = new Map<number, string>();
    this.users.forEach(user => {
      if (user.preferredInstrumentId && user.preferredInstrumentName) {
        instruments.set(user.preferredInstrumentId, user.preferredInstrumentName);
      }
    });

    return Array.from(instruments.entries()).map(([id, name]) => ({ id, name }));
  }

  get visibleUsers(): UserListDto[] {
    const sorted = [...this.users];
    sorted.sort((a, b) => {
      const first = new Date(a.createdAt).getTime();
      const second = new Date(b.createdAt).getTime();
      return this.sortMode === 'newest' ? second - first : first - second;
    });
    return sorted;
  }

  loadUsers(): void {
    this.isLoadingUsers = true;
    this.errorMessage = '';
    this.successMessage = '';

    const isActive =
      this.activityFilter === 'active'
        ? true
        : this.activityFilter === 'inactive'
          ? false
          : undefined;

    this.userService.getUsers(
      this.searchTerm || undefined,
      undefined,
      isActive,
      this.pageNumber,
      this.pageSize,
      this.contentTagFilter ?? undefined,
      this.instrumentFilter ?? undefined
    ).subscribe({
      next: result => {
        this.users = result.items;
        this.totalUsers = result.totalCount;
        this.isLoadingUsers = false;
        if (!this.selectedUser && this.users.length > 0) {
          this.selectUser(this.users[0]);
        }
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לטעון משתמשים. כדאי לבדוק שהבקאנד רץ ושהמשתמש מחובר כמנהל.';
        this.isLoadingUsers = false;
      }
    });
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.selectedUser = null;
    this.selectedUserId = null;
    this.threadNotifications = [];
    this.loadUsers();
  }

  selectUser(user: UserListDto): void {
    this.selectedUser = user;
    this.selectedUserId = user.id;
    this.successMessage = '';
    this.errorMessage = '';
    this.loadThread(user.id);
  }

  loadThread(userId: number): void {
    this.isLoadingThread = true;

    this.notificationService.getUserNotificationsForAdmin(userId).subscribe({
      next: notifications => {
        this.threadNotifications = notifications.reverse();
        this.isLoadingThread = false;
      },
      error: () => {
        this.threadNotifications = [];
        this.isLoadingThread = false;
      }
    });
  }

  nextPage(): void {
    if (this.pageNumber * this.pageSize >= this.totalUsers) return;
    this.pageNumber++;
    this.loadUsers();
  }

  previousPage(): void {
    if (this.pageNumber === 1) return;
    this.pageNumber--;
    this.loadUsers();
  }

  sendMessage(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.selectedUserId || !this.title.trim() || !this.message.trim()) {
      this.errorMessage = 'צריך לבחור משתמש ולמלא כותרת והודעה.';
      return;
    }

    this.isSending = true;

    this.notificationService.sendUserMessage({
      userId: this.selectedUserId,
      title: this.title.trim(),
      message: this.message.trim(),
      actionUrl: this.actionUrl.trim() || null
    }).subscribe({
      next: () => {
        this.successMessage = 'ההודעה נשלחה למשתמש.';
        if (this.selectedUserId) {
          this.loadThread(this.selectedUserId);
        }
        this.title = '';
        this.message = '';
        this.actionUrl = '';
        this.isSending = false;
      },
      error: err => {
        this.errorMessage = err?.message || err?.error?.message || 'שליחת ההודעה נכשלה.';
        this.isSending = false;
      }
    });
  }

  formatDate(dateValue: string): string {
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(dateValue));
  }

  getContentTagLabel(contentTag: number): string {
    switch (contentTag) {
      case 1:
        return 'מתחיל';
      case 2:
        return 'תורם';
      case 3:
        return 'תורם מוביל';
      default:
        return 'רגיל';
    }
  }
}
