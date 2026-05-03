import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import {
  BroadcastNotificationResultDto,
  NotificationGroupDto,
  NotificationDto,
  SaveNotificationGroupDto,
  SendBroadcastNotificationDto,
  SendStatusNotificationDto,
  SendUserNotificationDto,
  UnreadNotificationCountDto
} from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = `${environment.apiBaseUrl}/api/notifications`;
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

  deleteAllNotifications(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/all`, { withCredentials: true }).pipe(
      tap(() => this.unreadCountSubject.next(0))
    );
  }

  sendUserMessage(payload: SendUserNotificationDto): Observable<NotificationDto> {
    return this.http.post<NotificationDto>(`${this.apiUrl}/admin/send-user-message`, payload, { withCredentials: true });
  }

  sendStatusUpdate(payload: SendStatusNotificationDto): Observable<NotificationDto> {
    return this.http.post<NotificationDto>(`${this.apiUrl}/admin/send-status-update`, payload, { withCredentials: true });
  }

  sendBroadcast(payload: SendBroadcastNotificationDto): Observable<BroadcastNotificationResultDto> {
    return this.http.post<BroadcastNotificationResultDto>(`${this.apiUrl}/admin/send-broadcast`, payload, { withCredentials: true });
  }

  getUserNotificationsForAdmin(userId: number): Observable<NotificationDto[]> {
    return this.http.get<NotificationDto[]>(`${this.apiUrl}/admin/user/${userId}`, { withCredentials: true });
  }

  getNotificationGroups(): Observable<NotificationGroupDto[]> {
    return this.http.get<NotificationGroupDto[]>(`${this.apiUrl}/admin/groups`, { withCredentials: true });
  }

  createNotificationGroup(payload: SaveNotificationGroupDto): Observable<NotificationGroupDto> {
    return this.http.post<NotificationGroupDto>(`${this.apiUrl}/admin/groups`, payload, { withCredentials: true });
  }

  updateNotificationGroup(id: number, payload: SaveNotificationGroupDto): Observable<NotificationGroupDto> {
    return this.http.put<NotificationGroupDto>(`${this.apiUrl}/admin/groups/${id}`, payload, { withCredentials: true });
  }

  deleteNotificationGroup(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/groups/${id}`, { withCredentials: true });
  }
}
