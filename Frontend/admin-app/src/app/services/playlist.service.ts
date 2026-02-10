import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Playlist,
  PlaylistDetail,
  CreatePlaylistDto,
  UpdatePlaylistDto,
  ReorderPlaylistDto
} from '../models/playlist.model';

@Injectable({
  providedIn: 'root'
})
export class PlaylistService {
  private apiUrl = 'https://localhost:44395/api/Playlists';

  constructor(private http: HttpClient) { }

  /**
   * קבלת כל הרשימות של המשתמש המחובר
   */
  getMyPlaylists(): Observable<Playlist[]> {
    return this.http.get<Playlist[]>(this.apiUrl);
  }

  /**
   * קבלת רשימה ספציפית עם כל השירים
   */
  getPlaylistById(id: number): Observable<PlaylistDetail> {
    return this.http.get<PlaylistDetail>(`${this.apiUrl}/${id}`);
  }

  /**
   * קבלת 2 הרשימות האחרונות (לפופאפ)
   */
  getRecentPlaylists(): Observable<Playlist[]> {
    return this.http.get<Playlist[]>(`${this.apiUrl}/recent`);
  }

  /**
   * קבלת כל הרשימות הציבוריות (מאגר קהילתי)
   */
  getPublicPlaylists(): Observable<Playlist[]> {
    return this.http.get<Playlist[]>(`${this.apiUrl}/public`);
  }

  /**
   * יצירת רשימת השמעה חדשה
   */
  createPlaylist(dto: CreatePlaylistDto): Observable<Playlist> {
    return this.http.post<Playlist>(this.apiUrl, dto);
  }

  /**
   * עדכון פרטי רשימת השמעה
   */
  updatePlaylist(id: number, dto: UpdatePlaylistDto): Observable<Playlist> {
    return this.http.put<Playlist>(`${this.apiUrl}/${id}`, dto);
  }

  /**
   * מחיקת רשימת השמעה
   */
  deletePlaylist(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /**
   * הוספת שיר לרשימת השמעה
   */
  addSongToPlaylist(playlistId: number, songId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${playlistId}/songs/${songId}`, {});
  }

  /**
   * הסרת שיר מרשימת השמעה
   */
  removeSongFromPlaylist(playlistId: number, songId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${playlistId}/songs/${songId}`);
  }

  /**
   * שינוי סדר שירים ברשימת השמעה
   */
  reorderPlaylist(playlistId: number, songIds: number[]): Observable<any> {
    const dto: ReorderPlaylistDto = { songIds };
    return this.http.put(`${this.apiUrl}/${playlistId}/reorder`, dto);
  }

  /**
   * אימוץ רשימה מהמאגר הקהילתי - יצירת עותק של רשימה ציבורית
   */
  adoptPlaylist(playlistId: number): Observable<Playlist> {
    return this.http.post<Playlist>(`${this.apiUrl}/${playlistId}/adopt`, {});
  }

  /**
   * שכפול רשימה קיימת של המשתמש - יצירת עותק זהה
   */
  duplicatePlaylist(playlistId: number): Observable<Playlist> {
    return this.http.post<Playlist>(`${this.apiUrl}/${playlistId}/duplicate`, {});
  }
}
