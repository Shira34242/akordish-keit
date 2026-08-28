import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { PagedResult } from '../../../../models/pagination.model';
import { ContentItem } from './types';
import { getArticlePath } from '../../../../utils/article-route.utils';
import { songSlug, artistPath } from '../../../../utils/slug';
import type { Article } from '../../../../models/article.model';
import { cloudflareImageUrl } from '../../../../pipes/cloudflare-image.pipe';

interface SongResponse {
  id: number;
  title: string;
  imageUrl?: string;
  artists?: { id: number; name: string; imageUrl?: string }[];
  viewCount?: number;
  createdAt?: string;
}

interface EventResponse {
  id: number;
  name: string;
  imageUrl?: string;
  bannerImageUrl?: string;
  ticketUrl?: string;
  eventDate: string;
  location?: string;
  artistName?: string;
  taggedArtists?: { artistImageUrl?: string }[];
  isActive: boolean;
  isPast: boolean;
}

interface PodcastEpisodeResponse {
  id: number;
  title: string;
  podcastName: string;
  podcastSlug: string;
  slug: string;
  thumbnailUrl?: string;
  publishedAt: string;
}

interface ArtistListResponse {
  id: number;
  name: string;
  shortBio?: string;
  imageUrl?: string;
  createdAt?: string;
}

interface ProviderResponse {
  id: number;
  displayName: string;
  profileImageUrl?: string;
  cityName?: string;
  categoryName?: string;
  status: number;
}

interface TeacherListResponse {
  id: number;
  displayName: string;
  profileImageUrl?: string;
  cityName?: string;
  categoryName?: string;
  status: number;
  isTeacher: boolean;
}

