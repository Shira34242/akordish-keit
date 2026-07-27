import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import {
  EmailCampaignService,
  EmailRecipientGroup,
  EmailRecipient,
  EmailSendResult,
  EmailGroupDto,
  EmailGroupMemberDto,
  SiteInterestDto,
  EmailSubscriberDto,
  EmailSubscriberPageDto,
} from '../../../services/email-campaign.service';
import { FileUploadInputComponent } from '../../shared/file-upload-input/file-upload-input.component';

type ActiveTab = 'send' | 'subscribers' | 'groups' | 'interested';

interface SavedEmail {
  id: number;
  subject: string;
  htmlBody: string;
  fromName: string;
  savedAt: string;
}

@Component({
  selector: 'app-email-campaign',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
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
  manualRecipientsText = '';
  manualRecipientTokens: string[] = [];
  manualInvalidEmails: string[] = [];
  manualDuplicateCount = 0;
  manualSuppressedCount = 0;
  manualEligibleCount = 0;
  manualMaxAllowed = 5000;
  checkingManualRecipients = false;
  manualValidationFailed = false;
  manualPermissionConfirmed = false;
  private manualValidationTimer?: ReturnType<typeof setTimeout>;


  showLinkDialog = false;
  linkUrl = '';
  linkText = '';

  showImageDialog = false;
  imageUrl = '';
  imageAlt = '';
  imageCaption = '';
  imageLink = '';
  imageWidth = 100;
  imageAlign: 'right' | 'center' | 'left' = 'center';

  showVideoDialog = false;
  videoUrl = '';
  videoLabel = 'לצפייה בסרטון';

  showButtonDialog = false;
  buttonLabel = '';
  buttonUrl = '';
  buttonVariant: 'primary' | 'dark' | 'soft' = 'primary';
  buttonAlign: 'right' | 'center' | 'left' = 'center';

  isSending = false;
  showConfirmDialog = false;
  sendResult: EmailSendResult | null = null;
  drafts: SavedEmail[] = [];
  sentEmails: SavedEmail[] = [];
  mobilePreview = false;

  readonly RecipientGroup = EmailRecipientGroup;

  private savedRange: Range | null = null;
  editorMenuVisible = false;
  editorMenuX = 0;
  editorMenuY = 0;
  private editingImage: HTMLImageElement | null = null;
  private editingButton: HTMLTableElement | null = null;

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
    { value: EmailRecipientGroup.ManualOneTime,       label: 'שליחה חד־פעמית',       icon: 'content_paste' },
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
  userSearchResults: EmailSubscriberDto[] = [];
  searchingUsers = false;
  private userSearch$ = new Subject<string>();

  deleteGroupConfirmId: number | null = null;

  // ── Subscribers tab ──────────────────────────────────────────────
  subscribers: EmailSubscriberDto[] = [];
  subscribersTotal = 0;
  subscribedCount = 0;
  unsubscribedCount = 0;
  subscriberSearch = '';
  subscriberStatus = 'all';
  subscriberGroupId: number | null = null;
  subscriberPage = 1;
  subscriberPageSize = 25;
  loadingSubscribers = false;
  showSubscriberDialog = false;
  editingSubscriber: EmailSubscriberDto | null = null;
  subscriberEmail = '';
  subscriberName = '';
  subscriberIsSubscribed = true;
  subscriberGroupIds = new Set<number>();
  savingSubscriber = false;

  // ── Interested tab ────────────────────────────────────────────────
  siteInterests: SiteInterestDto[] = [];
  loadingInterests = false;
  deleteInterestConfirmId: number | null = null;

  constructor(
    private emailService: EmailCampaignService,
  ) {}

  ngOnInit() {
    this.loadCount();
    this.loadGroups();
    this.setupUserSearch();
    this.drafts = this.readSavedEmails('akordish-email-drafts');
    this.sentEmails = this.readSavedEmails('akordish-email-history');
  }

  // ── Tab navigation ────────────────────────────────────────────────

  switchTab(tab: ActiveTab) {
    this.activeTab = tab;
    if (tab === 'subscribers' && this.subscribers.length === 0) this.loadSubscribers();
    if (tab === 'interested' && this.siteInterests.length === 0) this.loadInterests();
  }

  // ── Recipient count ───────────────────────────────────────────────

  loadCount() {
    if (this.recipientGroup === EmailRecipientGroup.ManualOneTime) {
      this.onManualRecipientsChange();
      return;
    }

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
    this.resetRecipientsSelection();
    this.loadCount();
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

  onManualRecipientsChange() {
    if (this.manualValidationTimer) clearTimeout(this.manualValidationTimer);

    const tokens = this.manualRecipientsText
      .split(/[\s,;]+/)
      .map(email => email.trim())
      .filter(Boolean);
    this.manualRecipientTokens = tokens;

    const seen = new Set<string>();
    const invalid = new Set<string>();
    let duplicates = 0;
    for (const token of tokens) {
      const normalized = token.toLowerCase();
      if (seen.has(normalized)) duplicates++;
      else seen.add(normalized);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token) || token.length > 254) invalid.add(token);
    }

    this.manualDuplicateCount = duplicates;
    this.manualInvalidEmails = Array.from(invalid);
    this.manualSuppressedCount = 0;
    this.manualEligibleCount = Math.max(0, seen.size - invalid.size);
    this.recipientCount = this.manualEligibleCount;
    this.manualValidationFailed = false;

    if (tokens.length === 0) {
      this.checkingManualRecipients = false;
      return;
    }

    this.checkingManualRecipients = true;
    const signature = tokens.join('\n');
    this.manualValidationTimer = setTimeout(() => {
      this.emailService.validateManualRecipients(tokens).subscribe({
        next: result => {
          if (this.manualRecipientTokens.join('\n') !== signature) return;
          this.manualInvalidEmails = result.invalidEmails;
          this.manualDuplicateCount = result.duplicateCount;
          this.manualSuppressedCount = result.suppressedCount;
          this.manualEligibleCount = result.eligibleCount;
          this.manualMaxAllowed = result.maxAllowed;
          this.recipientCount = result.eligibleCount;
          this.checkingManualRecipients = false;
        },
        error: () => {
          if (this.manualRecipientTokens.join('\n') !== signature) return;
          this.manualEligibleCount = 0;
          this.recipientCount = 0;
          this.checkingManualRecipients = false;
          this.manualValidationFailed = true;
        },
      });
    }, 350);
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
    if (this.recipientGroup === EmailRecipientGroup.ManualOneTime) return this.manualEligibleCount;
    return Math.max(0, this.recipientCount - this.excludedEmails.size);
  }

  // ── Editor formatting ─────────────────────────────────────────────

  format(command: string, value?: string) {
    this.restoreSelection();
    document.execCommand(command, false, value ?? undefined);
    this.editorBody.nativeElement.focus();
  }

  undo() { this.editorBody.nativeElement.focus(); document.execCommand('undo'); }
  redo() { this.editorBody.nativeElement.focus(); document.execCommand('redo'); }

  insertBlock(type: 'divider' | 'article' | 'event' | 'greeting') {
    this.restoreSelection();
    const blocks = {
      divider: '<hr style="border:0;border-top:1px solid #F2F2F2;margin:24px 0;" />',
      article: '<h2 style="margin:0 0 10px;font-size:22px;line-height:1.3;">כותרת הכתבה</h2><p style="margin:0 0 16px;line-height:1.7;">כתבי כאן תקציר קצר ומזמין.</p>',
      event: '<div style="background-color:#F2F2F2;padding:20px;margin:16px 0;"><strong style="font-size:18px;">אירוע קרוב</strong><p style="margin:8px 0 0;">תאריך, שעה ומקום</p></div>',
      greeting: '<p style="margin:0 0 16px;">שלום {{שם}},</p>'
    };
    document.execCommand('insertHTML', false, blocks[type]);
    this.editorBody.nativeElement.focus();
  }

  saveDraft() {
    const subject = this.subject.trim() || 'טיוטה ללא נושא';
    const draft: SavedEmail = { id: Date.now(), subject, htmlBody: this.editorBody.nativeElement.innerHTML, fromName: this.fromName, savedAt: new Date().toISOString() };
    this.drafts = [draft, ...this.drafts].slice(0, 20);
    localStorage.setItem('akordish-email-drafts', JSON.stringify(this.drafts));
  }

  loadSavedEmail(item: SavedEmail) {
    this.subject = item.subject;
    this.fromName = item.fromName;
    this.editorBody.nativeElement.innerHTML = item.htmlBody;
  }

  sendTestEmail() {
    const recipientEmail = window.prompt('לאיזו כתובת לשלוח מייל בדיקה?');
    if (!recipientEmail) return;
    this.emailService.sendTestEmail({
      subject: this.subject,
      htmlBody: this.editorBody.nativeElement.innerHTML,
      recipientGroup: this.recipientGroup,
      fromName: this.fromName,
      recipientEmail,
    }).subscribe({ next: result => alert(result.message), error: () => alert('שליחת מייל הבדיקה נכשלה') });
  }

  private readSavedEmails(key: string): SavedEmail[] {
    try { return JSON.parse(localStorage.getItem(key) || '[]') as SavedEmail[]; } catch { return []; }
  }

  setFontSize(event: Event) {
    const size = (event.target as HTMLSelectElement).value;
    if (size) this.format('fontSize', size);
  }

  setFontFamily(event: Event) {
    const font = (event.target as HTMLSelectElement).value;
    if (font) this.format('fontName', font);
  }

  setFontWeight(event: Event) {
    const weight = (event.target as HTMLSelectElement).value;
    if (!weight) return;
    this.restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontSize', false, '3');
    const selection = window.getSelection();
    const element = selection?.anchorNode?.parentElement?.closest('font, span');
    if (element instanceof HTMLElement) element.style.fontWeight = weight;
    this.editorBody.nativeElement.focus();
  }

  onEditorSelectionChange() {
    this.saveSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.editorMenuVisible = false;
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = this.editorBody.nativeElement.closest('.composer-main')?.getBoundingClientRect()
      ?? this.editorBody.nativeElement.getBoundingClientRect();
    this.editorMenuX = Math.max(8, rect.left - containerRect.left);
    this.editorMenuY = Math.max(8, rect.top - containerRect.top - 44);
    this.editorMenuVisible = true;
  }

  onToolbarMouseDown(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('button')) event.preventDefault();
  }

  @HostListener('document:mousedown', ['$event'])
  closeEditorMenuOnOutsideClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.editor-toolbar') && !target.closest('.editor-body')) {
      this.editorMenuVisible = false;
    }
  }

  setTextColor(event: Event) {
    const color = (event.target as HTMLInputElement).value;
    this.format('foreColor', color);
  }

  setAlign(align: string) {
    this.restoreSelection();
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
    this.editingImage = null;
    this.imageUrl = '';
    this.imageAlt = '';
    this.imageCaption = '';
    this.imageLink = '';
    this.imageWidth = 100;
    this.imageAlign = 'center';
    this.showImageDialog = true;
  }

  onEditorClick(event: MouseEvent) {
    const link = (event.target as HTMLElement).closest('a');
    const buttonTable = link?.closest('table[role="presentation"]');
    if (link && buttonTable && !buttonTable.querySelector('img')) {
      event.preventDefault();
      this.editingButton = buttonTable as HTMLTableElement;
      this.buttonLabel = link.textContent?.trim() || '';
      this.buttonUrl = link.href || '';
      const background = buttonTable.querySelector('td')?.getAttribute('bgcolor')?.toLowerCase() || '';
      this.buttonVariant = background === '#000000' ? 'dark' : background === '#f2f2f2' ? 'soft' : 'primary';
      this.buttonAlign = buttonTable.getAttribute('align') === 'right' ? 'right' : buttonTable.getAttribute('align') === 'left' ? 'left' : 'center';
      this.showButtonDialog = true;
      return;
    }

    const image = (event.target as HTMLElement).closest('img');
    if (!(image instanceof HTMLImageElement)) return;

    event.preventDefault();
    this.editingImage = image;
    this.imageUrl = image.src;
    this.imageAlt = image.alt;
    const wrapper = image.closest('table[role="presentation"], div[style*="text-align"]') as HTMLElement | null;
    this.imageWidth = Math.min(100, Math.max(30, parseInt(wrapper?.getAttribute('width') || image.style.width, 10) || 100));
    const align = wrapper?.getAttribute('align') || wrapper?.style.textAlign;
    this.imageAlign = align === 'right' || align === 'left' ? align : 'center';
    this.imageLink = image.closest('a')?.href || '';
    this.imageCaption = wrapper?.querySelector('div')?.textContent?.trim() || '';
    this.showImageDialog = true;
  }

  insertImage() {
    const url   = this.imageUrl;
    const alt   = this.imageAlt;
    const width = Math.min(100, Math.max(30, Number(this.imageWidth) || 100));
    const align = this.imageAlign;
    const caption = this.escapeHtml(this.imageCaption);
    const link = this.safeUrl(this.imageLink);
    this.showImageDialog = false;
    if (!url) return;

    setTimeout(() => {
      this.restoreSelection();
      const html = this.buildImageHtml(url, alt, width, align, link, caption);
      if (this.editingImage) {
        const wrapper = this.editingImage.closest('table[role="presentation"], div[style*="text-align"]');
        (wrapper ?? this.editingImage).outerHTML = html;
        this.editingImage = null;
      } else {
        document.execCommand('insertHTML', false, html);
      }
    }, 50);
  }

  private buildImageHtml(url: string, alt: string, width: number, align: string, link: string, caption: string): string {
    const pixelWidth = Math.round(520 * width / 100);
    const image = `<img src="${this.escapeHtml(url)}" alt="${this.escapeHtml(alt)}" width="${pixelWidth}" style="width:100%;max-width:${pixelWidth}px;height:auto;display:block;border:0;" />`;
    const linkedImage = link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${image}</a>` : image;
    const tableAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${width}%" align="${tableAlign}" style="width:${width}%;max-width:520px;margin:16px ${align === 'center' ? 'auto' : '0'};"><tr><td align="${tableAlign}">${linkedImage}${caption ? `<div style="font-size:13px;color:#404040;margin-top:6px;text-align:${align};">${caption}</div>` : ''}</td></tr></table>`;
  }

  openVideoDialog() {
    this.saveSelection();
    this.videoUrl = '';
    this.videoLabel = 'לצפייה בסרטון';
    this.showVideoDialog = true;
  }

  insertVideo() {
    const url = this.safeUrl(this.videoUrl);
    const label = this.escapeHtml(this.videoLabel.trim() || 'לצפייה בסרטון');
    this.showVideoDialog = false;
    if (!url) return;

    setTimeout(() => {
      this.restoreSelection();
      const html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto;"><tr><td style="background-color:#000000;border-radius:999px;padding:12px 22px;text-align:center;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#ddff53;text-decoration:none;font-weight:700;font-family:Arial,Helvetica,sans-serif;">▶ ${label}</a></td></tr></table>`;
      document.execCommand('insertHTML', false, html);
    }, 50);
  }

  openButtonDialog() {
    this.saveSelection();
    this.editingButton = null;
    this.buttonLabel = '';
    this.buttonUrl = '';
    this.buttonVariant = 'primary';
    this.buttonAlign = 'center';
    this.showButtonDialog = true;
  }

  insertButton() {
    const url = this.safeUrl(this.buttonUrl);
    const label = this.escapeHtml(this.buttonLabel.trim());
    this.showButtonDialog = false;
    if (!url || !label) return;

    const colors = this.buttonVariant === 'dark'
      ? { background: '#000000', color: '#ddff53' }
      : this.buttonVariant === 'soft'
        ? { background: '#F2F2F2', color: '#000000' }
        : { background: '#ddff53', color: '#000000' };
    const tableAlign = this.buttonAlign === 'right' ? 'right' : this.buttonAlign === 'left' ? 'left' : 'center';
    setTimeout(() => {
      this.restoreSelection();
      const html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${tableAlign}" style="margin:16px ${this.buttonAlign === 'center' ? 'auto' : '0'};border-collapse:separate;"><tr><td bgcolor="${colors.background}" style="background-color:${colors.background};border-radius:999px;padding:12px 22px;text-align:center;mso-padding-alt:12px 22px;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;color:${colors.color};text-decoration:none;font-weight:700;font-family:Arial,Helvetica,sans-serif;border-radius:999px;">${label}</a></td></tr></table>`;
      if (this.editingButton) {
        this.editingButton.outerHTML = html;
        this.editingButton = null;
      } else {
        document.execCommand('insertHTML', false, html);
      }
    }, 50);
  }

  private safeUrl(value: string): string {
    try {
      const url = new URL(value.trim());
      return url.protocol === 'https:' || url.protocol === 'http:' ? this.escapeHtml(url.toString()) : '';
    } catch {
      return '';
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
  }

  openConfirmDialog() {
    const warnings = this.getPreflightWarnings();
    if (warnings.length && !window.confirm(`בדיקה לפני שליחה:\n${warnings.join('\n')}\n\nלהמשיך בכל זאת?`)) return;
    this.showConfirmDialog = true;
  }

  private getPreflightWarnings(): string[] {
    const root = document.createElement('div');
    root.innerHTML = this.editorBody.nativeElement.innerHTML;
    const warnings: string[] = [];
    if (root.querySelectorAll('img:not([alt]), img[alt=""]').length) warnings.push('• יש תמונה ללא טקסט חלופי');
    if (!root.querySelector('a')) warnings.push('• אין במייל קישור או לחצן');
    if (root.querySelectorAll('a[href=""], a:not([href])').length) warnings.push('• יש קישור ללא כתובת');
    return warnings;
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
        manualRecipients: this.recipientGroup === EmailRecipientGroup.ManualOneTime
          ? this.manualRecipientTokens
          : undefined,
        confirmedManualRecipientPermission: this.recipientGroup === EmailRecipientGroup.ManualOneTime
          ? this.manualPermissionConfirmed
          : undefined,
      })
      .subscribe({
        next: (result) => {
          if (result.success) {
            const item: SavedEmail = { id: Date.now(), subject: this.subject, htmlBody: this.editorBody.nativeElement.innerHTML, fromName: this.fromName, savedAt: new Date().toISOString() };
            this.sentEmails = [item, ...this.sentEmails].slice(0, 30);
            localStorage.setItem('akordish-email-history', JSON.stringify(this.sentEmails));
          }
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
    this.resetRecipientsSelection();
    this.manualRecipientsText = '';
    this.manualRecipientTokens = [];
    this.manualInvalidEmails = [];
    this.manualDuplicateCount = 0;
    this.manualSuppressedCount = 0;
    this.manualEligibleCount = 0;
    this.manualPermissionConfirmed = false;
  }

  get selectedGroupLabel(): string {
    if (this.recipientGroup === EmailRecipientGroup.ManualOneTime) return 'נמענים חד־פעמיים';
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
    if (this.recipientGroup === EmailRecipientGroup.ManualOneTime) {
      const uniqueCount = new Set(this.manualRecipientTokens.map(email => email.toLowerCase())).size;
      if (!this.manualPermissionConfirmed || this.checkingManualRecipients || this.manualValidationFailed) return false;
      if (this.manualInvalidEmails.length > 0 || this.manualEligibleCount === 0) return false;
      if (uniqueCount > this.manualMaxAllowed) return false;
    }
    return true;
  }

  // ── Subscribers tab ──────────────────────────────────────────────

  loadSubscribers(resetPage = false) {
    if (resetPage) this.subscriberPage = 1;
    this.loadingSubscribers = true;
    this.emailService.getSubscribers(
      this.subscriberSearch,
      this.subscriberStatus,
      this.subscriberGroupId ?? undefined,
      this.subscriberPage,
      this.subscriberPageSize,
    ).subscribe({
      next: (result: EmailSubscriberPageDto) => {
        this.subscribers = result.items;
        this.subscribersTotal = result.totalCount;
        this.subscribedCount = result.subscribedCount;
        this.unsubscribedCount = result.unsubscribedCount;
        this.loadingSubscribers = false;
      },
      error: () => { this.loadingSubscribers = false; },
    });
  }

  get subscriberPageCount(): number {
    return Math.max(1, Math.ceil(this.subscribersTotal / this.subscriberPageSize));
  }

  changeSubscriberPage(direction: number) {
    const next = this.subscriberPage + direction;
    if (next < 1 || next > this.subscriberPageCount) return;
    this.subscriberPage = next;
    this.loadSubscribers();
  }

  openCreateSubscriberDialog() {
    this.editingSubscriber = null;
    this.subscriberEmail = '';
    this.subscriberName = '';
    this.subscriberIsSubscribed = true;
    this.subscriberGroupIds = new Set<number>();
    this.showSubscriberDialog = true;
  }

  openEditSubscriberDialog(subscriber: EmailSubscriberDto) {
    this.editingSubscriber = subscriber;
    this.subscriberEmail = subscriber.email;
    this.subscriberName = subscriber.name ?? '';
    this.subscriberIsSubscribed = subscriber.isSubscribed;
    this.subscriberGroupIds = new Set(subscriber.groups.map(group => group.id));
    this.showSubscriberDialog = true;
  }

  toggleSubscriberGroup(groupId: number) {
    const next = new Set(this.subscriberGroupIds);
    next.has(groupId) ? next.delete(groupId) : next.add(groupId);
    this.subscriberGroupIds = next;
  }

  saveSubscriber() {
    if (!this.editingSubscriber && !this.subscriberEmail.trim()) return;
    this.savingSubscriber = true;
    const common = {
      name: this.subscriberName.trim() || undefined,
      isSubscribed: this.subscriberIsSubscribed,
      groupIds: [...this.subscriberGroupIds],
    };
    const request = this.editingSubscriber
      ? this.emailService.updateSubscriber(this.editingSubscriber.id, common)
      : this.emailService.createSubscriber({ email: this.subscriberEmail.trim(), ...common });

    request.subscribe({
      next: () => {
        this.savingSubscriber = false;
        this.showSubscriberDialog = false;
        this.loadSubscribers();
        this.loadGroups();
        this.loadCount();
      },
      error: () => { this.savingSubscriber = false; },
    });
  }

  toggleSubscriberStatus(subscriber: EmailSubscriberDto) {
    this.emailService.updateSubscriber(subscriber.id, {
      name: subscriber.name,
      isSubscribed: !subscriber.isSubscribed,
      groupIds: subscriber.groups.map(group => group.id),
    }).subscribe({
      next: () => {
        this.loadSubscribers();
        this.loadCount();
      },
    });
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
      subscriberIds: this.groupMembers.map(m => m.subscriberId),
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
      this.emailService.getSubscribers(query, 'subscribed', undefined, 1, 10).subscribe({
        next: (result) => {
          this.userSearchResults = result.items.filter(
            subscriber => !this.groupMembers.some(m => m.subscriberId === subscriber.id)
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

  addMemberFromSearch(subscriber: EmailSubscriberDto) {
    if (this.groupMembers.some(m => m.subscriberId === subscriber.id)) return;
    this.groupMembers.push({
      subscriberId: subscriber.id,
      userId: subscriber.userId,
      username: subscriber.name ?? subscriber.email,
      email: subscriber.email,
    });
    this.userSearchQuery = '';
    this.userSearchResults = [];
  }

  removeMember(subscriberId: number) {
    this.groupMembers = this.groupMembers.filter(m => m.subscriberId !== subscriberId);
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
