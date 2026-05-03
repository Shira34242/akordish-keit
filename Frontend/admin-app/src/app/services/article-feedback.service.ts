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
  likeCount: number;
  feedbackYes: number;
  feedbackNo: number;
  feedbackTotal: number;
  yesPct: number;
}

@Injectable({ providedIn: 'root' })
export class ArticleFeedbackService {
  private apiUrl = `${environment.apiBaseUrl}/api/Articles`;

  constructor(private http: HttpClient) {}

  getFeedback(articleId: number): Observable<ArticleFeedbackResult> {
    return this.http.get<ArticleFeedbackResult>(`${this.apiUrl}/${articleId}/feedback`);
  }

  submitFeedback(articleId: number, isPositive: boolean): Observable<ArticleFeedbackResult> {
    return this.http.post<ArticleFeedbackResult>(`${this.apiUrl}/${articleId}/feedback`, { isPositive });
  }

  getTopContent(limit = 20): Observable<ArticleRank[]> {
    return this.http.get<ArticleRank[]>(`${this.apiUrl}/top-content?limit=${limit}`);
  }
}
