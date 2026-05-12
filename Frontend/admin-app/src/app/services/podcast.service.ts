import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResult } from '../models/pagination.model';
import {
  CreatePodcastDto,
  CreatePodcastEpisodeDto,
  Podcast,
  PodcastDetail,
  PodcastEpisode,
  PodcastEpisodeDetail,
  UpdatePodcastDto,
  UpdatePodcastEpisodeDto
} from '../models/podcast.model';

@Injectable({ providedIn: 'root' })
export class PodcastService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/Podcasts`;

  getPodcasts(pageNumber = 1, pageSize = 20, search?: string, isActive?: boolean): Observable<PagedResult<Podcast>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (search) params = params.set('search', search);
    if (isActive !== undefined) params = params.set('isActive', isActive);

    return this.http.get<PagedResult<Podcast>>(this.apiUrl, { params });
  }

  getPublicPodcasts(): Observable<Podcast[]> {
    return this.http.get<Podcast[]>(`${this.apiUrl}/public`);
  }

  getPodcastBySlug(slug: string): Observable<PodcastDetail> {
    return this.http.get<PodcastDetail>(`${this.apiUrl}/by-slug/${slug}`);
  }

  getPodcast(id: number): Observable<Podcast> {
    return this.http.get<Podcast>(`${this.apiUrl}/${id}`);
  }

  createPodcast(dto: CreatePodcastDto): Observable<Podcast> {
    return this.http.post<Podcast>(this.apiUrl, dto);
  }

  updatePodcast(id: number, dto: UpdatePodcastDto): Observable<Podcast> {
    return this.http.put<Podcast>(`${this.apiUrl}/${id}`, dto);
  }

  deletePodcast(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getLatestEpisodes(limit = 8): Observable<PodcastEpisode[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<PodcastEpisode[]>(`${this.apiUrl}/latest-episodes`, { params });
  }

  getPublicEpisodes(pageNumber = 1, pageSize = 12, podcastId?: number, search?: string): Observable<PagedResult<PodcastEpisode>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (podcastId !== undefined) params = params.set('podcastId', podcastId);
    if (search) params = params.set('search', search);

    return this.http.get<PagedResult<PodcastEpisode>>(`${this.apiUrl}/public/episodes`, { params });
  }

  getEpisodeBySlug(podcastSlug: string, episodeSlug: string): Observable<PodcastEpisodeDetail> {
    return this.http.get<PodcastEpisodeDetail>(`${this.apiUrl}/episode/${podcastSlug}/${episodeSlug}`);
  }

  getEpisodes(pageNumber = 1, pageSize = 20, podcastId?: number, search?: string, isActive?: boolean): Observable<PagedResult<PodcastEpisode>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (podcastId !== undefined) params = params.set('podcastId', podcastId);
    if (search) params = params.set('search', search);
    if (isActive !== undefined) params = params.set('isActive', isActive);

    return this.http.get<PagedResult<PodcastEpisode>>(`${this.apiUrl}/episodes`, { params });
  }

  getEpisode(id: number): Observable<PodcastEpisode> {
    return this.http.get<PodcastEpisode>(`${this.apiUrl}/episodes/${id}`);
  }

  createEpisode(dto: CreatePodcastEpisodeDto): Observable<PodcastEpisode> {
    return this.http.post<PodcastEpisode>(`${this.apiUrl}/episodes`, dto);
  }

  updateEpisode(id: number, dto: UpdatePodcastEpisodeDto): Observable<PodcastEpisode> {
    return this.http.put<PodcastEpisode>(`${this.apiUrl}/episodes/${id}`, dto);
  }

  deleteEpisode(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/episodes/${id}`);
  }
}
