import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SaveEmailV2TemplateDto {
  subject: string;
  fromName: string;
  fromEmail?: string;
  designJson: string;
  mjml: string;
  previewText?: string;
  campaignId?: number;
}

export interface EmailV2TemplateDto {
  campaignId: number;
  subject: string;
  fromName: string;
  fromEmail?: string;
  designJson: string;
  htmlBody?: string;
  previewText?: string;
  status: string;
  createdAt: string;
}

export interface EmailV2SendTestDto {
  campaignId: number;
  recipientEmail: string;
}

export interface EmailV2ConversionResultDto {
  success: boolean;
  html?: string;
  error?: string;
  warnings: string[];
}

export interface EmailCampaignAnalytics {
  campaignId: number;
  sentCount: number;
  deliveredCount: number;
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
  hardBounces: number;
  softBounces: number;
  unsubscribes: number;
  spamComplaints: number;
  blocked: number;
  deferred: number;
  failedCount: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  ctorRate: number;
  topLinks: { url: string; uniqueClicks: number; totalClicks: number }[];
  campaignStatus: string;
  lastUpdatedAt: string;
}

export interface EmailDesignVersion {
  campaignId: number;
  version: number;
  subject: string;
  preheader?: string;
  fromName?: string;
  designJson: string;
  createdAt: string;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class EmailCampaignV2Service {
  private apiUrl = `${environment.apiBaseUrl}/api/Email/v2`;

  constructor(private http: HttpClient) {}

  saveTemplate(dto: SaveEmailV2TemplateDto): Observable<EmailV2TemplateDto> {
    return this.http.post<EmailV2TemplateDto>(`${this.apiUrl}/templates`, dto, { withCredentials: true });
  }

  getTemplate(campaignId: number): Observable<EmailV2TemplateDto> {
    return this.http.get<EmailV2TemplateDto>(`${this.apiUrl}/templates/${campaignId}`, { withCredentials: true });
  }

  convertToHtml(dto: SaveEmailV2TemplateDto): Observable<EmailV2ConversionResultDto> {
    return this.http.post<EmailV2ConversionResultDto>(`${this.apiUrl}/convert`, dto, { withCredentials: true });
  }

  sendTest(dto: EmailV2SendTestDto): Observable<EmailV2ConversionResultDto> {
    return this.http.post<EmailV2ConversionResultDto>(`${this.apiUrl}/send-test`, dto, { withCredentials: true });
  }

  getTemplates(): Observable<EmailV2TemplateDto[]> {
    return this.http.get<EmailV2TemplateDto[]>(`${this.apiUrl}/templates`, { withCredentials: true });
  }

  deleteTemplate(campaignId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/templates/${campaignId}`, { withCredentials: true });
  }

  getAnalytics(campaignId: number): Observable<EmailCampaignAnalytics> {
    return this.http.get<EmailCampaignAnalytics>(`${this.apiUrl}/${campaignId}/analytics`, { withCredentials: true });
  }

  getVersions(campaignId: number): Observable<EmailDesignVersion[]> {
    return this.http.get<EmailDesignVersion[]>(`${this.apiUrl}/${campaignId}/versions`, { withCredentials: true });
  }

  getVersion(campaignId: number, version: number): Observable<EmailDesignVersion> {
    return this.http.get<EmailDesignVersion>(`${this.apiUrl}/${campaignId}/versions/${version}`, { withCredentials: true });
  }

  restoreVersion(campaignId: number, version: number): Observable<EmailV2TemplateDto> {
    return this.http.post<EmailV2TemplateDto>(`${this.apiUrl}/${campaignId}/versions/${version}/restore`, {}, { withCredentials: true });
  }

  sendCampaign(dto: { campaignId: number; subject: string; htmlBody: string; fromName?: string; fromEmail?: string; recipientGroup: number; emailGroupId?: number; utmEnabled?: boolean }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/send-campaign`, dto, { withCredentials: true });
  }
}
