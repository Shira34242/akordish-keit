import { Injectable } from '@angular/core';

export interface PreflightIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  location?: string;
  actionLabel?: string;
  actionId?: string;
}

export interface PreflightResult {
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
  all: PreflightIssue[];
}

export interface PreflightContext {
  subject: string;
  htmlBody: string;
  designJson: string;
  recipientGroup: number;
  recipientCount: number;
  fromEmail: string;
  status: string;
  previewText?: string;
}

@Injectable({ providedIn: 'root' })
export class PreflightService {
  run(ctx: PreflightContext): PreflightResult {
    const errors: PreflightIssue[] = [];
    const warnings: PreflightIssue[] = [];

    this._checkSubject(ctx, errors);
    this._checkBody(ctx, errors);
    this._checkAudience(ctx, errors);
    this._checkDangerousUrls(ctx, errors);
    this._checkStatus(ctx, errors);
    this._checkMjmlConversion(ctx, errors);
    this._checkMergeTags(ctx, errors, warnings);

    this._checkImageAlt(ctx, warnings);
    this._checkSubjectLength(ctx, warnings);
    this._checkPreheader(ctx, warnings);
    this._checkRelativeLinks(ctx, warnings);
    this._checkPlaceholderText(ctx, warnings);
    this._checkImageCount(ctx, warnings);
    this._checkButtonLabels(ctx, warnings);
    this._checkNonHttpsLinks(ctx, warnings);
    this._checkAdLabel(ctx, warnings);

    return {
      errors,
      warnings,
      all: [...errors, ...warnings],
    };
  }

  private _checkSubject(ctx: PreflightContext, errors: PreflightIssue[]): void {
    if (!ctx.subject?.trim()) {
      errors.push({
        code: 'NO_SUBJECT',
        message: 'נושא המייל חסר',
        severity: 'error',
        location: 'נושא',
        actionLabel: 'הזן נושא',
        actionId: 'subject',
      });
    }
  }

  private _checkBody(ctx: PreflightContext, errors: PreflightIssue[]): void {
    if (!ctx.htmlBody || ctx.htmlBody.trim().length < 50) {
      errors.push({
        code: 'EMPTY_BODY',
        message: 'גוף המייל ריק או קצר מדי',
        severity: 'error',
        location: 'עורך',
        actionLabel: 'עבור לעריכת המייל',
        actionId: 'editor',
      });
    }
  }

  private _checkAudience(ctx: PreflightContext, errors: PreflightIssue[]): void {
    if (ctx.recipientGroup === undefined || ctx.recipientGroup === null) {
      errors.push({
        code: 'NO_AUDIENCE',
        message: 'לא נבחר קהל יעד',
        severity: 'error',
        location: 'קהל יעד',
        actionLabel: 'בחר קהל',
        actionId: 'audience',
      });
    }

    if (ctx.recipientCount <= 0) {
      errors.push({
        code: 'ZERO_RECIPIENTS',
        message: 'מספר הנמענים הוא 0',
        severity: 'error',
        location: 'קהל יעד',
        actionLabel: 'בחר קהל',
        actionId: 'audience',
      });
    }
  }

  private _checkDangerousUrls(ctx: PreflightContext, errors: PreflightIssue[]): void {
    if (!ctx.htmlBody) return;

    this._findUrls(ctx.htmlBody).forEach((url) => {
      const lower = url.toLowerCase().trim();

      if (lower.includes('localhost') || lower.includes('127.0.0.1')) {
        errors.push({
          code: 'LOCALHOST_URL',
          message: `נמצא קישור לכתובת מקומית: ${url}`,
          severity: 'error',
          location: 'קישורים',
          actionLabel: 'תקן בעורך',
          actionId: 'editor',
        });
      }

      if (lower.startsWith('javascript:')) {
        errors.push({
          code: 'JAVASCRIPT_URL',
          message: `נמצא קישור javascript: מסוכן`,
          severity: 'error',
          location: 'קישורים',
          actionLabel: 'תקן בעורך',
          actionId: 'editor',
        });
      }

      if (lower.startsWith('data:')) {
        errors.push({
          code: 'DATA_URL',
          message: `נמצא קישור data: מסוכן`,
          severity: 'error',
          location: 'קישורים',
          actionLabel: 'תקן בעורך',
          actionId: 'editor',
        });
      }
    });
  }

