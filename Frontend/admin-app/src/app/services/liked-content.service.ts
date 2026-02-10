import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LikedContent, AddLikedContentDto } from '../models/liked-content.model';

@Injectable({
  providedIn: 'root'
})
export class LikedContentService {
  private apiUrl = 'https://localhost:44395/api/LikedContent';

  constructor(private http: HttpClient) {}

  getUserLikedContent(): Observable<LikedContent[]> {
    return this.http.get<LikedContent[]>(this.apiUrl);
  }

  isContentLiked(contentType: 'Article' | 'BlogPost', contentId: number): Observable<{ isLiked: boolean }> {
    return this.http.get<{ isLiked: boolean }>(`${this.apiUrl}/check/${contentType}/${contentId}`);
  }

  addLikedContent(dto: AddLikedContentDto): Observable<LikedContent> {
    return this.http.post<LikedContent>(this.apiUrl, dto);
  }

  removeLikedContent(contentType: 'Article' | 'BlogPost', contentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${contentType}/${contentId}`);
  }
}
