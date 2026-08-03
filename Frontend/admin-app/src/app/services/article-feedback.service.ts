import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ArticleFeedbackResult {
  yesCount: number;
  noCount: number;
  totalCount: number;
  yesPct: number;
  noPct: number;
  hasVoted: boolean;
  userChoice: boolean | null;
}

export interface ArticleRank {
  id: number;
  title: string;
  slug?: string;
  featuredImageUrl?: string;
  contentType: number;
  viewCount: number;
  uniqueVisitors: number;
  totalViewCount: number;
  likeCount: number;
  feedbackYes: number;
  feedbackNo: number;
  feedbackTotal: number;
  yesPct: number;
}

@Injectable({ providedIn: 'root' })
export class ArticleFeedbackService {
  private apiUrl = `${environment.apiBaseUrl}/api/Articles`;
  private readonly guestIdKey = 'ak_article_feedback_guest_id';
  private inMemoryGuestId: string | null = null;

  constructor(private http: HttpClient) {}

  getFeedback(articleId: number): Observable<ArticleFeedbackResult> {
    return this.http.get<ArticleFeedbackResult>(
      `${this.apiUrl}/${articleId}/feedback`,
      { headers: this.getGuestHeaders() }
    );
  }

  submitFeedback(articleId: number, isPositive: boolean): Observable<ArticleFeedbackResult> {
    return this.http.post<ArticleFeedbackResult>(
      `${this.apiUrl}/${articleId}/feedback`,
      { isPositive },
      { headers: this.getGuestHeaders() }
    );
  }

  getTopContent(limit = 20): Observable<ArticleRank[]> {
    return this.http.get<ArticleRank[]>(`${this.apiUrl}/top-content?limit=${limit}`);
  }

  private getGuestHeaders(): Record<string, string> {
    return { 'X-Akordish-Guest-Id': this.getOrCreateGuestId() };
  }

  private getOrCreateGuestId(): string {
    if (this.inMemoryGuestId) return this.inMemoryGuestId;

    try {
      const existing = localStorage.getItem(this.guestIdKey);
      if (existing) {
        this.inMemoryGuestId = existing;
        return existing;
      }
    } catch {
      // Continue with an in-memory id when storage is unavailable.
    }

    const generated = this.createGuestId();
    this.inMemoryGuestId = generated;

    try {
      localStorage.setItem(this.guestIdKey, generated);
    } catch {
      // In-memory id is enough for the current page session.
    }

    return generated;
  }

  private createGuestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}