  private _checkStatus(ctx: PreflightContext, errors: PreflightIssue[]): void {
    if (ctx.status === 'sent' || ctx.status === 'in_progress') {
      errors.push({
        code: 'ALREADY_SENT',
        message: 'הקמפיין כבר נשלח או נמצא בתהליך שליחה',
        severity: 'error',
        location: 'סטטוס',
      });
    }
  }

  private _checkMjmlConversion(ctx: PreflightContext, errors: PreflightIssue[]): void {
    if (!ctx.htmlBody) {
      if (ctx.designJson && ctx.designJson !== '{}') {
        errors.push({
          code: 'MJML_NOT_CONVERTED',
          message: 'ה־MJML טרם הומר ל־HTML. שמירה אחרונה עשויה לפתור זאת.',
          severity: 'error',
          location: 'המרה',
          actionLabel: 'שמור',
          actionId: 'save',
        });
      }
    }
  }

  private _checkMergeTags(ctx: PreflightContext, errors: PreflightIssue[], warnings: PreflightIssue[]): void {
    if (!ctx.htmlBody && !ctx.designJson) return;

    const supportedTags = ['{{ params.unsubscribe_url }}'];
    const content = ctx.htmlBody || ctx.designJson;

    const foundTags = content.match(/\{\{[^}]+\}\}/g) || [];
    const unknown = foundTags.filter(
      (tag) => !supportedTags.some((st) => tag.trim() === st.trim()),
    );

