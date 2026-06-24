import { Injectable } from '@angular/core';
import { UserWithProfileDto } from '../../models/user.model';

export interface ActiveMention {
  start: number;
  end: number;
  query: string;
}

export interface MentionInsertResult {
  value: string;
  cursor: number;
}

@Injectable({ providedIn: 'root' })
export class ContentMentionService {
  getActiveMention(value: string, cursor: number): ActiveMention | null {
    const beforeCursor = value.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex < 0) return null;

    const charBefore = atIndex > 0 ? beforeCursor.charAt(atIndex - 1) : '';
    if (charBefore && !/\s|[\(\[\{>]/.test(charBefore)) return null;

    const query = beforeCursor.slice(atIndex + 1);
    if (/[\n\r\t<>]/.test(query)) return null;
    if (query.length > 40) return null;

    return { start: atIndex, end: cursor, query: query.trim() };
  }

  insertMention(value: string, mention: ActiveMention, profile: UserWithProfileDto): MentionInsertResult {
    const anchor = this.buildMentionAnchor(profile);
    const suffix = value.slice(mention.end);
    const needsSpace = suffix.length === 0 || !/^\s/.test(suffix);
    const inserted = `${anchor}${needsSpace ? ' ' : ''}`;
    const nextValue = `${value.slice(0, mention.start)}${inserted}${suffix}`;

    return {
      value: nextValue,
      cursor: mention.start + inserted.length
    };
  }

  buildMentionAnchor(profile: UserWithProfileDto): string {
    const href = this.escapeAttribute(profile.profileUrl || '#');
    const type = this.escapeAttribute(profile.profileType);
    const id = String(profile.profileId);
    const name = this.escapeHtml(profile.displayName);
    return `<a class="content-mention" data-mention-type="${type}" data-mention-id="${id}" href="${href}">${name}</a>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value).replace(/`/g, '&#96;');
  }
}
