import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResult } from '../models/pagination.model';
import {
  AgencyBadgeDto,
  AgencyDto,
  AgencyListDto,
  AgencyProfileDto,
  AgencyContentDto,
  AgencyPublicDto,
  AgencyGalleryImageDto,
  AgencySocialLinkDto,
  CreateAgencyDto,
  UpdateAgencyDto,
  UpsertAgencyContentDto,
  UpsertAgencyProfileDto
} from '../models/agency.model';

export interface AgencyAnalyticsSummary {
  period: { dateFrom: string; dateTo: string };
  totals: {
    pageViews: number;
    bannerClicks: number;
    contactClicks: number;
    profileClicks: number;
    contentClicks: number;
    totalInteractions: number;
  };
  byAgency: {
    agencyId: number;
    agencyName: string;
    agencySlug?: string;
    pageViews: number;
    bannerClicks: number;
    contactClicks: number;
    profileClicks: number;
    contentClicks: number;
    totalInteractions: number;
  }[];
  topDetails: {
    buttonType: string;
    itemId: number;
    itemLabel: string;
    count: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class AgencyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/Agencies`;

  getAgencies(search?: string, isActive?: boolean, pageNumber = 1, pageSize = 20): Observable<PagedResult<AgencyListDto>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (search) params = params.set('search', search);
    if (isActive !== undefined && isActive !== null) params = params.set('isActive', isActive);

    return this.http.get<PagedResult<AgencyListDto>>(this.apiUrl, { params });
  }

  getIndexBanners(limit = 6): Observable<AgencyListDto[]> {
    return this.http.get<AgencyListDto[]>(`${this.apiUrl}/index-banners`, {
      params: new HttpParams().set('limit', limit)
    });
  }

  getAgency(id: number): Observable<AgencyDto> {
    return this.http.get<AgencyDto>(`${this.apiUrl}/${id}`);
  }

  getAgencyBySlug(slug: string): Observable<AgencyPublicDto> {
    return this.http.get<AgencyPublicDto>(`${this.apiUrl}/slug/${slug}`);
  }

  getProfileBadge(profileType: 'artist' | 'serviceProvider' | 'teacher', profileId: number): Observable<AgencyBadgeDto | null> {
    return this.http.get<AgencyBadgeDto | null>(`${this.apiUrl}/profile-badge`, {
      params: new HttpParams().set('profileType', profileType).set('profileId', profileId)
    });
  }

  createAgency(dto: CreateAgencyDto): Observable<AgencyDto> {
    return this.http.post<AgencyDto>(this.apiUrl, dto);
  }

  updateAgency(id: number, dto: UpdateAgencyDto): Observable<AgencyDto> {
    return this.http.put<AgencyDto>(`${this.apiUrl}/${id}`, dto);
  }

  deleteAgency(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  addProfile(agencyId: number, dto: UpsertAgencyProfileDto): Observable<AgencyProfileDto> {
    return this.http.post<AgencyProfileDto>(`${this.apiUrl}/${agencyId}/profiles`, dto);
  }

  removeProfile(agencyId: number, profileLinkId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${agencyId}/profiles/${profileLinkId}`);
  }

  addContent(agencyId: number, dto: UpsertAgencyContentDto): Observable<AgencyContentDto> {
    return this.http.post<AgencyContentDto>(`${this.apiUrl}/${agencyId}/contents`, dto);
  }

  removeContent(agencyId: number, contentLinkId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${agencyId}/contents/${contentLinkId}`);
  }

  getAnalytics(dateFrom?: string, dateTo?: string): Observable<AgencyAnalyticsSummary> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get<AgencyAnalyticsSummary>(`${environment.apiBaseUrl}/api/analytics/agencies`, { params });
  }

  getGalleryImages(agencyId: number): Observable<AgencyGalleryImageDto[]> {
    return this.http.get<AgencyGalleryImageDto[]>(`${this.apiUrl}/${agencyId}/gallery`);
  }

  addGalleryImage(agencyId: number, dto: { imageUrl: string; caption?: string; displayOrder: number }): Observable<AgencyGalleryImageDto> {
    return this.http.post<AgencyGalleryImageDto>(`${this.apiUrl}/${agencyId}/gallery`, dto);
  }

  removeGalleryImage(agencyId: number, imageId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${agencyId}/gallery/${imageId}`);
  }

  getSocialLinks(agencyId: number): Observable<AgencySocialLinkDto[]> {
    return this.http.get<AgencySocialLinkDto[]>(`${this.apiUrl}/${agencyId}/social-links`);
  }

  upsertSocialLink(agencyId: number, dto: AgencySocialLinkDto): Observable<AgencySocialLinkDto> {
    return this.http.post<AgencySocialLinkDto>(`${this.apiUrl}/${agencyId}/social-links`, dto);
  }

  removeSocialLink(agencyId: number, linkId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${agencyId}/social-links/${linkId}`);
  }
}