    if (unknown.length > 0) {
      errors.push({
        code: 'UNKNOWN_VARIABLE',
        message: `נמצאו משתנים אישיים לא מוכרים: ${unknown.join(', ')}`,
        severity: 'error',
        location: 'משתנים',
      });
    }
  }

  private _checkImageAlt(ctx: PreflightContext, warnings: PreflightIssue[]): void {
    if (!ctx.htmlBody) return;

    const imgs = ctx.htmlBody.match(/<img[^>]*>/gi) || [];
    let missingAlt = 0;
    imgs.forEach((img) => {
      if (!/\balt\s*=\s*["'][^"']*["']/i.test(img)) {
        missingAlt++;
      }
    });

    if (missingAlt > 0) {
      warnings.push({
        code: 'IMG_NO_ALT',
        message: `${missingAlt} תמונות ללא טקסט חלופי (alt)`,
        severity: 'warning',
        location: 'תמונות',
      });
    }
  }

  private _checkSubjectLength(ctx: PreflightContext, warnings: PreflightIssue[]): void {
    if (ctx.subject && ctx.subject.length > 50) {
      warnings.push({
        code: 'LONG_SUBJECT',
        message: `נושא ארוך (${ctx.subject.length} תווים). מומלץ עד 50 תווים לנייד.`,
        severity: 'warning',
        location: 'נושא',
        actionLabel: 'קצר נושא',
        actionId: 'subject',
      });
    }
  }

  private _checkPreheader(ctx: PreflightContext, warnings: PreflightIssue[]): void {
    if (!ctx.previewText?.trim()) {
      warnings.push({
        code: 'NO_PREHEADER',
        message: 'טקסט מקדים (preheader) חסר. הוא מופיע ליד הנושא בתיבת הדואר.',
        severity: 'warning',
        location: 'Preheader',
      });
    }
  }

  private _checkRelativeLinks(ctx: PreflightContext, warnings: PreflightIssue[]): void {
    if (!ctx.htmlBody) return;

    const relativeLinks = this._findRelativeUrls(ctx.htmlBody);
    if (relativeLinks.length > 0) {
      warnings.push({
        code: 'RELATIVE_LINK',
        message: `נמצאו ${relativeLinks.length} קישורים יחסיים. ודא שהם מכוונים לכתובות מלאות.`,
        severity: 'warning',
        location: 'קישורים',
      });
    }
  }

  private _checkPlaceholderText(ctx: PreflightContext, warnings: PreflightIssue[]): void {
    if (!ctx.htmlBody) return;

    const placeholders = [
      'lorem ipsum',
      'טקסט לדוגמה',
    ];

    const found = placeholders.filter((p) =>
      ctx.htmlBody.toLowerCase().includes(p.toLowerCase()),
    );

    if (found.length > 0) {
      warnings.push({
        code: 'PLACEHOLDER_TEXT',
        message: 'נמצא טקסט placeholder במייל. ודא שהחלפת אותו בתוכן אמיתי.',
        severity: 'warning',
        location: 'תוכן',
      });
    }
  }

  private _checkImageCount(ctx: PreflightContext, warnings: PreflightIssue[]): void {
    if (!ctx.htmlBody) return;

    const count = (ctx.htmlBody.match(/<img[^>]*>/gi) || []).length;
    if (count > 20) {
      warnings.push({
        code: 'MANY_IMAGES',
        message: `נמצאו ${count} תמונות. כמות גדולה עלולה להאט טעינה ולהפעיל סינון ספאם.`,
        severity: 'warning',
        location: 'תמונות',
      });
    }
  }

  private _checkButtonLabels(ctx: PreflightContext, warnings: PreflightIssue[]): void {
    if (!ctx.designJson) return;

    try {
      const design = JSON.parse(ctx.designJson);
      const blocks = design?.blocks || design?.content?.blocks || [];

      if (Array.isArray(blocks)) {
        blocks.forEach((block: any) => {
          if (block?.type === 'button') {
            const text = block?.fields?.text || block?.props?.text || '';
            const vagueLabels = ['לחץ כאן', 'click here', 'כאן', 'here', 'לחץ', 'click'];
            if (vagueLabels.some((l) => text.toLowerCase().includes(l.toLowerCase()))) {
              warnings.push({
                code: 'VAGUE_BUTTON',
                message: `טקסט כפתור לא ברור: "${text}". מומלץ להשתמש בטקסט תיאורי כמו "הרשמה" או "קרא עוד".`,
                severity: 'warning',
                location: 'כפתור',
              });
            }
          }
        });
      }
    } catch {
      // JSON parse error, skip
    }
  }

  private _checkNonHttpsLinks(ctx: PreflightContext, warnings: PreflightIssue[]): void {
    if (!ctx.htmlBody) return;

    const httpLinks = this._findUrls(ctx.htmlBody).filter(
      (url) => url.startsWith('http://'),
    );

    if (httpLinks.length > 0) {
      warnings.push({
        code: 'NON_HTTPS_URL',
        message: `נמצאו ${httpLinks.length} קישורי HTTP (לא מאובטחים). מומלץ להשתמש ב־HTTPS.`,
        severity: 'warning',
        location: 'קישורים',
      });
    }
  }

  private _checkAdLabel(ctx: PreflightContext, warnings: PreflightIssue[]): void {
    if (!ctx.designJson) return;

    try {
      const design = JSON.parse(ctx.designJson);
      const blocks = design?.blocks || design?.content?.blocks || [];

      if (Array.isArray(blocks)) {
        const hasAd = blocks.some((b: any) => b?.type?.includes('advertisement'));
        if (hasAd) {
          const hasLabel = blocks.some((b: any) => {
            if (b?.type === 'title' || b?.type === 'paragraph' || b?.type === 'text') {
              const text = (b?.fields?.text || b?.props?.text || '').toLowerCase();
              return text.includes('פרסומת') || text.includes('תוכן שיווקי');
            }
            return false;
          });

          if (!hasLabel) {
            warnings.push({
              code: 'MISSING_AD_LABEL',
              message: 'נמצא רכיב פרסומת ללא תווית "פרסומת" או "תוכן שיווקי". ייתכן שהדבר נדרש לפי חוק.',
              severity: 'warning',
              location: 'פרסומת',
            });
          }
        }
      }
    } catch {
      // JSON parse error, skip
    }
  }

  private _findUrls(html: string): string[] {
    const urls: string[] = [];
    const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = hrefRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    const srcRegex = /src\s*=\s*["']([^"']+)["']/gi;
    while ((match = srcRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    return urls;
  }

  private _findRelativeUrls(html: string): string[] {
    const urls = this._findUrls(html);
    return urls.filter(
      (url) =>
        !url.startsWith('http://') &&
        !url.startsWith('https://') &&
        !url.startsWith('mailto:') &&
        !url.startsWith('tel:') &&
        !url.startsWith('#') &&
        !url.startsWith('{{'),
    );
  }
}
