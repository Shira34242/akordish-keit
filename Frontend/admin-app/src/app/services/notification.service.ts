import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import {
  NotificationDto,
  SendUserNotificationDto,
  UnreadNotificationCountDto
} from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'https://localhost:44395/api/notifications';
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  getNotifications(): Observable<NotificationDto[]> {
    return this.http.get<NotificationDto[]>(this.apiUrl, { withCredentials: true });
  }

  getUnreadCount(): Observable<UnreadNotificationCountDto> {
    return this.http.get<UnreadNotificationCountDto>(`${this.apiUrl}/unread-count`, { withCredentials: true });
  }

  refreshUnreadCount(): void {
    this.getUnreadCount().subscribe({
      next: result => this.unreadCountSubject.next(result.count),
      error: () => this.unreadCountSubject.next(0)
    });
  }

  clearUnreadCount(): void {
    this.unreadCountSubject.next(0);
  }

  markAsRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/read`, {}, { withCredentials: true }).pipe(
      tap(() => this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1)))
    );
  }

  markAllAsRead(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/read-all`, {}, { withCredentials: true }).pipe(
      tap(() => this.unreadCountSubject.next(0))
    );
  }

  deleteNotification(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  sendUserMessage(payload: SendUserNotificationDto): Observable<NotificationDto> {
    return this.http.post<NotificationDto>(`${this.apiUrl}/admin/send-user-message`, payload, { withCredentials: true });
  }

  getUserNotificationsForAdmin(userId: number): Observable<NotificationDto[]> {
    return this.http.get<NotificationDto[]>(`${this.apiUrl}/admin/user/${userId}`, { withCredentials: true });
  }
}