@Injectable({ providedIn: 'root' })
export class ContentApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/api`;
  private readonly publicSiteUrl = 'https://akordishkayt.com';

  searchArticles(
    search: string,
    pageNumber: number,
    pageSize: number,
    categoryIds?: number[],
    sortBy?: string,
  ): Observable<{ items: ContentItem[]; totalCount: number; hasMore: boolean }> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }
    if (categoryIds && categoryIds.length > 0) {
      for (const id of categoryIds) {
        params = params.append('categoryIds', id.toString());
      }
    }
    if (sortBy) {
      params = params.set('sortBy', sortBy);
    }

    return this.http
      .get<PagedResult<Article>>(`${this.apiUrl}/Articles`, { params, withCredentials: true })
      .pipe(
        map((result) => ({
          items: (result.items || []).map((a) => this.mapArticleToContentItem(a)),
          totalCount: result.totalCount,
          hasMore: result.hasNextPage,
        }))
      );
  }

  searchSongs(
    search: string,
    pageNumber: number,
    pageSize: number
  ): Observable<{ items: ContentItem[]; totalCount: number; hasMore: boolean }> {
    let params = new HttpParams()
      .set('page', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<{ songs: SongResponse[]; totalCount: number; page: number; pageSize: number; totalPages: number }>(
        `${this.apiUrl}/Songs`, { params, withCredentials: true }
      )
      .pipe(
        map((result) => ({
          items: (result.songs || []).map((s) => this.mapSongToContentItem(s)),
          totalCount: result.totalCount,
          hasMore: result.page < result.totalPages,
        }))
      );
  }

  searchEvents(
    search: string,
    pageNumber: number,
    pageSize: number
  ): Observable<{ items: ContentItem[]; totalCount: number; hasMore: boolean }> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<PagedResult<EventResponse>>(`${this.apiUrl}/Events`, { params, withCredentials: true })
      .pipe(
        map((result) => ({
          items: (result.items || []).map((e) => this.mapEventToContentItem(e)),
          totalCount: result.totalCount,
          hasMore: result.hasNextPage,
        }))
      );
  }

  searchPodcastEpisodes(
    search: string,
    pageNumber: number,
    pageSize: number
  ): Observable<{ items: ContentItem[]; totalCount: number; hasMore: boolean }> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<PagedResult<PodcastEpisodeResponse>>(`${this.apiUrl}/Podcasts/public/episodes`, { params, withCredentials: true })
      .pipe(
        map((result) => ({
          items: (result.items || []).map((pe) => this.mapPodcastEpisodeToContentItem(pe)),
          totalCount: result.totalCount,
          hasMore: result.hasNextPage,
        }))
      );
  }

  searchArtists(
    search: string,
    pageNumber: number,
    pageSize: number
  ): Observable<{ items: ContentItem[]; totalCount: number; hasMore: boolean }> {
    let params = new HttpParams()
      .set('page', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<PagedResult<ArtistListResponse>>(`${this.apiUrl}/Artists`, { params, withCredentials: true })
      .pipe(
        map((result) => ({
          items: (result.items || []).map((a) => this.mapArtistToContentItem(a)),
          totalCount: result.totalCount,
          hasMore: result.hasNextPage,
        }))
      );
  }

  searchProviders(
    search: string,
    pageNumber: number,
    pageSize: number
  ): Observable<{ items: ContentItem[]; totalCount: number; hasMore: boolean }> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString())
      .set('status', '1');

    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<PagedResult<ProviderResponse>>(`${this.apiUrl}/MusicServiceProviders`, { params, withCredentials: true })
      .pipe(
        map((result) => ({
          items: (result.items || []).map((p) => this.mapProviderToContentItem(p)),
          totalCount: result.totalCount,
          hasMore: result.hasNextPage,
        }))
      );
  }

  private mapArticleToContentItem(article: Article): ContentItem {
    const publicUrl = `https://akordishkayt.com${getArticlePath(article)}`;
    const catName = article.categoryNames && article.categoryNames.length > 0
      ? article.categoryNames[0]
      : '';

    return {
      id: article.id,
      title: article.title,
      imageUrl: this.toOptimizedEmailImageUrl(article.featuredImageUrl, 480),
      publicUrl,
      altText: article.title,
      categoryName: catName,
      shortDescription: article.shortDescription || '',
      publishDate: article.publishDate,
    };
  }

  private mapSongToContentItem(song: SongResponse): ContentItem {
    const artistNames = song.artists?.map((a) => a.name).join(', ') || '';
    const slug = songSlug({ title: song.title, artistName: artistNames });
    const publicUrl = `https://akordishkayt.com/song/${song.id}${slug ? `/${slug}` : ''}`;

    return {
      id: song.id,
      title: song.title,
      imageUrl: this.toOptimizedEmailImageUrl(song.imageUrl, 240),
      publicUrl,
      altText: song.title,
      artistNames,
      createdAt: song.createdAt,
      viewCount: song.viewCount,
    };
  }

  private mapEventToContentItem(event: EventResponse): ContentItem {
    const publicUrl = this.toPublicAssetUrl(event.ticketUrl) || `${this.publicSiteUrl}/events`;
    const eventDate = event.eventDate ? new Date(event.eventDate).toLocaleDateString('he-IL') : '';
    const imageSource = event.imageUrl || event.bannerImageUrl ||
      event.taggedArtists?.find(artist => !!artist.artistImageUrl)?.artistImageUrl;

    return {
      id: event.id,
      title: event.name,
      imageUrl: this.toOptimizedEmailImageUrl(imageSource, 240),
      publicUrl,
      altText: event.name,
      artistNames: event.artistName,
      location: event.location,
      eventDate,
    };
  }

  private mapPodcastEpisodeToContentItem(episode: PodcastEpisodeResponse): ContentItem {
    const seriesSlug = encodeURIComponent(episode.podcastSlug);
    const episodeSlug = encodeURIComponent(episode.slug);
    const publicUrl = `https://akordishkayt.com/podcasts?series=${seriesSlug}&episode=${episodeSlug}`;

    return {
      id: episode.id,
      title: episode.title,
      imageUrl: this.toOptimizedEmailImageUrl(episode.thumbnailUrl, 480),
      publicUrl,
      altText: episode.title,
      podcastName: episode.podcastName,
      publishDate: episode.publishedAt,
    };
  }

  private mapArtistToContentItem(artist: ArtistListResponse): ContentItem {
    const publicUrl = `https://akordishkayt.com${artistPath(artist)}`;

    return {
      id: artist.id,
      title: artist.name,
      imageUrl: this.toOptimizedEmailImageUrl(artist.imageUrl, 200),
      publicUrl,
      altText: artist.name,
      shortDescription: artist.shortBio,
      createdAt: artist.createdAt,
    };
  }

  private mapProviderToContentItem(provider: ProviderResponse): ContentItem {
    const publicUrl = `https://akordishkayt.com/professional/${provider.id}`;

    return {
      id: provider.id,
      title: provider.displayName,
      imageUrl: this.toOptimizedEmailImageUrl(provider.profileImageUrl, 200),
      publicUrl,
      altText: provider.displayName,
      cityName: provider.cityName,
      categoryName: provider.categoryName,
    };
  }

  searchTeachers(
    search: string,
    pageNumber: number,
    pageSize: number
  ): Observable<{ items: ContentItem[]; totalCount: number; hasMore: boolean }> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString())
      .set('status', '1');

    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<PagedResult<TeacherListResponse>>(`${this.apiUrl}/Teachers`, { params, withCredentials: true })
      .pipe(
        map((result) => ({
          items: (result.items || []).map((t) => this.mapTeacherToContentItem(t)),
          totalCount: result.totalCount,
          hasMore: result.hasNextPage,
        }))
      );
  }

  private mapTeacherToContentItem(teacher: TeacherListResponse): ContentItem {
    const publicUrl = `https://akordishkayt.com/teacher/${teacher.id}`;

    return {
      id: teacher.id,
      title: teacher.displayName,
      imageUrl: this.toOptimizedEmailImageUrl(teacher.profileImageUrl, 200),
      publicUrl,
      altText: teacher.displayName,
      cityName: teacher.cityName,
      categoryName: teacher.categoryName,
    };
  }

  /** Email clients cannot resolve /uploads paths, unlike the admin browser. */
  private toPublicAssetUrl(value?: string): string {
    const url = value?.trim();
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (/^https:\/\//i.test(url)) return url;

    // Never embed a development-only localhost address in an email.
    if (/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(url)) {
      try {
        const parsed = new URL(url);
        return `${this.publicSiteUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        return '';
      }
    }

    return url.startsWith('/') ? `${this.publicSiteUrl}${url}` : '';
  }

  /**
   * Email clients display these cards at 88–300px wide. Requesting a small,
   * high-density derivative avoids downloading an original upload per card.
   */
  private toOptimizedEmailImageUrl(value: string | undefined, width: number): string {
    const publicUrl = this.toPublicAssetUrl(value);
    if (!publicUrl) return '';

    // Do not proxy third-party event posters through our Cloudflare zone. Some
    // providers reject the proxy request even though the public HTTPS image is
    // directly accessible to Gmail. Assets hosted by Akordishkayt still use the
    // lightweight email derivative.
    try {
      const host = new URL(publicUrl).hostname.toLowerCase();
      if (host !== 'akordishkayt.com' && !host.endsWith('.akordishkayt.com'))
        return publicUrl;
    } catch {
      return publicUrl;
    }

    return cloudflareImageUrl(publicUrl, width, 72);
  }
}
