import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EmailCampaignService,
  EmailRecipientGroup,
  EmailSendResult,
} from '../../../services/email-campaign.service';

@Component({
  selector: 'app-email-campaign',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-campaign.component.html',
  styleUrls: ['./email-campaign.component.css'],
})
export class EmailCampaignComponent implements OnInit {
  @ViewChild('editorBody') editorBody!: ElementRef<HTMLDivElement>;

  subject = '';
  fromName = 'אקורדישקייט';
  recipientGroup = EmailRecipientGroup.AllUsers;
  recipientCount = 0;
  loadingCount = false;

  showPreview = false;
  previewHtml = '';

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
    { value: EmailRecipientGroup.AllUsers, label: 'כל המשתמשים', icon: 'group' },
    { value: EmailRecipientGroup.ActiveOnly, label: 'פעילים בלבד', icon: 'person_check' },
    {
      value: EmailRecipientGroup.MarketingConsentOnly,
      label: 'הסכמת שיווק בלבד',
      icon: 'campaign',
    },
  ];

  constructor(private emailService: EmailCampaignService) {}

  ngOnInit() {
    this.loadCount();
  }

  loadCount() {
    this.loadingCount = true;
    this.emailService.getRecipientCount(this.recipientGroup).subscribe({
      next: (count) => {
        this.recipientCount = count;
        this.loadingCount = false;
      },
      error: () => (this.loadingCount = false),
    });
  }

  onGroupChange() {
    this.loadCount();
  }

  // ── Editor formatting ──────────────────────────────────────────

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
    if (!this.savedRange) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(this.savedRange);
  }

  // ── Link dialog ────────────────────────────────────────────────

  openLinkDialog() {
    this.saveSelection();
    this.linkText = window.getSelection()?.toString() ?? '';
    this.linkUrl = '';
    this.showLinkDialog = true;
  }

  insertLink() {
    this.restoreSelection();
    if (this.linkUrl) {
      const selectedText = window.getSelection()?.toString();
      if (!selectedText && this.linkText) {
        document.execCommand(
          'insertHTML',
          false,
          `<a href="${this.linkUrl}" target="_blank">${this.linkText}</a>`
        );
      } else {
        document.execCommand('createLink', false, this.linkUrl);
        const anchor = window.getSelection()?.anchorNode?.parentElement?.closest('a');
        if (anchor) anchor.target = '_blank';
      }
    }
    this.showLinkDialog = false;
  }

  // ── Image dialog ───────────────────────────────────────────────

  openImageDialog() {
    this.saveSelection();
    this.imageUrl = '';
    this.imageAlt = '';
    this.imageWidth = '100%';
    this.showImageDialog = true;
  }

  insertImage() {
    this.restoreSelection();
    if (this.imageUrl) {
      const widthStyle = this.imageWidth ? `width:${this.imageWidth};` : '';
      const html = `<img src="${this.imageUrl}" alt="${this.imageAlt}" style="max-width:100%;${widthStyle}display:block;margin:8px 0;" />`;
      document.execCommand('insertHTML', false, html);
    }
    this.showImageDialog = false;
  }

  // ── Preview & send ─────────────────────────────────────────────

  togglePreview() {
    this.previewHtml = this.editorBody.nativeElement.innerHTML;
    this.showPreview = !this.showPreview;
  }

  openConfirmDialog() {
    this.previewHtml = this.editorBody.nativeElement.innerHTML;
    this.showConfirmDialog = true;
  }

  sendEmail() {
    this.isSending = true;
    this.emailService
      .sendCampaign({
        subject: this.subject,
        htmlBody: this.editorBody.nativeElement.innerHTML,
        recipientGroup: this.recipientGroup,
        fromName: this.fromName,
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
  }

  get selectedGroupLabel(): string {
    return this.recipientGroups.find((g) => g.value === this.recipientGroup)?.label ?? '';
  }
}
