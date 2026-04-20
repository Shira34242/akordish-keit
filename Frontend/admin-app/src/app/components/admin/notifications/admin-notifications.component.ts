import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationAttachmentDto, NotificationDto, NotificationGroupDto, SaveNotificationGroupDto } from '../../../models/notification.model';
import { UserListDto } from '../../../models/user.model';
import { MediaService } from '../../../services/admin/media.service';
import { NotificationService } from '../../../services/notification.service';
import { UserService } from '../../../services/user.service';

type ComposerMode = 'private' | 'group';
type SidebarMode = 'chats' | 'groups';
type AttachmentType = 'link' | 'image' | 'video' | 'file';
type AttachmentInputMode = 'url' | 'upload';

interface MessageDraft {
  message: string;
  actionUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'file' | '';
  mediaAltText: string;
  attachments: NotificationAttachmentDto[];
  isMarketingContent: boolean;
  campaignName: string;
}

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.css']
})
export class AdminNotificationsComponent implements OnInit {
  users: UserListDto[] = [];
  groups: NotificationGroupDto[] = [];
  selectedUser: UserListDto | null = null;
  selectedUserId: number | null = null;
  selectedGroup: NotificationGroupDto | null = null;
  threadNotifications: NotificationDto[] = [];
  sidebarMode: SidebarMode = 'chats';
  composerMode: ComposerMode = 'private';
  searchTerm = '';
  isSearchOpen = false;
  contentTagFilter: number | null = null;
  instrumentFilter: number | null = null;
  activityFilter: 'all' | 'active' | 'inactive' = 'all';
  roleFilter: number | null = null;
  sortMode: 'newest' | 'oldest' = 'newest';
  message = '';
  actionUrl = '';
  mediaUrl = '';
  mediaType: 'image' | 'video' | 'file' | '' = '';
  mediaAltText = '';
  attachments: NotificationAttachmentDto[] = [];
  attachmentLabel = '';
  attachmentClickUrl = '';
  isMarketingContent = false;
  campaignName = '';
  totalUsers = 0;
  pageNumber = 1;
  pageSize = 30;
  isLoadingUsers = false;
  isLoadingGroups = false;
  isLoadingThread = false;
  isSending = false;
  isUploadingAttachment = false;
  isUploadingGroupImage = false;
  isSavingGroup = false;
  showAttachMenu = false;
  showAttachPanel = false;
  attachmentType: AttachmentType | null = null;
  attachmentInputMode: AttachmentInputMode = 'url';
  selectedFileName = '';
  selectedGroupImageFileName = '';
  showGroupImageOptions = false;
  groupImageUrlDraft = '';
  showGroupForm = false;
  editingGroupId: number | null = null;
  groupForm: SaveNotificationGroupDto = this.createEmptyGroupForm();
  groupMemberIds = new Set<number>();
  successMessage = '';
  errorMessage = '';

  private drafts: Record<string, MessageDraft> = {};

  constructor(
    private userService: UserService,
    private notificationService: NotificationService,
    private mediaService: MediaService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadGroups();
  }

  get hasSelectedTarget(): boolean {
    return this.composerMode === 'group' ? !!this.selectedGroup : !!this.selectedUser;
  }

  get activeTargetKey(): string {
    return this.composerMode === 'group' ? `group-${this.selectedGroup?.id ?? 'none'}` : `user-${this.selectedUserId ?? 'none'}`;
  }

  get activeTargetTitle(): string {
    return this.composerMode === 'group' ? this.selectedGroup?.name ?? 'קבוצה' : this.selectedUser?.username ?? 'בחר משתמש';
  }

