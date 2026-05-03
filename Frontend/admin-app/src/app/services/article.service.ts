import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResult } from '../models/pagination.model';

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
  private apiUrl = `${environment.apiBaseUrl}/api/Articles`;

  constructor(private http: HttpClient) {}

  getMyArticles(pageNumber: number = 1, pageSize: number = 8): Observable<PagedResult<ArticleDto>> {
    const params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    return this.http.get<PagedResult<ArticleDto>>(`${this.apiUrl}/my`, { params, withCredentials: true });
  }
}
