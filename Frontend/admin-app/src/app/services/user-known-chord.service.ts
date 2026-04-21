import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { parseChord } from '../utils/music-utils';

export type KnownChordInstrument = 'guitar' | 'piano' | 'ukulele';
export type KnownChordSort = 'exact' | 'closest' | 'known' | 'popular' | 'name';

export interface UserKnownChord {
    id: number;
    instrument: KnownChordInstrument;
    chordName: string;
    normalizedChordName: string;
    addedAt: string;
}

export interface KnownChordSongSummary {
    totalChords: number;
    knownChords: number;
    missingChords: number;
    missingChordNames: string[];
    knowsAll: boolean;
}

export interface KnownChordSongMatch {
    id: number;
    title: string;
    artists: any[];
    imageUrl?: string;
    viewCount: number;
    totalChordCount: number;
    knownChordCount: number;
    missingChordCount: number;
    missingChordNames: string[];
    knowsAllChords: boolean;
}

export interface KnownChordSongsResponse {
    songs: KnownChordSongMatch[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class UserKnownChordService {
    private apiUrl = 'https://localhost:44395/api/UserKnownChords';
    private loaded = new Set<KnownChordInstrument>();
    private knownByInstrument: Record<KnownChordInstrument, Set<string>> = {
        guitar: new Set<string>(),
        piano: new Set<string>(),
        ukulele: new Set<string>(),
    };

    private knownSubject = new BehaviorSubject<Record<KnownChordInstrument, Set<string>>>(this.cloneKnown());
    known$ = this.knownSubject.asObservable();

    constructor(private http: HttpClient) {}

    ensureLoaded(instrument: KnownChordInstrument): Observable<UserKnownChord[]> {
        if (this.loaded.has(instrument)) {
            return of([]);
        }

        const params = new HttpParams().set('instrument', instrument);
        return this.http.get<UserKnownChord[]>(this.apiUrl, { params, withCredentials: true }).pipe(
            tap(chords => {
                this.knownByInstrument[instrument] = new Set(
                    chords.map(chord => chord.normalizedChordName)
                );
                this.loaded.add(instrument);
                this.emit();
            }),
            catchError(() => of([]))
        );
    }

    getKnownChords(): Observable<UserKnownChord[]> {
        return this.http.get<UserKnownChord[]>(this.apiUrl, { withCredentials: true }).pipe(
            tap(chords => {
                this.knownByInstrument = {
                    guitar: new Set(chords.filter(chord => chord.instrument === 'guitar').map(chord => chord.normalizedChordName)),
                    piano: new Set(chords.filter(chord => chord.instrument === 'piano').map(chord => chord.normalizedChordName)),
                    ukulele: new Set(chords.filter(chord => chord.instrument === 'ukulele').map(chord => chord.normalizedChordName)),
                };
                this.loaded.add('guitar');
                this.loaded.add('piano');
                this.loaded.add('ukulele');
                this.emit();
            }),
            catchError(() => of([]))
        );
    }

    isKnown(instrument: KnownChordInstrument, chordName: string): boolean {
        return this.knownByInstrument[instrument].has(this.normalizeChordName(chordName));
    }

    add(instrument: KnownChordInstrument, chordName: string): Observable<UserKnownChord | null> {
        return this.http.post<UserKnownChord>(this.apiUrl, { instrument, chordName }, { withCredentials: true }).pipe(
            tap(chord => {
                this.knownByInstrument[instrument].add(chord.normalizedChordName);
                this.loaded.add(instrument);
                this.emit();
            }),
            catchError(() => of(null))
        );
    }

    remove(instrument: KnownChordInstrument, chordName: string): Observable<boolean> {
        const encodedChord = encodeURIComponent(chordName);
        return this.http.delete(`${this.apiUrl}/${instrument}/${encodedChord}`, { withCredentials: true }).pipe(
            tap(() => {
                this.knownByInstrument[instrument].delete(this.normalizeChordName(chordName));
                this.emit();
            }),
            map(() => true),
            catchError(() => of(false))
        );
    }

    toggle(instrument: KnownChordInstrument, chordName: string): Observable<boolean> {
        if (this.isKnown(instrument, chordName)) {
            return this.remove(instrument, chordName);
        }

        return this.add(instrument, chordName).pipe(map(chord => !!chord));
    }

    getMatchingSongs(
        instrument: KnownChordInstrument,
        sortBy: KnownChordSort = 'closest',
        page: number = 1,
        pageSize: number = 20,
        maxMissing: number = -1
    ): Observable<KnownChordSongsResponse> {
        const params = new HttpParams()
            .set('instrument', instrument)
            .set('maxMissing', maxMissing.toString())
            .set('sortBy', sortBy)
            .set('page', page.toString())
            .set('pageSize', pageSize.toString());

        return this.http.get<KnownChordSongsResponse>(`${this.apiUrl}/matching-songs`, {
            params,
            withCredentials: true,
        }).pipe(
            catchError(() => of({
                songs: [],
                totalCount: 0,
                page,
                pageSize,
                totalPages: 0,
            }))
        );
    }

    buildLocalSummary(instrument: KnownChordInstrument, chords: string[]): KnownChordSongSummary {
        const displayByNormalized = new Map<string, string>();
        for (const chord of chords) {
            const normalized = this.normalizeChordName(chord);
            if (normalized && !displayByNormalized.has(normalized)) {
                displayByNormalized.set(normalized, chord);
            }
        }

        const missingChordNames = [...displayByNormalized.entries()]
            .filter(([normalized]) => !this.knownByInstrument[instrument].has(normalized))
            .map(([, display]) => display)
            .sort((a, b) => a.localeCompare(b));

        const totalChords = displayByNormalized.size;
        return {
            totalChords,
            knownChords: totalChords - missingChordNames.length,
            missingChords: missingChordNames.length,
            missingChordNames,
            knowsAll: totalChords > 0 && missingChordNames.length === 0,
        };
    }

    resetCache(): void {
        this.loaded.clear();
        this.knownByInstrument = {
            guitar: new Set<string>(),
            piano: new Set<string>(),
            ukulele: new Set<string>(),
        };
        this.emit();
    }

    normalizeChordName(chordName: string): string {
        const parsed = parseChord(chordName);
        return parsed?.normalizedName ?? chordName.trim().replace(/\s+/g, '');
    }

    private emit(): void {
        this.knownSubject.next(this.cloneKnown());
    }

    private cloneKnown(): Record<KnownChordInstrument, Set<string>> {
        return {
            guitar: new Set(this.knownByInstrument.guitar),
            piano: new Set(this.knownByInstrument.piano),
            ukulele: new Set(this.knownByInstrument.ukulele),
        };
    }
}
