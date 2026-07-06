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
  AllArtistsAll        = 8,
}

export interface SendEmailRequest {
  subject: string;
  htmlBody: string;
  plainTextBody?: string;
  recipientGroup: EmailRecipientGroup;
  emailGroupId?: number;
  fromName?: string;
  fromEmail?: string;
}

export interface EmailSendResult {
  success: boolean;
  message: string;
  sentCount: number;
  failedCount: number;
}

export interface EmailGroupMemberDto {
  userId: number;
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
  userIds: number[];
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

  sendCampaign(request: SendEmailRequest): Observable<EmailSendResult> {
    return this.http.post<EmailSendResult>(`${this.apiUrl}/send-campaign`, request, { withCredentials: true });
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

  // ── Site Interest ────────────────────────────────────────────────

  getSiteInterests(): Observable<SiteInterestDto[]> {
    return this.http.get<SiteInterestDto[]>(`${this.apiUrl}/site-interests`, { withCredentials: true });
  }

  deleteSiteInterest(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/site-interests/${id}`, { withCredentials: true });
  }
}
