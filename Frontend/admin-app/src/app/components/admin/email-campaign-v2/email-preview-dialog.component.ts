import { Component, input, output, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-email-preview-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: stretch;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .dialog {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      display: flex;
      flex-direction: column;
      max-width: 1000px;
      width: 100%;
      max-height: 95vh;
      overflow: hidden;
    }

    .dialog-header {
      padding: 16px 24px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      gap: 12px;
      flex-wrap: wrap;
    }

    .dialog-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      white-space: nowrap;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 2px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      overflow: hidden;
    }

    .toolbar-btn {
      padding: 6px 10px;
      border: none;
      background: #fff;
      color: #6b7280;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.1s;
    }

    .toolbar-btn:hover { background: #f3f4f6; color: #374151; }
    .toolbar-btn.active { background: #1a73e8; color: #fff; }

    .width-input {
      width: 60px;
      padding: 5px 6px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 13px;
      text-align: center;
    }

    .width-input:focus { outline: none; border-color: #1a73e8; }

    .close-btn {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border: none; border-radius: 6px;
      background: transparent; color: #6b7280; cursor: pointer; font-size: 20px; flex-shrink: 0;
    }

    .close-btn:hover { background: #f3f4f6; color: #1a1a1a; }

    .meta-bar {
      padding: 10px 24px;
      background: #f9fafb;
      border-bottom: 1px solid #f0f0f0;
      flex-shrink: 0;
    }

    .meta-grid {
      display: flex; gap: 24px; flex-wrap: wrap; font-size: 13px; color: #6b7280;
    }

    .meta-item { display: flex; gap: 4px; align-items: baseline; }
    .meta-label { font-weight: 500; color: #9ca3af; }
    .meta-value {
      color: #374151; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .html-size-warning {
      margin: 12px 24px 0;
      padding: 12px 14px;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      background: #fffbeb;
      color: #78350f;
      font-size: 13px;
      line-height: 1.5;
      flex-shrink: 0;
    }

    .html-size-warning strong { display: block; color: #92400e; margin-bottom: 3px; }
    .html-size-warning ul { margin: 7px 0 0; padding: 0 18px 0 0; }
    .html-size-warning li { margin: 2px 0; }

    .html-size-ok {
      color: #047857;
      font-weight: 600;
    }

    .preview-wrapper {
      flex: 1; min-height: 0; display: flex; justify-content: center;
      background: #e5e7eb; overflow: auto; padding: 24px 0;
    }

    .preview-error {
      align-self: center;
      margin: auto;
      max-width: min(48rem, calc(100% - 2rem));
      max-height: 70%;
      overflow: auto;
      padding: 1rem;
      color: #991b1b;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      direction: ltr;
      text-align: left;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    iframe {
      border: 1px solid #d1d5db; border-radius: 4px; background: #fff; flex-shrink: 0;
    }

    .plain-text-preview {
      flex: 1; overflow: auto; padding: 24px; background: #fff;
      font-family: 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6;
      color: #1a1a1a; white-space: pre-wrap; word-break: break-word;
      direction: rtl; text-align: right;
    }

    .dark-mode-notice {
      font-size: 11px; color: #d97706; font-weight: 500;
    }
  `],
  template: `
    <div class="dialog" role="dialog" aria-labelledby="preview-title">
      <div class="dialog-header">
        <div class="dialog-title" id="preview-title">תצוגה מקדימה</div>

        <div class="toolbar">
          <div class="toolbar-group">
            <button class="toolbar-btn" [class.active]="viewMode() === 'desktop'" (click)="viewMode.set('desktop')" title="תצוגת דסקטופ">&#9000; דסקטופ</button>
            <button class="toolbar-btn" [class.active]="viewMode() === 'mobile'" (click)="viewMode.set('mobile')" title="תצוגת מובייל">&#128241; מובייל</button>
            <button class="toolbar-btn" [class.active]="viewMode() === 'custom'" (click)="viewMode.set('custom')" title="רוחב מותאם">&#8608;</button>
          </div>

          @if (viewMode() === 'custom') {
            <input class="width-input" type="number" [ngModel]="customWidth()" (ngModelChange)="customWidth.set($event)" min="200" max="1200" step="10" title="רוחב בפיקסלים" />
          }

          <div class="toolbar-group">
            <button class="toolbar-btn" [class.active]="darkMode()" (click)="darkMode.set(!darkMode())" title="הדמיית מצב כהה">&#9790;</button>
            <button class="toolbar-btn" [class.active]="noImages()" (click)="noImages.set(!noImages())" title="ללא תמונות">&#128443;</button>
            <button class="toolbar-btn" [class.active]="plainText()" (click)="plainText.set(!plainText())" title="גרסת טקסט">&#128196;</button>
          </div>
        </div>

        <button class="close-btn" (click)="onClose.emit()" aria-label="סגור תצוגה מקדימה">&times;</button>
      </div>

      <div class="meta-bar">
        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">נושא:</span><span class="meta-value">{{ subject() || '—' }}</span></div>
          <div class="meta-item"><span class="meta-label">Preheader:</span><span class="meta-value">{{ previewText() || '—' }}</span></div>
          <div class="meta-item"><span class="meta-label">שולח:</span><span class="meta-value">{{ fromName() || '—' }}</span></div>
          <div class="meta-item"><span class="meta-label">גודל HTML:</span><span class="meta-value" [class.html-size-ok]="!htmlSizeInfo().isOverSafetyTarget">{{ htmlSizeInfo().kilobytes }} KB</span></div>
          <div class="meta-item"><span class="meta-label">משוער בשליחה:</span><span class="meta-value" [class.html-size-ok]="!htmlSizeInfo().isOverSafetyTarget">{{ htmlSizeInfo().estimatedSendKilobytes }} KB</span></div>
          @if (darkMode()) {
            <div class="meta-item dark-mode-notice">&#9888; הדמיית Dark Mode משוערת</div>
          }
        </div>
      </div>

      @if (htmlSizeInfo().isOverSafetyTarget) {
        <aside class="html-size-warning" role="alert">
          <strong>⚠️ המייל חורג מיעד הבטיחות של Gmail (90KB) ועלול להיחתך.</strong>
          הגודל המשוער לאחר הוספת מעקב הוא {{ htmlSizeInfo().estimatedSendKilobytes }}KB. גורמי הנפח הבולטים במייל הזה:
          <ul>
            @for (insight of htmlSizeInsights(); track insight.label) {
              <li><strong>{{ insight.label }}:</strong> {{ insight.detail }}</li>
            }
          </ul>
          מומלץ קודם לצמצם כרטיסי תוכן חוזרים או לקצר כתובות קישור ארוכות. התמונות עצמן אינן נספרות לגודל ה־HTML.
        </aside>
      }

      @if (plainText()) {
        <div class="plain-text-preview">{{ plainTextContent() }}</div>
      } @else {
        <div class="preview-wrapper">
          @if (safeHtml(); as html) {
            <iframe [style.width.px]="iframeWidth()" [style.height.px]="700" [srcdoc]="html" sandbox="" title="תצוגה מקדימה של המייל"></iframe>
          } @else if (errorMessage()) {
            <p class="preview-error" role="alert">{{ errorMessage() }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class EmailPreviewDialogComponent {
  readonly htmlBody = input.required<string>();
  readonly errorMessage = input<string>('');
  readonly subject = input<string>('');
  readonly previewText = input<string>('');
  readonly fromName = input<string>('');
  readonly fromEmail = input<string>('');

  readonly onClose = output<void>();

  private sanitizer = inject(DomSanitizer);

  viewMode = signal<'desktop' | 'mobile' | 'custom'>('desktop');
  customWidth = signal(600);
  darkMode = signal(false);
  noImages = signal(false);
  plainText = signal(false);

  htmlSizeInfo = computed(() => {
    const html = this.htmlBody() || '';
    const bytes = new TextEncoder().encode(html).length;
    let trackableLinks = 0;
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      trackableLinks = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .filter(link => {
          const href = (link.getAttribute('href') || '').trim().toLowerCase();
          return !!href && !href.startsWith('#') && !href.startsWith('mailto:') &&
            !href.startsWith('tel:') && !href.includes('unsubscribe');
        }).length;
    } catch { /* Show the raw size when the HTML cannot be parsed. */ }

    // The transient send uses the longest current UTM variant (73 UTF-8 bytes),
    // so this is a conservative estimate of what Gmail will actually receive.
    const estimatedSendBytes = bytes + trackableLinks * 73;
    return {
      bytes,
      kilobytes: (bytes / 1024).toFixed(1),
      estimatedSendBytes,
      estimatedSendKilobytes: (estimatedSendBytes / 1024).toFixed(1),
      isOverSafetyTarget: estimatedSendBytes > 90_000,
    };
  });

  htmlSizeInsights = computed(() => {
    const raw = this.htmlBody();
    if (!raw) return [];

    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const byteLength = (value: string) => new TextEncoder().encode(value).length;
      const images = Array.from(doc.querySelectorAll('img'));
      const tables = doc.querySelectorAll('table').length;
      const inlineStyleBytes = Array.from(doc.querySelectorAll<HTMLElement>('[style]'))
        .reduce((total, element) => total + byteLength(element.getAttribute('style') || ''), 0);
      const linkBytes = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .reduce((total, link) => total + byteLength(link.getAttribute('href') || ''), 0);

      return [
        {
          label: 'כרטיסי תוכן ותמונות',
          detail: `${images.length} תמונות/כרטיסים חוזרים. כל כרטיס מוסיף גם markup של תאימות למיילים.`,
          bytes: images.reduce((total, image) => total + byteLength(image.outerHTML), 0),
        },
        {
          label: 'מבנה תאימות',
          detail: `${tables} טבלאות HTML נוצרו כדי לתמוך ב־Gmail וב־Outlook.`,
          bytes: tables * 32,
        },
        {
          label: 'עיצוב מוטמע',
          detail: `${(inlineStyleBytes / 1024).toFixed(1)}KB של inline styles.`,
          bytes: inlineStyleBytes,
        },
        {
          label: 'קישורים ומעקב',
          detail: `${(linkBytes / 1024).toFixed(1)}KB בכתובות קישור.`,
          bytes: linkBytes,
        },
      ]
        .sort((left, right) => right.bytes - left.bytes)
        .map(({ label, detail }) => ({ label, detail }));
    } catch {
      return [{ label: 'מבנה המייל', detail: 'לא ניתן לנתח את רכיבי ה־HTML באופן מפורט.' }];
    }
  });

  iframeWidth = computed(() => {
    switch (this.viewMode()) {
      case 'desktop': return 700;
      case 'mobile': return 375;
      case 'custom': return Math.max(200, Math.min(1200, this.customWidth()));
    }
  });

  safeHtml = computed((): SafeHtml | null => {
    const raw = this.htmlBody();
    if (!raw) return null;

    let html = this._sanitize(raw);

    if (this.noImages()) {
      html = html.replace(/<img[^>]*>/gi, (match) => {
        const altMatch = match.match(/alt\s*=\s*["']([^"']*)["']/i);
        const alt = altMatch ? altMatch[1] : '[תמונה]';
        return `<span style="display:inline-block;padding:4px 8px;background:#f3f4f6;border:1px dashed #d1d5db;border-radius:4px;color:#9ca3af;font-size:13px">${alt}</span>`;
      });
    }

    if (this.darkMode()) {
      const darkStyles = `<meta name="color-scheme" content="dark"><style>html,body{background-color:#1a1a1a!important;color:#e5e5e5!important}</style>`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', '<head>' + darkStyles);
      } else if (html.includes('<html')) {
        html = html.replace(/(<html[^>]*>)/i, '$1<head>' + darkStyles + '</head>');
      } else {
        html = '<head>' + darkStyles + '</head>' + html;
      }
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  plainTextContent = computed(() => {
    const raw = this.htmlBody();
    if (!raw) return '';

    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const linkMap = new Map<string, number>();
      doc.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (href && !href.startsWith('#') && !linkMap.has(href)) {
          linkMap.set(href, linkMap.size + 1);
        }
      });
      doc.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const num = linkMap.get(href);
        if (num) {
          a.textContent = `${a.textContent} [${num}]`;
        }
      });

      let text = doc.body?.textContent || '';
      linkMap.forEach((num, href) => {
        text += `\n[${num}] ${href}`;
      });

      text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ');
      return text.trim();
    } catch {
      return raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
  });

  private _sanitize(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/ on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/ on\w+\s*=\s*[^\s>]*/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
      .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
  }
}
