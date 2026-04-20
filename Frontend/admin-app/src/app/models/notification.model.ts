export enum NotificationType {
  Submission = 0,
  Approval = 1,
  Rejection = 2,
  AdminMessage = 3,
  System = 4,
  StatusUpdate = 5,
  Promotion = 6
}

export enum NotificationCategory {
  Song = 0,
  Article = 1,
  Event = 2,
  Teacher = 3,
  ServiceProvider = 4,
  Artist = 5,
  System = 6,
  Promotion = 7
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
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaThumbnailUrl?: string | null;
  mediaAltText?: string | null;
  attachments?: NotificationAttachmentDto[];
  campaignName?: string | null;
  audienceLabel?: string | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface NotificationAttachmentDto {
  type: 'link' | 'image' | 'video' | 'file' | string;
  url: string;
  label?: string | null;
  clickUrl?: string | null;
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
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaThumbnailUrl?: string | null;
  mediaAltText?: string | null;
  attachments?: NotificationAttachmentDto[] | null;
  campaignName?: string | null;
  audienceLabel?: string | null;
}

export interface SendUserNotificationDto {
  userId: number;
  title: string;
  message: string;
  actionUrl?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaThumbnailUrl?: string | null;
  mediaAltText?: string | null;
  attachments?: NotificationAttachmentDto[] | null;
  isMarketingContent?: boolean;
}

export interface SendStatusNotificationDto {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  actionUrl?: string | null;
}

export interface SendBroadcastNotificationDto {
  title: string;
  message: string;
  actionUrl?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaThumbnailUrl?: string | null;
  mediaAltText?: string | null;
  attachments?: NotificationAttachmentDto[] | null;
  campaignName?: string | null;
  isMarketingContent?: boolean;
  groupId?: number | null;
  sendToAll: boolean;
  userIds?: number[] | null;
  role?: number | null;
  isActive?: boolean | null;
  contentTag?: number | null;
  preferredInstrumentId?: number | null;
  joinedFrom?: string | null;
  joinedTo?: string | null;
  addressContains?: string | null;
}

export interface BroadcastNotificationResultDto {
  sentCount: number;
  audienceLabel: string;
}

export interface UnreadNotificationCountDto {
  count: number;
}

export interface NotificationGroupDto {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  sendToAll: boolean;
  role?: number | null;
  isActive?: boolean | null;
  contentTag?: number | null;
  preferredInstrumentId?: number | null;
  joinedFrom?: string | null;
  joinedTo?: string | null;
  addressContains?: string | null;
  memberUserIds?: number[] | null;
  estimatedUserCount: number;
  createdAt: string;
}

export interface SaveNotificationGroupDto {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  sendToAll: boolean;
  role?: number | null;
  isActive?: boolean | null;
  contentTag?: number | null;
  preferredInstrumentId?: number | null;
  joinedFrom?: string | null;
  joinedTo?: string | null;
  addressContains?: string | null;
  memberUserIds?: number[] | null;
}
