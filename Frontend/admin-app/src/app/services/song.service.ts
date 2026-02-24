import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { AddSongRequest, AutocompleteResult, DuplicateCheckResponse, MusicalKey, SongDto, YouTubeMetadata } from '../models/song.model';

@Injectable({
    providedIn: 'root'
})

export class SongService {
    private apiUrl = 'https://localhost:44395/api/Songs'; // Adjust port if needed

    constructor(private http: HttpClient) { }

    addSong(song: AddSongRequest): Observable<any> {
        return this.http.post<any>(this.apiUrl, song);
    }

    checkDuplicate(title: string): Observable<DuplicateCheckResponse> {
        const params = new HttpParams().set('title', title);
        return this.http.get<DuplicateCheckResponse>(`${this.apiUrl}/check-duplicate`, { params });
    }

    autocompleteArtists(query: string): Observable<AutocompleteResult[]> {
        const params = new HttpParams().set('query', query);
        return this.http.get<AutocompleteResult[]>(`${this.apiUrl}/autocomplete/artists`, { params });
    }

    autocompleteTags(query: string): Observable<AutocompleteResult[]> {
        const params = new HttpParams().set('query', query);
        return this.http.get<AutocompleteResult[]>(`${this.apiUrl}/autocomplete/tags`, { params });
    }

    autocompletePeople(query: string): Observable<AutocompleteResult[]> {
        return this.http.get<AutocompleteResult[]>(`${this.apiUrl}/autocomplete/people?query=${encodeURIComponent(query)}`);
    }

    autocompleteGenres(query: string): Observable<AutocompleteResult[]> {
        const params = new HttpParams().set('query', query);
        return this.http.get<AutocompleteResult[]>(`${this.apiUrl}/autocomplete/genres`, { params });
    }

    getYouTubeMetadata(url: string): Observable<YouTubeMetadata> {
        return this.http.post<YouTubeMetadata>(`${this.apiUrl}/youtube-metadata`, JSON.stringify(url), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    getMusicalKeys(): Observable<MusicalKey[]> {
        return this.http.get<MusicalKey[]>(`${this.apiUrl}/musical-keys`);
    }

    getSongs(
        search?: string | undefined,
        page: number = 1,
        pageSize: number = 20,
        artistId?: number,
        genreId?: number,
        keyId?: number,
        sortBy: string = 'date'
    ): Observable<any> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('pageSize', pageSize.toString())
            .set('sortBy', sortBy);

        if (search) {
            params = params.set('search', search);
        }
        if (artistId) {
            params = params.set('artistId', artistId.toString());
        }
        if (genreId) {
            params = params.set('genreId', genreId.toString());
        }
        if (keyId) {
            params = params.set('keyId', keyId.toString());
        }

        return this.http.get<any>(this.apiUrl, { params });
    }

    getSongById(id: number): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/${id}`);
    }

    incrementView(id: number): Observable<{ viewCount: number }> {
        return this.http.post<{ viewCount: number }>(`${this.apiUrl}/${id}/increment-view`, {});
    }

    getRandomSong(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/random`);
    }
    canEditSong(songId: number): Observable<boolean> {
        const csrfToken = localStorage.getItem('csrf-token');

        if (!csrfToken) {
            return of(false);
        }

        const headers = new HttpHeaders({
            'X-CSRF-Token': csrfToken
        });

        return this.http.get<boolean>(`${this.apiUrl}/${songId}/can-edit`, {
            headers,
            withCredentials: true  // שליחת httpOnly cookie
        }).pipe(
            catchError(() => of(false))
        );
    }

    updateSong(songId: number, request: AddSongRequest): Observable<any> {
        const csrfToken = localStorage.getItem('csrf-token');
        const headers = new HttpHeaders({
            'X-CSRF-Token': csrfToken || ''
        });

        return this.http.put(`${this.apiUrl}/${songId}`, request, {
            headers,
            withCredentials: true
        });
    }
    getSongsByArtist(artistId: number, limit: number = 6): Observable<any[]> {
        return this.http.get<any>(`${this.apiUrl}?artistId=${artistId}&pageSize=${limit}`).pipe(
            map((response: any) => response.songs || []),
            catchError(() => of([]))
        );
    }

    getPopularSongs(limit: number = 5): Observable<any[]> {
        return this.http.get<any>(`${this.apiUrl}?sortBy=views&pageSize=${limit}`).pipe(
            map((response: any) => response.songs || []),
            catchError(() => of([]))
        );
    }
    getAllArtists(): Observable<any[]> {
        return this.http.get<any[]>('https://localhost:44395/api/Artists');
    }

    getGenres(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/genres`);
    }

    /**
     * Delete a song (admin only)
     */
    deleteSong(songId: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${songId}`);
    }

    /**
     * Toggle song approval status (admin only)
     */
    toggleApproval(songId: number, isApproved: boolean): Observable<any> {
        return this.http.patch<any>(`${this.apiUrl}/${songId}/approval`, { isApproved });
    }

    /**
     * Get song by ID for admin (includes unapproved songs)
     */
    getSongByIdForAdmin(songId: number): Observable<SongDto> {
        return this.http.get<SongDto>(`${this.apiUrl}/${songId}/admin`);
    }

    /**
     * Get all songs for admin (includes unapproved songs)
     */
    getSongsForAdmin(
        search?: string | undefined,
        page: number = 1,
        pageSize: number = 20,
        artistId?: number,
        genreId?: number,
        keyId?: number,
        sortBy: string = 'date'
    ): Observable<any> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('pageSize', pageSize.toString())
            .set('sortBy', sortBy);

        if (search) {
            params = params.set('search', search);
        }
        if (artistId) {
            params = params.set('artistId', artistId.toString());
        }
        if (genreId) {
            params = params.set('genreId', genreId.toString());
        }
        if (keyId) {
            params = params.set('keyId', keyId.toString());
        }

        return this.http.get<any>(`${this.apiUrl}/admin/all`, { params });
    }
}
