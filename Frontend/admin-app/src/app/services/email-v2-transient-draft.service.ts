import { Injectable } from '@angular/core';

/**
 * Holds a one-time Email V2 message only while the administrator moves from
 * design to sending. It is deliberately not persisted: the temporary mode
 * must not create drafts, campaigns, or browser-stored email content.
 */
export interface TransientEmailV2Message {
  subject: string;
  previewText?: string;
  htmlBody: string;
  fromName: string;
  fromEmail?: string;
  /** Editor state for the design ↔ send round trip; never persisted. */
  designJson?: string;
}

@Injectable({ providedIn: 'root' })
export class EmailV2TransientDraftService {
  private message: TransientEmailV2Message | null = null;

  set(message: TransientEmailV2Message): void {
    this.message = { ...message };
  }

  get(): TransientEmailV2Message | null {
    return this.message ? { ...this.message } : null;
  }

  clear(): void {
    this.message = null;
  }
}
