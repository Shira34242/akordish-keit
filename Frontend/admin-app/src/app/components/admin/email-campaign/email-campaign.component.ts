import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import {
  EmailCampaignService,
  EmailRecipientGroup,
  EmailRecipient,
  EmailSendResult,
  EmailGroupDto,
  EmailGroupMemberDto,
  SiteInterestDto,
} from '../../../services/email-campaign.service';
import { UserService } from '../../../services/user.service';
import { UserListDto } from '../../../models/user.model';

type ActiveTab = 'send' | 'groups' | 'interested';

@Component({
  selector: 'app-email-campaign',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-campaign.component.html',
  styleUrls: ['./email-campaign.component.css'],
})
export class EmailCampaignComponent implements OnInit {
  @ViewChild('editorBody') editorBody!: ElementRef<HTMLDivElement>;

  // ── Tabs ──────────────────────────────────────────────────────────
  activeTab: ActiveTab = 'send';

  // ── Send tab ──────────────────────────────────────────────────────
  subject = '';
  fromName = 'אקורדישקייט';
  recipientGroup = EmailRecipientGroup.AllUsers;
  selectedEmailGroupId: number | null = null;
  recipientCount = 0;
  loadingCount = false;

  recipients: EmailRecipient[] = [];
  loadingRecipients = false;
  showRecipientsDialog = false;
  recipientSearchQuery = '';
  excludedEmails = new Set<string>();

  showPreview = false;
  previewSafeHtml: SafeHtml | null = null;
  loadingPreview = false;

  showLinkDialog = false;
  linkUrl = '';
  linkText = '';

  showImageDialog = false;
  imageUrl = '';
  imageAlt = '';
  imageWidth = '100%';

  isSending = false;
  showConfirmDialog = false;
  sendResult: EmailSendResult | null = null;

  readonly RecipientGroup = EmailRecipientGroup;

  private savedRange: Range | null = null;

  readonly recipientGroups = [
    { value: EmailRecipientGroup.AllUsers,            label: 'כל המשתמשים',        icon: 'group' },
    { value: EmailRecipientGroup.ActiveOnly,          label: 'פעילים בלבד',         icon: 'person_check' },
    { value: EmailRecipientGroup.MarketingConsentOnly,label: 'הסכמת שיווק בלבד',    icon: 'campaign' },
    { value: EmailRecipientGroup.AllTeachers,         label: 'כל המורים',           icon: 'school' },
    { value: EmailRecipientGroup.AllArtists,          label: 'כל האומנים',          icon: 'mic' },
    { value: EmailRecipientGroup.AllServiceProviders, label: 'כל בעלי המקצוע',      icon: 'work' },
    { value: EmailRecipientGroup.NoProfessionalProfile, label: 'ללא פרופיל מקצועי', icon: 'person_off' },
    { value: EmailRecipientGroup.InterestedInSite,    label: 'מתעניינים באתר',      icon: 'star' },
    { value: EmailRecipientGroup.CustomGroup,         label: 'קבוצה מותאמת',        icon: 'group_add' },
  ];

  // ── Groups tab ────────────────────────────────────────────────────
  emailGroups: EmailGroupDto[] = [];
  loadingGroups = false;

  showGroupDialog = false;
  editingGroupId: number | null = null;
  groupName = '';
  groupDescription = '';
  groupMembers: EmailGroupMemberDto[] = [];
  savingGroup = false;

  userSearchQuery = '';
  userSearchResults: UserListDto[] = [];
  searchingUsers = false;
  private userSearch$ = new Subject<string>();

  deleteGroupConfirmId: number | null = null;

  // ── Interested tab ────────────────────────────────────────────────
  siteInterests: SiteInterestDto[] = [];
  loadingInterests = false;
  deleteInterestConfirmId: number | null = null;

  constructor(
    private emailService: EmailCampaignService,
    private userService: UserService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    this.loadCount();
    this.loadGroups();
    this.setupUserSearch();
  }

