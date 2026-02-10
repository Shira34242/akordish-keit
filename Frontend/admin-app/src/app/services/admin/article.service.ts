import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Article,
  CreateArticleDto,
  ArticleCategory,
  ArticleContentType,
  ArticleStatus
} from '../../models/article.model';
import { PagedResult } from '../../models/pagination.model';

export interface ArticleStatsDto {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  scheduledArticles: number;
  totalViews: number;
  totalLikes: number;
  featuredArticles: number;
  newsCount: number;
  blogCount: number;
}

export interface YouTubeMetadataDto {
  success: boolean;
  thumbnailUrl?: string;
  title?: string;
  channelTitle?: string;
  description?: string;
  durationSeconds?: number;
  publishedAt?: Date;
  errorMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ArticleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:44395/api/Articles';

  /**
   * Get all articles with filters and pagination
   */
  getArticles(
    pageNumber: number = 1,
    pageSize: number = 10,
    search?: string,
    categoryId?: number,
    contentType?: ArticleContentType,
    status?: ArticleStatus,
    isFeatured?: boolean,
    isPremium?: boolean,
    authorName?: string
  ): Observable<PagedResult<Article>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }
    if (categoryId !== undefined) {
      params = params.set('categoryId', categoryId.toString());
    }
    if (contentType !== undefined) {
      params = params.set('contentType', contentType.toString());
    }
    if (status !== undefined) {
      params = params.set('status', status.toString());
    }
    if (isFeatured !== undefined) {
      params = params.set('isFeatured', isFeatured.toString());
    }
    if (isPremium !== undefined) {
      params = params.set('isPremium', isPremium.toString());
    }
    if (authorName) {
      params = params.set('authorName', authorName);
    }

    return this.http.get<PagedResult<Article>>(this.apiUrl, { params });
  }

  /**
   * Get article by ID
   */
  getArticle(id: number): Observable<Article> {
    return this.http.get<Article>(`${this.apiUrl}/${id}`);
  }

  /**
   * Get article by slug
   */
  getArticleBySlug(slug: string): Observable<Article> {
    return this.http.get<Article>(`${this.apiUrl}/slug/${slug}`);
  }

  /**
   * Get featured articles
   */
  getFeaturedArticles(contentType?: ArticleContentType, limit: number = 5): Observable<Article[]> {
    let params = new HttpParams().set('limit', limit.toString());

    if (contentType !== undefined) {
      params = params.set('contentType', contentType.toString());
    }

    return this.http.get<Article[]>(`${this.apiUrl}/featured`, { params });
  }

  /**
   * Get article statistics
   */
  getStats(): Observable<ArticleStatsDto> {
    return this.http.get<ArticleStatsDto>(`${this.apiUrl}/stats`);
  }

  /**
   * Create new article
   */
  createArticle(article: CreateArticleDto): Observable<Article> {
    return this.http.post<Article>(this.apiUrl, article);
  }

  /**
   * Update existing article
   */
  updateArticle(id: number, article: CreateArticleDto): Observable<Article> {
    return this.http.put<Article>(`${this.apiUrl}/${id}`, article);
  }

  /**
   * Delete article (soft delete)
   */
  deleteArticle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Increment view count
   */
  incrementView(id: number): Observable<{ viewCount: number }> {
    return this.http.post<{ viewCount: number }>(`${this.apiUrl}/${id}/increment-view`, {});
  }

  /**
   * Increment like count
   */
  incrementLike(id: number): Observable<{ likeCount: number }> {
    return this.http.post<{ likeCount: number }>(`${this.apiUrl}/${id}/increment-like`, {});
  }

  /**
   * Get YouTube video metadata
   */
  getYouTubeMetadata(url: string): Observable<YouTubeMetadataDto> {
    const params = new HttpParams().set('url', url);
    return this.http.get<YouTubeMetadataDto>(`${this.apiUrl}/youtube-metadata`, { params });
  }
}
