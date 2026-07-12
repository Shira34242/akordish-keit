import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { AddSongRequest, AutocompleteResult, DetectKeyResponse, DuplicateCheckResponse, ImportSongFromUrlResponse, MusicalKey, SongBasicDto, SongDto, SongDuplicateScanResponse, YouTubeMetadata, YouTubeSearchResult } from '../models/song.model';
import { PagedResult } from '../models/pagination.model';

export interface UpdateSongArtistsDto {
    artistIds: number[];
    mode: 'add' | 'replace' | 'remove';
}

export interface BulkUpdateSongArtistsDto extends UpdateSongArtistsDto {
    songIds: number[];
}

export interface UpdateSongUploaderDto {
    uploaderUserId?: number | null;
    uploaderProfileType?: 'artist' | 'serviceProvider' | 'user';
    uploaderProfileId?: number;
}

export interface BulkUpdateSongUploaderDto extends UpdateSongUploaderDto {
    songIds: number[];
}

export interface BulkSongActionResultDto {
    requestedCount: number;
    affectedCount: number;
    songs: SongDto[];
}

@Injectable({
    providedIn: 'root'
})

export class SongService {
    private apiUrl = `${environment.apiBaseUrl}/api/Songs`; // Adjust port if needed

    constructor(private http: HttpClient) { }

    addSong(song: AddSongRequest): Observable<any> {
        return this.http.post<any>(this.apiUrl, song);
    }

    checkDuplicate(title: string): Observable<DuplicateCheckResponse> {
        const params = new HttpParams().set('title', title);
        return this.http.get<DuplicateCheckResponse>(`${this.apiUrl}/check-duplicate`, { params });
    }

    scanDuplicateSongs(): Observable<SongDuplicateScanResponse> {
        return this.http.get<SongDuplicateScanResponse>(`${this.apiUrl}/admin/duplicate-scan`);
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

    searchYouTubeSongs(query: string, maxResults: number = 5): Observable<YouTubeSearchResult[]> {
        const params = new HttpParams()
            .set('query', query)
            .set('maxResults', maxResults.toString());

        return this.http.get<YouTubeSearchResult[]>(`${this.apiUrl}/youtube-search`, { params });
    }

    detectKey(lyricsWithChords: string): Observable<DetectKeyResponse> {
        return this.http.post<DetectKeyResponse>(`${this.apiUrl}/detect-key`, { lyricsWithChords });
    }

    importSongFromUrl(url: string): Observable<ImportSongFromUrlResponse> {
        return this.http.post<ImportSongFromUrlResponse>(`${this.apiUrl}/import-from-url`, { url });
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
        sortBy: string = 'date',
        tagId?: number
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
        if (tagId) {
            params = params.set('tagId', tagId.toString());
        }
        return this.http.get<any>(this.apiUrl, { params });
    }

    getMySongs(pageNumber: number = 1, pageSize: number = 8): Observable<PagedResult<SongBasicDto>> {
        const params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
        return this.http.get<PagedResult<SongBasicDto>>(`${this.apiUrl}/my`, { params });
    }

    getSongById(id: number): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/${id}`);
    }

    incrementView(id: number): Observable<{ viewCount: number }> {
        return this.http.post<{ viewCount: number }>(`${this.apiUrl}/${id}/increment-view`, {});
    }

    getDailyLimitStatus(): Observable<{ limitExceeded: boolean; dailyViewCount: number; dailyLimit: number; remainingViews: number; tagHebrew?: string }> {
        return this.http.get<{ limitExceeded: boolean; dailyViewCount: number; dailyLimit: number; remainingViews: number; tagHebrew?: string }>(`${this.apiUrl}/daily-limit-status`);
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
        return this.http.get<any>(`${environment.apiBaseUrl}/api/Artists?pageSize=100&sortBy=songcount`).pipe(
            map((res: any) => Array.isArray(res) ? res : (res.items || []))
        );
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

    duplicateSong(songId: number): Observable<SongDto> {
        return this.http.post<SongDto>(`${this.apiUrl}/${songId}/duplicate`, {});
    }

    updateSongArtists(songId: number, dto: UpdateSongArtistsDto): Observable<SongDto> {
        return this.http.patch<SongDto>(`${this.apiUrl}/${songId}/artists`, dto);
    }

    bulkUpdateSongArtists(dto: BulkUpdateSongArtistsDto): Observable<BulkSongActionResultDto> {
        return this.http.post<BulkSongActionResultDto>(`${this.apiUrl}/bulk/artists`, dto);
    }

    updateSongUploader(songId: number, dto: UpdateSongUploaderDto): Observable<SongDto> {
        return this.http.patch<SongDto>(`${this.apiUrl}/${songId}/uploader`, dto);
    }

    bulkUpdateSongUploader(dto: BulkUpdateSongUploaderDto): Observable<BulkSongActionResultDto> {
        return this.http.post<BulkSongActionResultDto>(`${this.apiUrl}/bulk/uploader`, dto);
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
        sortBy: string = 'date',
        tagId?: number,
        uploaderSearch?: string,
        dateFrom?: string,
        dateTo?: string,
        isApproved?: boolean
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
        if (tagId) {
            params = params.set('tagId', tagId.toString());
        }
        if (uploaderSearch) {
            params = params.set('uploaderSearch', uploaderSearch);
        }
        if (dateFrom) {
            params = params.set('dateFrom', dateFrom);
        }
        if (dateTo) {
            params = params.set('dateTo', dateTo);
        }
        if (isApproved !== undefined) {
            params = params.set('isApproved', String(isApproved));
        }

        return this.http.get<any>(`${this.apiUrl}/admin/all`, { params });
    }
}