  // ── Tab navigation ────────────────────────────────────────────────

  switchTab(tab: ActiveTab) {
    this.activeTab = tab;
    if (tab === 'interested' && this.siteInterests.length === 0) this.loadInterests();
  }

  // ── Recipient count ───────────────────────────────────────────────

  loadCount() {
    this.loadingCount = true;
    const groupId = this.recipientGroup === EmailRecipientGroup.CustomGroup
      ? this.selectedEmailGroupId ?? undefined
      : undefined;

    this.emailService.getRecipientCount(this.recipientGroup, groupId).subscribe({
      next: (count) => { this.recipientCount = count; this.loadingCount = false; },
      error: ()      => { this.loadingCount = false; },
    });
  }

  onGroupChange() {
    if (this.recipientGroup !== EmailRecipientGroup.CustomGroup) {
      this.selectedEmailGroupId = null;
    }
    this.loadCount();
    this.resetRecipientsSelection();
  }

  onCustomGroupChange() {
    this.loadCount();
    this.resetRecipientsSelection();
  }

  get availableEmailGroupsForSend() {
    return this.emailGroups.length > 0 ? this.emailGroups : [];
  }

  // ── Recipients list & manual exclusion ───────────────────────────

  private resetRecipientsSelection() {
    this.recipients = [];
    this.excludedEmails.clear();
    this.recipientSearchQuery = '';
  }

  openRecipientsDialog() {
    this.showRecipientsDialog = true;
    if (this.recipients.length === 0) this.loadRecipients();
  }

  loadRecipients() {
    this.loadingRecipients = true;
    const groupId = this.recipientGroup === EmailRecipientGroup.CustomGroup
      ? this.selectedEmailGroupId ?? undefined
      : undefined;

    this.emailService.getRecipients(this.recipientGroup, groupId).subscribe({
      next: (list) => { this.recipients = list; this.loadingRecipients = false; },
      error: ()     => { this.loadingRecipients = false; },
    });
  }

  get filteredRecipients(): EmailRecipient[] {
    const q = this.recipientSearchQuery.trim().toLowerCase();
    if (!q) return this.recipients;
    return this.recipients.filter(r =>
      r.email.toLowerCase().includes(q) || (r.name ?? '').toLowerCase().includes(q)
    );
  }

  isExcluded(email: string): boolean {
    return this.excludedEmails.has(email.toLowerCase());
  }

  toggleExcluded(email: string) {
    const key = email.toLowerCase();
    if (this.excludedEmails.has(key)) this.excludedEmails.delete(key);
    else this.excludedEmails.add(key);
  }

  get effectiveRecipientCount(): number {
    return Math.max(0, this.recipientCount - this.excludedEmails.size);
  }

  // ── Editor formatting ─────────────────────────────────────────────

  format(command: string, value?: string) {
    document.execCommand(command, false, value ?? undefined);
    this.editorBody.nativeElement.focus();
  }

  setFontSize(event: Event) {
    const size = (event.target as HTMLSelectElement).value;
    if (size) this.format('fontSize', size);
  }

  setTextColor(event: Event) {
    const color = (event.target as HTMLInputElement).value;
    this.format('foreColor', color);
  }

  setAlign(align: string) {
    document.execCommand(align, false, undefined);
    this.editorBody.nativeElement.focus();
  }