  get activeTargetSubtitle(): string {
    if (this.composerMode === 'group') {
      return `${this.selectedGroup?.estimatedUserCount ?? 0} חברים · ${this.selectedGroup?.description || 'קבוצת התראות למנהלים'}`;
    }

    if (!this.selectedUser) {
      return 'בחר משתמש כדי לפתוח שיחה';
    }

    return this.selectedUser.email;
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

  get visibleGroups(): NotificationGroupDto[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.groups;

    return this.groups.filter(group =>
      group.name.toLowerCase().includes(term) ||
      (group.description || '').toLowerCase().includes(term)
    );
  }

  get selectedGroupMembersCount(): number {
    return this.groupMemberIds.size;
  }

  loadUsers(): void {
    this.isLoadingUsers = true;
    this.errorMessage = '';

    const isActive =
      this.activityFilter === 'active'
        ? true
        : this.activityFilter === 'inactive'
          ? false
          : undefined;

    this.userService.getUsers(
      this.searchTerm || undefined,
      this.roleFilter ?? undefined,
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
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לטעון משתמשים. בדוק שהבקאנד רץ ושהמשתמש מחובר כמנהל.';
        this.isLoadingUsers = false;
      }
    });
  }

  loadGroups(): void {
    this.isLoadingGroups = true;
    this.notificationService.getNotificationGroups().subscribe({
      next: groups => {
        this.groups = groups;
        this.isLoadingGroups = false;
      },
      error: () => {
        this.isLoadingGroups = false;
      }
    });
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.loadUsers();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.activityFilter = 'all';
    this.instrumentFilter = null;
    this.roleFilter = null;
    this.contentTagFilter = null;
    this.sortMode = 'newest';
    this.pageNumber = 1;
    this.loadUsers();
  }

  switchSidebarMode(mode: SidebarMode): void {
    this.sidebarMode = mode;
    this.closeAttachUi();
  }

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
    if (!this.isSearchOpen && this.searchTerm) {
      this.searchTerm = '';
      this.applyFilters();
    }
  }

  selectUser(user: UserListDto): void {
    this.saveCurrentDraft();
    this.composerMode = 'private';
    this.selectedUser = user;
    this.selectedUserId = user.id;
    this.selectedGroup = null;
    this.successMessage = '';
    this.errorMessage = '';
    this.closeAttachUi();
    this.loadDraft();
    this.loadThread(user.id);
  }

  selectGroup(group: NotificationGroupDto): void {
    this.saveCurrentDraft();
    this.composerMode = 'group';
    this.selectedGroup = group;
    this.selectedUser = null;
    this.selectedUserId = null;
    this.threadNotifications = [];
    this.successMessage = '';
    this.errorMessage = '';
    this.closeAttachUi();
    this.loadDraft();
  }

  startCreateGroup(): void {
    this.editingGroupId = null;
    this.groupForm = this.createEmptyGroupForm();
    this.groupMemberIds = new Set<number>();
    this.selectedGroupImageFileName = '';
    this.showGroupImageOptions = false;
    this.groupImageUrlDraft = '';
    this.successMessage = '';
    this.errorMessage = '';
    this.showGroupForm = true;
    this.sidebarMode = 'groups';
  }

  startEditGroup(group: NotificationGroupDto, event: Event): void {
    event.stopPropagation();
    if (group.id === 0) return;

    this.editingGroupId = group.id;
    this.groupForm = {
      name: group.name,
      description: group.description ?? '',
      imageUrl: group.imageUrl ?? '',
      sendToAll: group.sendToAll,
      role: group.role ?? null,
      isActive: group.isActive ?? null,
      contentTag: group.contentTag ?? null,
      preferredInstrumentId: group.preferredInstrumentId ?? null,
      joinedFrom: this.toDateInput(group.joinedFrom),
      joinedTo: this.toDateInput(group.joinedTo),
      addressContains: group.addressContains ?? '',
      memberUserIds: group.memberUserIds ?? []
    };
    this.groupMemberIds = new Set(group.memberUserIds ?? []);
    this.selectedGroupImageFileName = '';
    this.showGroupImageOptions = false;
    this.groupImageUrlDraft = group.imageUrl ?? '';
    this.successMessage = '';
    this.errorMessage = '';
    this.showGroupForm = true;
  }

  saveGroup(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.groupForm.name.trim()) {
      this.errorMessage = 'צריך לכתוב שם לקבוצה.';
      return;
    }

    if (this.isUploadingGroupImage) {
      this.errorMessage = 'תמונת הקבוצה עדיין עולה. חכה רגע ואז שמור.';
      return;
    }

    if (!this.groupForm.sendToAll && this.groupMemberIds.size === 0) {
      this.errorMessage = 'צריך לבחור לפחות משתמש אחד לקבוצה.';
      return;
    }

    this.isSavingGroup = true;
    const payload = this.normalizeGroupPayload();
    const request = this.editingGroupId
      ? this.notificationService.updateNotificationGroup(this.editingGroupId, payload)
      : this.notificationService.createNotificationGroup(payload);

    request.subscribe({
      next: group => {
        this.showGroupForm = false;
        this.editingGroupId = null;
        this.isSavingGroup = false;
        this.loadGroups();
        this.selectGroup(group);
      },
      error: err => {
        this.errorMessage = err?.error?.message || 'שמירת הקבוצה נכשלה.';
        this.isSavingGroup = false;
      }
    });
  }

  deleteGroup(group: NotificationGroupDto, event: Event): void {
    event.stopPropagation();
    if (group.id === 0) return;

    this.notificationService.deleteNotificationGroup(group.id).subscribe({
      next: () => {
        if (this.selectedGroup?.id === group.id) {
          this.selectedGroup = null;
        }
        this.loadGroups();
      }
    });
  }

  closeGroupForm(): void {
    this.showGroupForm = false;
    this.editingGroupId = null;
    this.groupMemberIds = new Set<number>();
    this.selectedGroupImageFileName = '';
    this.showGroupImageOptions = false;
    this.groupImageUrlDraft = '';
    this.isSavingGroup = false;
  }

  toggleGroupMember(userId: number): void {
    if (this.groupMemberIds.has(userId)) {
      this.groupMemberIds.delete(userId);
    } else {
      this.groupMemberIds.add(userId);
    }

    this.groupForm.memberUserIds = Array.from(this.groupMemberIds);
  }

  isGroupMemberSelected(userId: number): boolean {
    return this.groupMemberIds.has(userId);
  }

  selectAllVisibleUsersForGroup(): void {
    const isActive =
      this.activityFilter === 'active'
        ? true
        : this.activityFilter === 'inactive'
          ? false
          : undefined;

    this.userService.getUsers(
      this.searchTerm || undefined,
      this.roleFilter ?? undefined,
      isActive,
      1,
      Math.max(this.totalUsers, this.pageSize),
      this.contentTagFilter ?? undefined,
      this.instrumentFilter ?? undefined
    ).subscribe({
      next: result => {
        result.items.forEach(user => this.groupMemberIds.add(user.id));
        this.groupForm.memberUserIds = Array.from(this.groupMemberIds);
      },
      error: () => {
        this.visibleUsers.forEach(user => this.groupMemberIds.add(user.id));
        this.groupForm.memberUserIds = Array.from(this.groupMemberIds);
      }
    });
  }

  clearGroupMembers(): void {
    this.groupMemberIds = new Set<number>();
    this.groupForm.memberUserIds = [];
  }

  clearGroupImage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.groupForm.imageUrl = '';
    this.selectedGroupImageFileName = '';
    this.groupImageUrlDraft = '';
    this.showGroupImageOptions = false;
  }

  toggleGroupImageOptions(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.groupImageUrlDraft = this.groupForm.imageUrl || this.groupImageUrlDraft;
    this.showGroupImageOptions = !this.showGroupImageOptions;
  }

  applyGroupImageUrl(): void {
    const url = this.groupImageUrlDraft.trim();
    if (!url) return;

    this.groupForm.imageUrl = url;
    this.selectedGroupImageFileName = '';
    this.showGroupImageOptions = false;
  }

  onGroupImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    input.value = '';
    this.selectedGroupImageFileName = file.name;
    this.showGroupImageOptions = false;
    this.groupImageUrlDraft = '';
    this.isUploadingGroupImage = true;
    this.errorMessage = '';

    this.mediaService.uploadMedia(file).subscribe({
      next: response => {
        this.groupForm.imageUrl = response.url;
        this.isUploadingGroupImage = false;
      },
      error: () => {
        this.errorMessage = 'העלאת תמונת הקבוצה נכשלה. בדוק שהשרת רץ ונסה שוב.';
        this.isUploadingGroupImage = false;
      }
    });
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

  toggleAttachMenu(): void {
    this.showAttachMenu = !this.showAttachMenu;
    if (!this.showAttachMenu) {
      this.showAttachPanel = false;
    }
  }

  chooseAttachment(type: AttachmentType): void {
    this.attachmentType = type;
    this.attachmentInputMode = 'url';
    this.showAttachMenu = false;
    this.showAttachPanel = true;

    if (type === 'image' || type === 'video' || type === 'file') {
      this.mediaType = type;
    }
  }

  onAttachmentUrlChange(value: string): void {
    if (this.attachmentType === 'link') {
      this.actionUrl = value;
    } else {
      this.mediaUrl = value;
    }

    this.saveCurrentDraft();
  }

  addAttachment(): void {
    if (!this.attachmentType) return;

    const url = this.getAttachmentValue().trim();
    if (!url) {
      this.errorMessage = 'צריך להוסיף קישור או קובץ לפני הצירוף.';
      return;
    }

    if (this.attachmentType === 'image') {
      this.attachmentType = null;
      this.showAttachPanel = false;
      this.saveCurrentDraft();
      return;
    }

    this.attachments = [
      ...this.attachments,
      {
        type: this.attachmentType,
        url,
        label: this.attachmentLabel.trim() || this.mediaAltText.trim() || null,
        clickUrl: null
      }
    ];

    this.actionUrl = '';
    this.mediaUrl = '';
    this.mediaType = '';
    this.mediaAltText = '';
    this.attachmentLabel = '';
    this.attachmentClickUrl = '';
    this.selectedFileName = '';
    this.attachmentType = null;
    this.showAttachPanel = false;
    this.saveCurrentDraft();
  }

  removeAttachment(index: number): void {
    this.attachments = this.attachments.filter((_, itemIndex) => itemIndex !== index);
    this.saveCurrentDraft();
  }

  onAttachmentFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.attachmentType || this.attachmentType === 'link') return;

    input.value = '';
    this.selectedFileName = file.name;
    this.mediaType = this.attachmentType;
    this.isUploadingAttachment = true;

    this.mediaService.uploadMedia(file).subscribe({
      next: response => {
        this.mediaUrl = response.url;
        this.isUploadingAttachment = false;
        this.saveCurrentDraft();
      },
      error: () => {
        this.errorMessage = 'העלאת הקובץ נכשלה. בדוק שהשרת רץ ונסה שוב.';
        this.isUploadingAttachment = false;
      }
    });
  }

  clearAttachment(): void {
    if (this.attachmentType === 'link') {
      this.actionUrl = '';
    } else {
      this.mediaUrl = '';
      this.mediaType = '';
      this.mediaAltText = '';
      this.selectedFileName = '';
    }

    this.attachmentType = null;
    this.showAttachPanel = false;
    this.saveCurrentDraft();
  }

  sendMessage(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.hasSelectedTarget) {
      this.errorMessage = 'צריך לבחור צ׳אט או קבוצה בצד ימין.';
      return;
    }

    if (!this.hasNotificationContent()) {
      this.errorMessage = 'צריך להוסיף הודעה, תמונה או צירוף לפני השליחה.';
      return;
    }

    if (this.isUploadingAttachment) {
      this.errorMessage = 'הקובץ עדיין עולה. חכה רגע ואז שלח.';
      return;
    }

    this.isSending = true;

    if (this.composerMode === 'group') {
      this.sendGroupMessage();
      return;
    }

    this.notificationService.sendUserMessage({
      userId: this.selectedUserId!,
      title: this.buildTitle(),
      message: this.buildMessage(),
      actionUrl: this.buildActionUrl(),
      mediaUrl: this.mediaUrl.trim() || null,
      mediaType: this.mediaType || null,
      mediaThumbnailUrl: null,
      mediaAltText: this.mediaAltText.trim() || null,
      attachments: this.buildAttachmentsPayload(),
      isMarketingContent: this.isMarketingContent
    }).subscribe({
      next: () => this.handleMessageSent('ההודעה נשלחה למשתמש.'),
      error: err => {
        this.errorMessage = err?.message || err?.error?.message || 'שליחת ההודעה נכשלה.';
        this.isSending = false;
      }
    });
  }

  sendGroupMessage(): void {
    this.notificationService.sendBroadcast({
      title: this.buildTitle(),
      message: this.buildMessage(),
      actionUrl: this.buildActionUrl(),
      mediaUrl: this.mediaUrl.trim() || null,
      mediaType: this.mediaType || null,
      mediaThumbnailUrl: null,
      mediaAltText: this.mediaAltText.trim() || null,
      attachments: this.buildAttachmentsPayload(),
      isMarketingContent: this.isMarketingContent,
      campaignName: this.campaignName.trim() || this.selectedGroup?.name || null,
      groupId: this.selectedGroup?.id ?? null,
      sendToAll: this.selectedGroup?.sendToAll ?? false,
      role: this.selectedGroup?.role ?? null,
      isActive: this.selectedGroup?.isActive ?? null,
      contentTag: this.selectedGroup?.contentTag ?? null,
      preferredInstrumentId: this.selectedGroup?.preferredInstrumentId ?? null,
      joinedFrom: this.selectedGroup?.joinedFrom ?? null,
      joinedTo: this.selectedGroup?.joinedTo ?? null,
      addressContains: this.selectedGroup?.addressContains ?? null
    }).subscribe({
      next: result => this.handleMessageSent(`ההודעה נשלחה ל-${result.sentCount} חברים.`),
      error: err => {
        this.errorMessage = err?.message || err?.error?.message || 'שליחת ההודעה לקבוצה נכשלה.';
        this.isSending = false;
      }
    });
  }

  onDraftChanged(): void {
    this.saveCurrentDraft();
  }

  getAttachmentLabel(): string {
    switch (this.attachmentType) {
      case 'link':
        return 'קישור לחיץ';
      case 'image':
        return 'תמונה';
      case 'video':
        return 'וידאו';
      case 'file':
        return 'קובץ';
      default:
        return 'צירוף';
    }
  }

  getAttachmentValue(): string {
    return this.attachmentType === 'link' ? this.actionUrl : this.mediaUrl;
  }

  getAttachmentAccept(): string {
    switch (this.attachmentType) {
      case 'image':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'file':
        return '*/*';
      default:
        return '';
    }
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

  shouldShowTitle(notification: NotificationDto): boolean {
    return notification.type !== 3 && notification.type !== 6 && notification.title !== notification.message;
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

  private buildTitle(): string {
    const messageTitle = this.message.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (messageTitle) return messageTitle;
    if (this.mediaType === 'image' || this.attachments.some(item => item.type === 'image')) return 'תמונה מצורפת';
    if (this.mediaType === 'video' || this.attachments.some(item => item.type === 'video')) return 'וידאו מצורף';
    if (this.mediaUrl.trim() || this.attachments.length) return 'צירוף חדש';
    return 'הודעה מהמערכת';
  }

  private buildMessage(): string {
    return this.message.trim();
  }

  private buildActionUrl(): string | null {
    if (this.actionUrl.trim()) return this.actionUrl.trim();
    if (this.mediaType === 'image' && this.attachmentClickUrl.trim()) return this.attachmentClickUrl.trim();
    return null;
  }

  private hasNotificationContent(): boolean {
    return !!(
      this.message.trim() ||
      this.actionUrl.trim() ||
      this.mediaUrl.trim() ||
      this.attachments.length ||
      (this.attachmentType && this.getAttachmentValue().trim())
    );
  }

  private handleMessageSent(message: string): void {
    this.successMessage = message;
    if (this.selectedUserId) {
      this.loadThread(this.selectedUserId);
    }

    delete this.drafts[this.activeTargetKey];
    this.resetComposer();
    this.isSending = false;
  }

  private saveCurrentDraft(): void {
    if (!this.hasSelectedTarget) return;

    this.drafts[this.activeTargetKey] = {
      message: this.message,
      actionUrl: this.actionUrl,
      mediaUrl: this.mediaUrl,
      mediaType: this.mediaType,
      mediaAltText: this.mediaAltText,
      attachments: this.attachments,
      isMarketingContent: this.isMarketingContent,
      campaignName: this.campaignName
    };
  }

  private loadDraft(): void {
    const draft = this.drafts[this.activeTargetKey];
    this.message = draft?.message ?? '';
    this.actionUrl = draft?.actionUrl ?? '';
    this.mediaUrl = draft?.mediaUrl ?? '';
    this.mediaType = draft?.mediaType ?? '';
    this.mediaAltText = draft?.mediaAltText ?? '';
    this.attachments = draft?.attachments ?? [];
    this.isMarketingContent = draft?.isMarketingContent ?? false;
    this.campaignName = draft?.campaignName ?? '';
    this.attachmentType = this.actionUrl ? 'link' : (this.mediaType || null);
    this.showAttachPanel = !!(this.actionUrl || this.mediaUrl);
    this.selectedFileName = '';
  }

  private resetComposer(): void {
    this.message = '';
    this.actionUrl = '';
    this.mediaUrl = '';
    this.mediaType = '';
    this.mediaAltText = '';
    this.attachments = [];
    this.isMarketingContent = false;
    this.campaignName = '';
    this.attachmentLabel = '';
    this.attachmentClickUrl = '';
    this.attachmentType = null;
    this.closeAttachUi();
  }

  private closeAttachUi(): void {
    this.showAttachMenu = false;
    this.showAttachPanel = false;
    this.selectedFileName = '';
  }

  private createEmptyGroupForm(): SaveNotificationGroupDto {
    return {
      name: '',
      description: '',
      imageUrl: '',
      sendToAll: false,
      role: null,
      isActive: null,
      contentTag: null,
      preferredInstrumentId: null,
      joinedFrom: null,
      joinedTo: null,
      addressContains: '',
      memberUserIds: []
    };
  }

  private normalizeGroupPayload(): SaveNotificationGroupDto {
    const memberUserIds = Array.from(this.groupMemberIds);

    return {
      ...this.groupForm,
      name: this.groupForm.name.trim(),
      description: this.groupForm.description?.trim() || null,
      imageUrl: this.groupForm.imageUrl?.trim() || null,
      role: null,
      isActive: null,
      contentTag: null,
      preferredInstrumentId: null,
      joinedFrom: null,
      joinedTo: null,
      addressContains: null,
      memberUserIds: this.groupForm.sendToAll ? [] : memberUserIds
    };
  }

  private buildAttachmentsPayload(): NotificationAttachmentDto[] | null {
    const pending = this.attachmentType && this.attachmentType !== 'image' && this.getAttachmentValue().trim()
      ? [{
          type: this.attachmentType,
          url: this.getAttachmentValue().trim(),
          label: this.attachmentLabel.trim() || this.mediaAltText.trim() || null,
          clickUrl: null
        }]
      : [];

    const payload = [...this.attachments, ...pending];
    return payload.length ? payload : null;
  }

  private toDateInput(value?: string | null): string | null {
    return value ? value.slice(0, 10) : null;
  }
}
