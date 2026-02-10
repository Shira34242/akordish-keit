import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Artist,
  ArtistListDto,
  UpdateArtistDto,
  AddGalleryImageDto,
  AddVideoDto,
  ArtistGalleryImage,
  ArtistVideo,
  UpdateSocialLinksDto,
  BoostArtistResponse,
  UpgradeToPremiumResponse,
  ArtistStatus
} from '../models/artist.model';
import { PagedResult } from '../models/user.model';
import { SongDto } from '../models/song.model';
import { Article } from '../models/article.model';
import { UpcomingEventDto } from '../models/event.model';

@Injectable({
    providedIn: 'root'
})
export class ArtistService {
    private apiUrl = 'https://localhost:44395/api/Artists';

    constructor(private http: HttpClient) { }

    // ========================================
    // קבלת רשימות אומנים
    // ========================================

    /**
     * קבלת כל האומנים עם פילטרים ו-Pagination
     */
    getArtists(
        isPremium?: boolean,
        status?: ArtistStatus,
        page: number = 1,
        pageSize: number = 20,
        sortBy: string = 'name'
    ): Observable<PagedResult<ArtistListDto>> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('pageSize', pageSize.toString())
            .set('sortBy', sortBy);

        if (status !== undefined) {
            params = params.set('status', status.toString());
        }

        if (isPremium !== undefined) {
            params = params.set('isPremium', isPremium.toString());
        }

        return this.http.get<PagedResult<ArtistListDto>>(this.apiUrl, { params });
    }

    /**
     * אומנים מומלצים (Premium + Boost) - לדף הבית
     */
    getFeaturedArtists(count: number = 10): Observable<ArtistListDto[]> {
        return this.http.get<ArtistListDto[]>(`${this.apiUrl}/featured?count=${count}`);
    }

    /**
     * Top Artists - תאימות לאחור (legacy)
     */
    getTopArtists(count: number = 10): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/top?count=${count}`);
    }

    // ========================================
    // פרטי אומן ותכנים
    // ========================================

    /**
     * קבלת פרטי אומן מלאים
     */
    getArtistById(id: number): Observable<Artist> {
        return this.http.get<Artist>(`${this.apiUrl}/${id}`);
    }

    /**
     * קבלת אומן לפי מזהה משתמש
     */
    getArtistByUserId(userId: number): Observable<Artist | null> {
        return this.http.get<Artist | null>(`${this.apiUrl}/user/${userId}`);
    }

    /**
     * קבלת שירים של אומן
     */
    getArtistSongs(
        id: number,
        page: number = 1,
        pageSize: number = 20
    ): Observable<PagedResult<SongDto>> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('pageSize', pageSize.toString());

        return this.http.get<PagedResult<SongDto>>(
            `${this.apiUrl}/${id}/songs`,
            { params }
        );
    }

    /**
     * קבלת כתבות של אומן
     */
    getArtistArticles(
        id: number,
        page: number = 1,
        pageSize: number = 10
    ): Observable<PagedResult<Article>> {
        const params = new HttpParams()
            .set('page', page.toString())
            .set('pageSize', pageSize.toString());

        return this.http.get<PagedResult<Article>>(
            `${this.apiUrl}/${id}/articles`,
            { params }
        );
    }

    /**
     * קבלת הופעות קרובות של אומן
     */
    getArtistEvents(id: number): Observable<UpcomingEventDto[]> {
        return this.http.get<UpcomingEventDto[]>(`${this.apiUrl}/${id}/events`);
    }

    // ========================================
    // עדכון פרטי אומן
    // ========================================

    /**
     * עדכון פרטי אומן בסיסיים (רק Admin או האומן עצמו)
     */
    updateArtist(id: number, data: UpdateArtistDto): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${id}`, data);
    }

    /**
     * עדכון קישורים לרשתות חברתיות
     */
    updateSocialLinks(id: number, data: UpdateSocialLinksDto): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${id}/social-links`, data);
    }

    // ========================================
    // ניהול גלריה
    // ========================================

    /**
     * הוספת תמונה לגלריה (משלם בלבד)
     */
    addGalleryImage(id: number, data: AddGalleryImageDto): Observable<ArtistGalleryImage> {
        return this.http.post<ArtistGalleryImage>(`${this.apiUrl}/${id}/gallery`, data);
    }

    /**
     * מחיקת תמונה מהגלריה
     */
    deleteGalleryImage(artistId: number, imageId: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${artistId}/gallery/${imageId}`);
    }

    /**
     * עדכון סדר תצוגה של גלריה
     */
    reorderGallery(artistId: number, imageIds: number[]): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${artistId}/gallery/reorder`, { imageIds });
    }

    // ========================================
    // ניהול וידאו
    // ========================================

    /**
     * הוספת וידאו מוטמע (משלם בלבד)
     */
    addVideo(id: number, data: AddVideoDto): Observable<ArtistVideo> {
        return this.http.post<ArtistVideo>(`${this.apiUrl}/${id}/videos`, data);
    }

    /**
     * מחיקת וידאו
     */
    deleteVideo(artistId: number, videoId: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${artistId}/videos/${videoId}`);
    }

    // ========================================
    // קידום ושדרוג
    // ========================================

    /**
     * Boost - קידום חד פעמי (10₪)
     */
    boostArtist(id: number): Observable<BoostArtistResponse> {
        return this.http.post<BoostArtistResponse>(`${this.apiUrl}/${id}/boost`, {});
    }

    /**
     * שדרוג לחשבון משלם
     */
    upgradeToPremium(id: number): Observable<UpgradeToPremiumResponse> {
        return this.http.post<UpgradeToPremiumResponse>(`${this.apiUrl}/${id}/upgrade`, {});
    }

    // ========================================
    // יצירת פרופיל אומן - לציבור
    // ========================================

    /**
     * יצירת פרופיל אומן חדש (משתמש מחובר עם מנוי פעיל)
     */
    createArtistProfile(data: UpdateArtistDto): Observable<Artist> {
        return this.http.post<Artist>(`${this.apiUrl}/create-profile`, data);
    }

    // ========================================
    // Admin - ניהול
    // ========================================

    /**
     * יצירת אומן חדש (Admin בלבד)
     */
    createArtist(data: UpdateArtistDto): Observable<Artist> {
        return this.http.post<Artist>(this.apiUrl, data);
    }

    /**
     * מחיקת אומן (Admin בלבד)
     */
    deleteArtist(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    /**
     * שינוי סטטוס אומן (Admin בלבד)
     */
    updateArtistStatus(id: number, status: ArtistStatus): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${id}/status`, status);
    }
}
