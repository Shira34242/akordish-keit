import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ArticleDto {
  id: number;
  title: string;
  slug: string;
  imageUrl?: string;
  featuredImageUrl?: string;
  shortDescription?: string;
  createdAt: string;
  contentType?: number;
  status?: number;
}

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private apiUrl = 'https://localhost:44395/api/Articles';

  constructor(private http: HttpClient) {}

  getMyArticles(): Observable<ArticleDto[]> {
    return this.http.get<ArticleDto[]>(`${this.apiUrl}/my`, { withCredentials: true });
  }
}
