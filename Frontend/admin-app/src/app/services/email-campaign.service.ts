import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export enum EmailRecipientGroup {
  AllUsers             = 0,
  ActiveOnly           = 1,
  MarketingConsentOnly = 2,
  AllTeachers          = 3,
  AllArtists           = 4,
  AllServiceProviders  = 5,
  InterestedInSite     = 6,
  CustomGroup          = 7,
  NoProfessionalProfile = 8,
}

export interface SendEmailRequest {
  subject: string;
  htmlBody: string;
  plainTextBody?: string;
  recipientGroup: EmailRecipientGroup;
  emailGroupId?: number;
  fromName?: string;
  fromEmail?: string;
  excludedEmails?: string[];
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailSendResult {
  success: boolean;
  message: string;
  sentCount: number;
  failedCount: number;
}

export interface SendTestEmailRequest extends SendEmailRequest {
  recipientEmail: string;
}

export interface MarketingUnsubscribeResult {
  success: boolean;
  message: string;
}

export interface EmailGroupMemberDto {
  subscriberId: number;
  userId?: number;
  username: string;
  email: string;
}

export interface EmailGroupDto {
  id: number;
  name: string;
  description?: string;
  memberCount: number;
  createdAt: string;
  members: EmailGroupMemberDto[];
}

export interface SaveEmailGroupDto {
  name: string;
  description?: string;
  subscriberIds: number[];
}

export interface EmailSubscriberGroupDto {
  id: number;
  name: string;
}

export interface EmailSubscriberDto {
  id: number;
  email: string;
  name?: string;
  userId?: number;
  isSubscribed: boolean;
  source: string;
  subscribedAt: string;
  unsubscribedAt?: string;
  groups: EmailSubscriberGroupDto[];
}

export interface EmailSubscriberPageDto {
  items: EmailSubscriberDto[];
  totalCount: number;
  subscribedCount: number;
  unsubscribedCount: number;
}

export interface SaveEmailSubscriberDto {
  email: string;
  name?: string;
  isSubscribed: boolean;
  groupIds: number[];
}

export interface SiteInterestDto {
  id: number;
  email: string;
  source?: string;
  createdAt: string;
  isReadOnly: boolean;
}

@Injectable({ providedIn: 'root' })
export class EmailCampaignService {
  private apiUrl = `${environment.apiBaseUrl}/api/Email`;

  constructor(private http: HttpClient) {}

  getRecipientCount(group: EmailRecipientGroup, emailGroupId?: number): Observable<number> {
    let params = new HttpParams().set('group', group.toString());
    if (emailGroupId != null) params = params.set('emailGroupId', emailGroupId.toString());
    return this.http.get<number>(`${this.apiUrl}/recipient-count`, { params, withCredentials: true });
  }

  getRecipients(group: EmailRecipientGroup, emailGroupId?: number): Observable<EmailRecipient[]> {
    let params = new HttpParams().set('group', group.toString());
    if (emailGroupId != null) params = params.set('emailGroupId', emailGroupId.toString());
    return this.http.get<EmailRecipient[]>(`${this.apiUrl}/recipients`, { params, withCredentials: true });
  }

  previewEmail(subject: string, htmlBody: string): Observable<{ html: string }> {
    return this.http.post<{ html: string }>(`${this.apiUrl}/preview`, { subject, htmlBody }, { withCredentials: true });
  }

  sendCampaign(request: SendEmailRequest): Observable<EmailSendResult> {
    return this.http.post<EmailSendResult>(`${this.apiUrl}/send-campaign`, request, { withCredentials: true });
  }

  sendTestEmail(request: SendTestEmailRequest): Observable<EmailSendResult> {
    return this.http.post<EmailSendResult>(`${this.apiUrl}/send-test`, request, { withCredentials: true });
  }

  unsubscribe(token: string): Observable<MarketingUnsubscribeResult> {
    return this.http.post<MarketingUnsubscribeResult>(`${this.apiUrl}/unsubscribe`, { token });
  }

  // ── Email Groups ────────────────────────────────────────────────

  getGroups(): Observable<EmailGroupDto[]> {
    return this.http.get<EmailGroupDto[]>(`${this.apiUrl}/groups`, { withCredentials: true });
  }

  createGroup(dto: SaveEmailGroupDto): Observable<EmailGroupDto> {
    return this.http.post<EmailGroupDto>(`${this.apiUrl}/groups`, dto, { withCredentials: true });
  }

  updateGroup(id: number, dto: SaveEmailGroupDto): Observable<EmailGroupDto> {
    return this.http.put<EmailGroupDto>(`${this.apiUrl}/groups/${id}`, dto, { withCredentials: true });
  }

  deleteGroup(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/groups/${id}`, { withCredentials: true });
  }

  getSubscribers(
    search = '', status = 'all', groupId?: number, page = 1, pageSize = 25
  ): Observable<EmailSubscriberPageDto> {
    let params = new HttpParams()
      .set('search', search)
      .set('status', status)
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    if (groupId != null) params = params.set('groupId', groupId.toString());
    return this.http.get<EmailSubscriberPageDto>(`${this.apiUrl}/subscribers`, { params, withCredentials: true });
  }

  createSubscriber(dto: SaveEmailSubscriberDto): Observable<EmailSubscriberDto> {
    return this.http.post<EmailSubscriberDto>(`${this.apiUrl}/subscribers`, dto, { withCredentials: true });
  }

  updateSubscriber(id: number, dto: Omit<SaveEmailSubscriberDto, 'email'>): Observable<EmailSubscriberDto> {
    return this.http.put<EmailSubscriberDto>(`${this.apiUrl}/subscribers/${id}`, dto, { withCredentials: true });
  }

  // ── Site Interest ────────────────────────────────────────────────

  getSiteInterests(): Observable<SiteInterestDto[]> {
    return this.http.get<SiteInterestDto[]>(`${this.apiUrl}/site-interests`, { withCredentials: true });
  }

  deleteSiteInterest(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/site-interests/${id}`, { withCredentials: true });
  }
}
