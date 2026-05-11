import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export enum EmailRecipientGroup {
  AllUsers = 0,
  ActiveOnly = 1,
  MarketingConsentOnly = 2,
}

export interface SendEmailRequest {
  subject: string;
  htmlBody: string;
  plainTextBody?: string;
  recipientGroup: EmailRecipientGroup;
  fromName?: string;
  fromEmail?: string;
}

export interface EmailSendResult {
  success: boolean;
  message: string;
  sentCount: number;
  failedCount: number;
}

@Injectable({ providedIn: 'root' })
export class EmailCampaignService {
  private apiUrl = `${environment.apiBaseUrl}/api/Email`;

  constructor(private http: HttpClient) {}

  getRecipientCount(group: EmailRecipientGroup): Observable<number> {
    const params = new HttpParams().set('group', group.toString());
    return this.http.get<number>(`${this.apiUrl}/recipient-count`, { params, withCredentials: true });
  }

  sendCampaign(request: SendEmailRequest): Observable<EmailSendResult> {
    return this.http.post<EmailSendResult>(`${this.apiUrl}/send-campaign`, request, { withCredentials: true });
  }
}