  private saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) this.savedRange = sel.getRangeAt(0).cloneRange();
  }

  private restoreSelection() {
    this.editorBody.nativeElement.focus();
    if (!this.savedRange) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(this.savedRange);
  }

  // ── Link dialog ───────────────────────────────────────────────────

  openLinkDialog() {
    this.saveSelection();
    this.linkText = window.getSelection()?.toString() ?? '';
    this.linkUrl = '';
    this.showLinkDialog = true;
  }

  insertLink() {
    const url  = this.linkUrl;
    const text = this.linkText;
    this.showLinkDialog = false;
    if (!url) return;

    setTimeout(() => {
      this.restoreSelection();
      const selectedText = window.getSelection()?.toString();
      if (!selectedText && text) {
        document.execCommand('insertHTML', false,
          `<a href="${url}" target="_blank">${text}</a>`);
      } else {
        document.execCommand('createLink', false, url);
        const anchor = window.getSelection()?.anchorNode?.parentElement?.closest('a');
        if (anchor) anchor.target = '_blank';
      }
    }, 50);
  }

  // ── Image dialog ──────────────────────────────────────────────────

  openImageDialog() {
    this.saveSelection();
    this.imageUrl = '';
    this.imageAlt = '';
    this.imageWidth = '100%';
    this.showImageDialog = true;
  }

  insertImage() {
    const url   = this.imageUrl;
    const alt   = this.imageAlt;
    const width = this.imageWidth;
    this.showImageDialog = false;
    if (!url) return;

    setTimeout(() => {
      this.restoreSelection();
      const widthStyle = width ? `width:${width};` : '';
      const html = `<img src="${url}" alt="${alt}" style="max-width:100%;${widthStyle}display:block;margin:8px 0;" />`;
      document.execCommand('insertHTML', false, html);
    }, 50);
  }

  // ── Preview & send ────────────────────────────────────────────────

  togglePreview() {
    this.showPreview = !this.showPreview;
    if (this.showPreview) this.loadPreview();
  }

  private loadPreview() {
    this.loadingPreview = true;
    this.previewSafeHtml = null;
    const htmlBody = this.editorBody.nativeElement.innerHTML;
    this.emailService.previewEmail(this.subject || '(ללא נושא)', htmlBody).subscribe({
      next: (res) => { this.previewSafeHtml = this.sanitizer.bypassSecurityTrustHtml(res.html); this.loadingPreview = false; },
      error: ()    => { this.loadingPreview = false; },
    });
  }

  openConfirmDialog() {
    this.showConfirmDialog = true;
  }

  sendEmail() {
    this.isSending = true;
    this.emailService
      .sendCampaign({
        subject:        this.subject,
        htmlBody:       this.editorBody.nativeElement.innerHTML,
        recipientGroup: this.recipientGroup,
        emailGroupId:   this.recipientGroup === EmailRecipientGroup.CustomGroup
                          ? (this.selectedEmailGroupId ?? undefined)
                          : undefined,
        fromName:       this.fromName,
        excludedEmails: this.excludedEmails.size > 0 ? Array.from(this.excludedEmails) : undefined,
      })
      .subscribe({
        next: (result) => {
          this.sendResult = result;
          this.isSending = false;
          this.showConfirmDialog = false;
        },
        error: () => {
          this.sendResult = {
            success: false,
            message: 'שגיאה בשליחה, נסי שוב מאוחר יותר',
            sentCount: 0,
            failedCount: 0,
          };
          this.isSending = false;
          this.showConfirmDialog = false;
        },
      });
  }

  resetForm() {
    this.subject = '';
    this.editorBody.nativeElement.innerHTML = '';
    this.sendResult = null;
    this.showPreview = false;
    this.previewSafeHtml = null;
    this.resetRecipientsSelection();
  }

  get selectedGroupLabel(): string {
    if (this.recipientGroup === EmailRecipientGroup.CustomGroup) {
      const g = this.emailGroups.find(g => g.id === this.selectedEmailGroupId);
      return g ? `קבוצה: ${g.name}` : 'קבוצה מותאמת';
    }
    return this.recipientGroups.find(g => g.value === this.recipientGroup)?.label ?? '';
  }

  get canSend(): boolean {
    if (!this.subject.trim()) return false;
    if (!this.editorBody?.nativeElement?.innerHTML.trim()) return false;
    if (this.recipientGroup === EmailRecipientGroup.CustomGroup && !this.selectedEmailGroupId) return false;
    return true;
  }

  // ── Groups tab ────────────────────────────────────────────────────

  loadGroups() {
    this.loadingGroups = true;
    this.emailService.getGroups().subscribe({
      next: (groups) => { this.emailGroups = groups; this.loadingGroups = false; },
      error: ()       => { this.loadingGroups = false; },
    });
  }

  openCreateGroupDialog() {
    this.editingGroupId = null;
    this.groupName = '';
    this.groupDescription = '';
    this.groupMembers = [];
    this.userSearchQuery = '';
    this.userSearchResults = [];
    this.showGroupDialog = true;
  }

  openEditGroupDialog(group: EmailGroupDto) {
    this.editingGroupId = group.id;
    this.groupName = group.name;
    this.groupDescription = group.description ?? '';
    this.groupMembers = [...group.members];
    this.userSearchQuery = '';
    this.userSearchResults = [];
    this.showGroupDialog = true;
  }

  closeGroupDialog() {
    this.showGroupDialog = false;
  }

  saveGroup() {
    if (!this.groupName.trim()) return;
    this.savingGroup = true;

    const dto = {
      name:        this.groupName.trim(),
      description: this.groupDescription.trim() || undefined,
      userIds:     this.groupMembers.map(m => m.userId),
    };

    const req = this.editingGroupId
      ? this.emailService.updateGroup(this.editingGroupId, dto)
      : this.emailService.createGroup(dto);

    req.subscribe({
      next: (saved) => {
        if (this.editingGroupId) {
          const idx = this.emailGroups.findIndex(g => g.id === this.editingGroupId);
          if (idx !== -1) this.emailGroups[idx] = saved;
        } else {
          this.emailGroups.unshift(saved);
        }
        this.showGroupDialog = false;
        this.savingGroup = false;
      },
      error: () => { this.savingGroup = false; },
    });
  }

  confirmDeleteGroup(id: number) {
    this.deleteGroupConfirmId = id;
  }

  deleteGroup(id: number) {
    this.emailService.deleteGroup(id).subscribe({
      next: () => {
        this.emailGroups = this.emailGroups.filter(g => g.id !== id);
        this.deleteGroupConfirmId = null;
      },
    });
  }

  // ── User search for group ─────────────────────────────────────────

  private setupUserSearch() {
    this.userSearch$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(query => {
      if (!query.trim()) { this.userSearchResults = []; return; }
      this.searchingUsers = true;
      this.userService.getUsers(query, undefined, undefined, 1, 10).subscribe({
        next: (result) => {
          this.userSearchResults = result.items.filter(
            u => !this.groupMembers.some(m => m.userId === u.id)
          );
          this.searchingUsers = false;
        },
        error: () => { this.searchingUsers = false; },
      });
    });
  }

  onUserSearchInput() {
    this.userSearch$.next(this.userSearchQuery);
  }

  addMemberFromSearch(user: UserListDto) {
    if (this.groupMembers.some(m => m.userId === user.id)) return;
    this.groupMembers.push({ userId: user.id, username: user.username, email: user.email });
    this.userSearchQuery = '';
    this.userSearchResults = [];
  }

  removeMember(userId: number) {
    this.groupMembers = this.groupMembers.filter(m => m.userId !== userId);
  }

  // ── Interested tab ────────────────────────────────────────────────

  loadInterests() {
    this.loadingInterests = true;
    this.emailService.getSiteInterests().subscribe({
      next: (list) => { this.siteInterests = list; this.loadingInterests = false; },
      error: ()     => { this.loadingInterests = false; },
    });
  }

  confirmDeleteInterest(id: number) {
    this.deleteInterestConfirmId = id;
  }

  deleteInterest(id: number) {
    this.emailService.deleteSiteInterest(id).subscribe({
      next: () => {
        this.siteInterests = this.siteInterests.filter(s => s.id !== id);
        this.deleteInterestConfirmId = null;
      },
    });
  }
}
