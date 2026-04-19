export enum NotificationType {
  Submission = 0,
  Approval = 1,
  Rejection = 2,
  AdminMessage = 3,
  System = 4
}

export enum NotificationCategory {
  Song = 0,
  Article = 1,
  Event = 2,
  Teacher = 3,
  ServiceProvider = 4,
  Artist = 5,
  System = 6
}

export interface NotificationDto {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface CreateNotificationDto {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  actionUrl?: string | null;
}

export interface SendUserNotificationDto {
  userId: number;
  title: string;
  message: string;
  actionUrl?: string | null;
}

export interface UnreadNotificationCountDto {
  count: number;
}
