import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export enum ContentPromotionTargetType {
  Article = 1,
  Artist = 2,
  ServiceProvider = 3,
  Teacher = 4,
  Song = 5,
  Podcast = 6,
  PodcastEpisode = 7
}

export enum ContentPromotionPlacement {
  General = 1,
  Home = 2,
  Index = 3,
  Featured = 4
}

export interface ContentPromotionDto {
  id: number;
  targetType: ContentPromotionTargetType;
  targetId: number;
  placement: ContentPromotionPlacement;
  priority: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  showOnHome: boolean;
  note?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  isCurrentlyActive: boolean;
}

export interface BulkUpsertContentPromotionDto {
  targetType: ContentPromotionTargetType;
  targetIds: number[];
  placement: ContentPromotionPlacement;
  priority: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  showOnHome: boolean;
  note?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ContentPromotionService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/admin/ContentPromotions`;

  constructor(private http: HttpClient) {}

  getPromotions(
    targetType?: ContentPromotionTargetType,
    targetId?: number,
    placement?: ContentPromotionPlacement
  ): Observable<ContentPromotionDto[]> {
    let params = new HttpParams();
    if (targetType) params = params.set('targetType', String(targetType));
    if (targetId) params = params.set('targetId', String(targetId));
    if (placement) params = params.set('placement', String(placement));
    return this.http.get<ContentPromotionDto[]>(this.apiUrl, { params });
  }

  bulkUpsert(dto: BulkUpsertContentPromotionDto): Observable<ContentPromotionDto[]> {
    return this.http.post<ContentPromotionDto[]>(`${this.apiUrl}/bulk`, dto);
  }

  deactivate(
    targetType: ContentPromotionTargetType,
    targetId: number,
    placement: ContentPromotionPlacement
  ): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${targetType}/${targetId}/${placement}`);
  }
}
