import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, FormArray } from '@angular/forms';
import { SongService } from '../../services/song.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { AddSongRequest, AutocompleteResult, MusicalKey, SongBasicDto, YouTubeMetadata } from '../../models/song.model';
import { UserWithProfileDto } from '../../models/user.model';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of, Subject } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { extractChords, parseChord } from '../../utils/music-utils';

@Component({
    selector: 'app-add-song-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './add-song-modal.component.html',
    styleUrls: ['./add-song-modal.component.css']
})
export class AddSongModalComponent implements OnInit {
    private readonly noteToSemitone: Record<string, number> = {
        'C': 0, 'B#': 0,
        'C#': 1, 'Db': 1,
        'D': 2,
        'D#': 3, 'Eb': 3,
        'E': 4, 'Fb': 4,
        'F': 5, 'E#': 5,
        'F#': 6, 'Gb': 6,
        'G': 7,
        'G#': 8, 'Ab': 8,
        'A': 9,
        'A#': 10, 'Bb': 10,
        'B': 11, 'Cb': 11
    };

    private readonly allKeys: Array<{ id: number; semitone: number; isMinor: boolean }> = [
        { id: 1, semitone: 0, isMinor: false },
        { id: 2, semitone: 1, isMinor: false },
        { id: 3, semitone: 2, isMinor: false },
        { id: 4, semitone: 3, isMinor: false },
        { id: 5, semitone: 4, isMinor: false },
        { id: 6, semitone: 5, isMinor: false },
        { id: 7, semitone: 6, isMinor: false },
        { id: 8, semitone: 7, isMinor: false },
        { id: 9, semitone: 8, isMinor: false },
        { id: 10, semitone: 9, isMinor: false },
        { id: 11, semitone: 10, isMinor: false },
        { id: 12, semitone: 11, isMinor: false },
        { id: 13, semitone: 9, isMinor: true },
        { id: 14, semitone: 10, isMinor: true },
        { id: 15, semitone: 11, isMinor: true },
        { id: 16, semitone: 0, isMinor: true },
        { id: 17, semitone: 1, isMinor: true },
        { id: 18, semitone: 2, isMinor: true },
        { id: 19, semitone: 3, isMinor: true },
        { id: 20, semitone: 4, isMinor: true },
        { id: 21, semitone: 5, isMinor: true },
        { id: 22, semitone: 6, isMinor: true },
        { id: 23, semitone: 7, isMinor: true },
        { id: 24, semitone: 8, isMinor: true }
    ];

    private readonly majorIntervals = [0, 2, 4, 5, 7, 9, 11];
    private readonly majorQualities = [false, true, true, false, false, true, true];
    private readonly majorWeights = [4, 2, 2, 3, 3, 2, 1];
    private readonly minorIntervals = [0, 2, 3, 5, 7, 8, 10];
    private readonly minorQualities = [true, true, false, true, true, false, false];
    private readonly minorWeights = [4, 1, 2, 3, 3, 2, 2];

    @Output() close = new EventEmitter<void>();
    @Output() songAdded = new EventEmitter<void>();

    @Input() editMode: boolean = false;
    @Input() songToEdit: any = null;

    currentStep: number = 1;
    totalSteps = 3;

    isSubmitting: boolean = false;

    songForm: FormGroup;

    // Data sources
    musicalKeys: MusicalKey[] = [];
    artistSuggestions: AutocompleteResult[] = [];
    composerSuggestions: AutocompleteResult[] = []; 
    tagSuggestions: AutocompleteResult[] = [];
    genreSuggestions: AutocompleteResult[] = [];
    similarSongs: SongBasicDto[] = [];

    // Loading states
    isLoadingKeys = false;
    isCheckingDuplicate = false;
    isLoadingMetadata = false;
    isDetectingOriginalKey = false;
    isDetectingEasyKey = false;

    // אם המשתמש שינה ידנית — לא לדרוס
    userChangedOriginalKey = false;
    userChangedEasyKey = false;

    // Metadata
    youtubeMetadata: YouTubeMetadata | null = null;
    selectedComposer: { id?: number; name: string } | null = null; 

    // Uploader profile search state
    profileSearchQuery = '';
    profileSearchResults: UserWithProfileDto[] = [];
    profileSearchLoading = false;
    selectedUploaderProfile: UserWithProfileDto | null = null;
    showProfileDropdown = false;
    tagAsMyself = true;
    private profileSearch$ = new Subject<string>();

    get isAdminUser(): boolean {
        return Number(this.authService.currentUserValue?.role) >= 3;
    }

    get isProfessionalNonAdmin(): boolean {
        return (this.authService.currentUserValue?.hasProfessionalProfile ?? false) && !this.isAdminUser;
    }

    // Search subjects
    private artistSearch$ = new Subject<string>();
    private tagSearch$ = new Subject<string>();
    private genreSearch$ = new Subject<string>();
    private composerSearch$ = new Subject<string>();

    constructor(
        private fb: FormBuilder,
        private songService: SongService,
        private userService: UserService,
        private authService: AuthService,
        private sanitizer: DomSanitizer
    ) {
        this.songForm = this.fb.group({
            // Step 1: Basic Info
            title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
            artists: this.fb.array([], [Validators.required]),
            artistInput: [''],
            composerId: [null],
            composerInput: [''],
            youtubeUrl: ['', [Validators.required, Validators.pattern(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/)]],
            spotifyUrl: ['', [Validators.pattern(/^(https?:\/\/)?(open\.spotify\.com)\/.+$/)]],
            imageUrl: [''],

            // Step 1 (Moved from Step 2): Tags & Genres
            tags: this.fb.array([]),
            tagInput: [''],
            genres: this.fb.array([]),
            genreInput: [''],

            // Step 2: Content
            lyricsWithChords: ['', [Validators.required, Validators.minLength(10)]],
            originalKeyId: [null, [Validators.required]],
            easyKeyId: [null],

            // Step 3: Credits & Approval
            lyricistId: [null],
            arrangerId: [null],
            isApproved: [false]
        });
    }

    ngOnInit(): void {
        this.loadMusicalKeys();
        this.setupAutocomplete();
        this.setupKeyAutoDetect();
        this.initProfileSearch();

        // Only setup duplicate check for new songs
        if (!this.editMode) {
            this.setupDuplicateCheck();
            this.autoFillUploaderFromCurrentUser();
        }

        // If edit mode, populate form with existing data — and mark keys as user-set
        if (this.editMode && this.songToEdit) {
            this.userChangedOriginalKey = true;
            this.userChangedEasyKey = true;
            this.populateFormForEdit();
        }
    }
    populateFormForEdit(): void {
        if (!this.songToEdit) return;

        // Basic fields
        this.songForm.patchValue({
            title: this.songToEdit.title,
            youtubeUrl: this.songToEdit.youtubeUrl,
            spotifyUrl: this.songToEdit.spotifyUrl || '',
            imageUrl: this.songToEdit.imageUrl || '',
            lyricsWithChords: this.songToEdit.lyricsWithChords,
            originalKeyId: this.normalizeKeyValue(this.songToEdit.originalKeyId),
            easyKeyId: this.normalizeKeyValue(this.songToEdit.easyKeyId),
            lyricistId: this.songToEdit.lyricist?.id || null,
            arrangerId: this.songToEdit.arranger?.id || null
        });

        // Artists
        if (this.songToEdit.artists && this.songToEdit.artists.length > 0) {
            this.songToEdit.artists.forEach((artist: any) => {
                this.artistsArray.push(this.fb.control({ 
                    id: artist.id, 
                    name: artist.name 
                }));
            });
        }

        // Composer
        if (this.songToEdit.composer) {
            this.selectedComposer = { 
                id: this.songToEdit.composer.id, 
                name: this.songToEdit.composer.name 
            };
            this.songForm.patchValue({ composerId: this.songToEdit.composer.id });
        }

        // Genres
        if (this.songToEdit.genres && this.songToEdit.genres.length > 0) {
            this.songToEdit.genres.forEach((genre: any) => {
                this.genresArray.push(this.fb.control({ 
                    id: genre.id, 
                    name: genre.name 
                }));
            });
        }

        // Tags
        if (this.songToEdit.tags && this.songToEdit.tags.length > 0) {
            this.songToEdit.tags.forEach((tag: any) => {
                this.tagsArray.push(this.fb.control({
                    id: tag.id,
                    name: tag.name
                }));
            });
        }

        // Uploader profile
        if (this.songToEdit.uploaderProfile && this.songToEdit.uploaderUserId) {
            this.selectedUploaderProfile = {
                userId: this.songToEdit.uploaderUserId,
                displayName: this.songToEdit.uploaderProfile.name,
                imageUrl: this.songToEdit.uploaderProfile.imageUrl,
                profileType: this.songToEdit.uploaderProfile.type,
                profileId: 0,
                profileUrl: this.songToEdit.uploaderProfile.profileUrl
            };
            this.profileSearchQuery = this.songToEdit.uploaderProfile.name;
        }
    }
    get artistsArray() {
        return this.songForm.get('artists') as FormArray;
    }

    get tagsArray() {
        return this.songForm.get('tags') as FormArray;
    }

    get genresArray() {
        return this.songForm.get('genres') as FormArray;
    }

    get artistInputValue(): string {
        return this.songForm.get('artistInput')?.value || '';
    }

    get composerInputValue(): string {
        return this.songForm.get('composerInput')?.value || '';
    }

    loadMusicalKeys() {
        this.isLoadingKeys = true;
        this.songService.getMusicalKeys().subscribe({
            next: (keys) => {
                this.musicalKeys = keys.map(key => ({
                    ...key,
                    id: this.normalizeKeyId(key.id) ?? 0
                }));
                this.syncSelectedKeysWithOptions();
                this.isLoadingKeys = false;
            },
            error: (err) => {
                console.error('Failed to load keys', err);
                this.isLoadingKeys = false;
            }
        });
    }

    setupAutocomplete() {
        // Artist Autocomplete
        this.artistSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query || query.length < 2) return of([]);
                return this.songService.autocompleteArtists(query).pipe(catchError(() => of([])));
            })
        ).subscribe(results => this.artistSuggestions = results);

        this.composerSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query || query.length < 2) return of([]);
                return this.songService.autocompletePeople(query).pipe(catchError(() => of([])));
            })
        ).subscribe(results => this.composerSuggestions = results);

        // Tag Autocomplete
        this.tagSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query || query.length < 2) return of([]);
                return this.songService.autocompleteTags(query).pipe(catchError(() => of([])));
            })
        ).subscribe(results => this.tagSuggestions = results);

        // Genre Autocomplete
        this.genreSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query || query.length < 2) return of([]);
                return this.songService.autocompleteGenres(query).pipe(catchError(() => of([])));
            })
        ).subscribe(results => this.genreSuggestions = results);
    }

    autoFillUploaderFromCurrentUser(): void {
        if (!this.isProfessionalNonAdmin) return;

        this.userService.getMyUploaderProfile().subscribe(profile => {
            if (profile) {
                this.selectUploaderProfile(profile);
                this.tagAsMyself = true;
            }
        });
    }

    onTagAsMyselfChange(): void {
        if (this.tagAsMyself) {
            this.autoFillUploaderFromCurrentUser();
        } else {
            this.clearUploaderProfile();
        }
    }

    initProfileSearch(): void {
        this.profileSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(q => {
                this.profileSearchLoading = true;
                return this.userService.searchUsersWithProfiles(q, 20).pipe(catchError(() => of([])));
            })
        ).subscribe({
            next: (results) => {
                this.profileSearchResults = results;
                this.profileSearchLoading = false;
                this.showProfileDropdown = true;
            },
            error: () => { this.profileSearchLoading = false; }
        });
    }

    onProfileSearchInput(): void {
        this.profileSearch$.next(this.profileSearchQuery);
    }

    selectUploaderProfile(profile: UserWithProfileDto): void {
        this.selectedUploaderProfile = profile;
        this.profileSearchQuery = profile.displayName;
        this.showProfileDropdown = false;
        this.profileSearchResults = [];
    }

    clearUploaderProfile(): void {
        this.selectedUploaderProfile = null;
        this.profileSearchQuery = '';
        this.profileSearchResults = [];
        this.showProfileDropdown = false;
    }

    getProfileTypeLabel(type: string): string {
        return type === 'artist' ? 'אמן' : 'מורה / בעל מקצוע';
    }

    onComposerInput(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.composerSearch$.next(value);
    }

    selectComposer(composer: AutocompleteResult) {
        this.selectedComposer = { id: composer.id!, name: composer.value };
        this.songForm.patchValue({ 
            composerId: composer.id,
            composerInput: '' 
        });
        this.composerSuggestions = [];
    }

    removeComposer() {
        this.selectedComposer = null;
        this.songForm.patchValue({
            composerId: null,
            composerInput: ''
        });
    }

    addNewComposer(name: string) {
        if (!name || name.trim().length < 2) return;

        const trimmedName = name.trim();

        // Set as new composer (without ID = will be created on server)
        this.selectedComposer = { name: trimmedName };
        this.songForm.patchValue({
            composerId: null,  // null = new composer
            composerInput: ''
        });
        this.composerSuggestions = [];
    }

    setupKeyAutoDetect() {
        // מעקב אחרי שינוי ידני בסולמות
        this.songForm.get('originalKeyId')?.valueChanges.subscribe(() => {
            this.userChangedOriginalKey = true;
        });
        this.songForm.get('easyKeyId')?.valueChanges.subscribe(() => {
            this.userChangedEasyKey = true;
        });

        // זיהוי אוטומטי בעת הקלדה
        this.songForm.get('lyricsWithChords')?.valueChanges.pipe(
            debounceTime(800),
            distinctUntilChanged()
        ).subscribe(lyrics => {
            if (!lyrics || lyrics.length < 10) return;
            this.triggerDetection(lyrics, 'both');
        });
    }

    onLyricsPaste(event: ClipboardEvent): void {
        const pasted = event.clipboardData?.getData('text') ?? '';
        if (!pasted || pasted.length < 10) return;
        // מחכים ל-Angular לעדכן את ה-formControl, ואז קוראים את הערך המלא
        setTimeout(() => {
            const lyrics = this.songForm.get('lyricsWithChords')?.value ?? '';
            if (lyrics.length >= 10) this.triggerDetection(lyrics, 'both');
        }, 100);
    }

    runOriginalKeyDetection(): void {
        const lyrics = this.songForm.get('lyricsWithChords')?.value ?? '';
        if (!lyrics || lyrics.length < 10) return;
        this.userChangedOriginalKey = false;
        this.triggerDetection(lyrics, 'original');
    }

    runEasyKeyDetection(): void {
        const lyrics = this.songForm.get('lyricsWithChords')?.value ?? '';
        if (!lyrics || lyrics.length < 10) return;
        this.userChangedEasyKey = false;
        this.triggerDetection(lyrics, 'easy');
    }

    private triggerDetection(lyrics: string, target: 'original' | 'easy' | 'both'): void {
        if (target === 'original' || target === 'both') this.isDetectingOriginalKey = true;
        if (target === 'easy'     || target === 'both') this.isDetectingEasyKey     = true;

        this.songService.detectKey(lyrics).pipe(
            catchError(err => { console.error('[KeyDetect] API error:', err); return of(null); })
        ).subscribe(result => {
            if (target === 'original' || target === 'both') this.isDetectingOriginalKey = false;
            if (target === 'easy'     || target === 'both') this.isDetectingEasyKey     = false;

            const fallbackResult = this.detectKeyLocally(lyrics);
            const effectiveResult = result ?? fallbackResult;

            if (!effectiveResult) return;

            let detectedOriginalKeyId = this.readDetectedKeyId(effectiveResult, 'original');
            let detectedEasyKeyId = this.readDetectedKeyId(effectiveResult, 'easy');

            if (detectedOriginalKeyId === null && detectedEasyKeyId === null && fallbackResult) {
                detectedOriginalKeyId = fallbackResult.originalKeyId;
                detectedEasyKeyId = fallbackResult.easyKeyId;
            }

            if ((target === 'original' || target === 'both') && !this.userChangedOriginalKey && detectedOriginalKeyId !== null) {
                this.songForm.get('originalKeyId')?.setValue(String(detectedOriginalKeyId), { emitEvent: false });
            }

            if ((target === 'easy' || target === 'both') && !this.userChangedEasyKey && detectedEasyKeyId !== null) {
                this.songForm.get('easyKeyId')?.setValue(String(detectedEasyKeyId), { emitEvent: false });
            }
        });
    }

    private readDetectedKeyId(result: unknown, target: 'original' | 'easy'): number | null {
        if (!result || typeof result !== 'object') {
            return null;
        }

        const record = result as Record<string, unknown>;

        return this.normalizeKeyId(
            target === 'original'
                ? (record['originalKeyId'] ?? record['OriginalKeyId'])
                : (record['easyKeyId'] ?? record['EasyKeyId'])
        );
    }

    private detectKeyLocally(lyrics: string): { originalKeyId: number | null; easyKeyId: number | null } | null {
        const chordCounts = new Map<string, number>();

        for (const chordText of this.extractChordCandidates(lyrics)) {
            const parsed = parseChord(chordText);
            if (!parsed) continue;

            const semitone = this.noteToSemitone[parsed.root];
            if (semitone === undefined) continue;

            const isMinor = parsed.quality === 'minor'
                || parsed.quality === 'minor7'
                || parsed.quality === 'dim'
                || parsed.quality === 'dim7'
                || parsed.quality === 'halfDim';

            const mapKey = `${semitone}|${isMinor}`;
            chordCounts.set(mapKey, (chordCounts.get(mapKey) ?? 0) + 1);
        }

        if (chordCounts.size === 0) {
            return null;
        }

        let bestKey: { id: number; semitone: number; isMinor: boolean } | null = null;
        let bestScore = -1;

        for (const candidate of this.allKeys) {
            const score = this.scoreLocalKey(candidate.semitone, candidate.isMinor, chordCounts);
            if (score > bestScore) {
                bestScore = score;
                bestKey = candidate;
            }
        }

        if (!bestKey) {
            return null;
        }

        return {
            originalKeyId: bestKey.id,
            easyKeyId: bestKey.isMinor ? 13 : 1
        };
    }

    private extractChordCandidates(lyrics: string): string[] {
        const chords: string[] = [];
        const bracketRegex = /\[([^[\]\r\n]+)\]/g;

        for (const match of lyrics.matchAll(bracketRegex)) {
            const chord = match[1]?.trim();
            if (chord) {
                chords.push(chord);
            }
        }

        if (chords.length > 0) {
            return chords;
        }

        for (const line of lyrics.split(/\r?\n/)) {
            chords.push(...extractChords(line));
        }

        return chords;
    }

    private scoreLocalKey(
        rootSemitone: number,
        isMinor: boolean,
        chordCounts: Map<string, number>
    ): number {
        const intervals = isMinor ? this.minorIntervals : this.majorIntervals;
        const qualities = isMinor ? this.minorQualities : this.majorQualities;
        const weights = isMinor ? this.minorWeights : this.majorWeights;

        let score = 0;

        for (let degree = 0; degree < 7; degree++) {
            const chordRoot = (rootSemitone + intervals[degree]) % 12;
            const expectedMinor = qualities[degree];

            score += (chordCounts.get(`${chordRoot}|${expectedMinor}`) ?? 0) * weights[degree];
            score += (chordCounts.get(`${chordRoot}|${!expectedMinor}`) ?? 0) * weights[degree] * 0.3;
        }

        if (isMinor) {
            const dominantRoot = (rootSemitone + 7) % 12;
            score += (chordCounts.get(`${dominantRoot}|false`) ?? 0) * 2.5;
        }

        return score;
    }

    private normalizeKeyId(value: unknown): number | null {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : null;
    }

    private normalizeKeyValue(value: unknown): string | null {
        const keyId = this.normalizeKeyId(value);
        return keyId === null ? null : String(keyId);
    }

    private syncSelectedKeysWithOptions(): void {
        const originalKeyId = this.normalizeKeyId(this.songForm.get('originalKeyId')?.value);
        const easyKeyId = this.normalizeKeyId(this.songForm.get('easyKeyId')?.value);

        if (originalKeyId !== null) {
            this.songForm.get('originalKeyId')?.setValue(String(originalKeyId), { emitEvent: false });
        }

        if (easyKeyId !== null) {
            this.songForm.get('easyKeyId')?.setValue(String(easyKeyId), { emitEvent: false });
        }
    }

    setupDuplicateCheck() {
        this.songForm.get('title')?.valueChanges.pipe(
            debounceTime(500),
            distinctUntilChanged(),
            switchMap(title => {
                if (!title || title.length < 3) return of(null);
                this.isCheckingDuplicate = true;
                return this.songService.checkDuplicate(title).pipe(
                    catchError(() => of(null))
                );
            })
        ).subscribe(response => {
            this.isCheckingDuplicate = false;
            if (response && response.isPotentialDuplicate) {
                this.similarSongs = response.similarSongs;
            } else {
                this.similarSongs = [];
            }
        });
    }

    onArtistInput(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.artistSearch$.next(value);
    }

    onTagInput(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.tagSearch$.next(value);
    }

    onGenreInput(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.genreSearch$.next(value);
    }

    selectArtist(artist: AutocompleteResult) {
        const exists = this.artistsArray.controls.some(ctrl => ctrl.value.id === artist.id);
        if (!exists) {
            this.artistsArray.push(this.fb.control({ id: artist.id, name: artist.value }));
        }
        this.songForm.get('artistInput')?.setValue('');
        this.artistSuggestions = [];
    }

    removeArtist(index: number) {
        this.artistsArray.removeAt(index);
    }

    addNewArtist(name: string) {
        if (!name || name.trim().length < 2) return;

        const trimmedName = name.trim();

        // בדיקה שלא קיים כבר (לפי שם)
        const exists = this.artistsArray.controls.some(
            ctrl => ctrl.value.name.toLowerCase() === trimmedName.toLowerCase()
        );

        if (!exists && this.artistsArray.length < 5) {
            // הוספת אמן חדש (ללא ID)
            this.artistsArray.push(this.fb.control({
                id: undefined,  // ללא ID = אמן חדש
                name: trimmedName
            }));

            this.songForm.get('artistInput')?.setValue('');
            this.artistSuggestions = [];
        }
    }

    addNewTag(name: string) {
        if (!name || name.trim().length < 2) return;

        const trimmedName = name.trim();

        // בדיקת כפילות מקומית
        const exists = this.tagsArray.controls.some(
            ctrl => ctrl.value.name.toLowerCase() === trimmedName.toLowerCase()
        );

        if (!exists) {
            this.tagsArray.push(this.fb.control({
                id: undefined,  // ללא ID = tag חדש
                name: trimmedName
            }));

            this.songForm.get('tagInput')?.setValue('');
            this.tagSuggestions = [];
        }
    }

    addNewGenre(name: string) {
        if (!name || name.trim().length < 2) return;

        const trimmedName = name.trim();

        // בדיקת כפילות מקומית
        const exists = this.genresArray.controls.some(
            ctrl => ctrl.value.name.toLowerCase() === trimmedName.toLowerCase()
        );

        if (!exists) {
            this.genresArray.push(this.fb.control({
                id: undefined,  // ללא ID = genre חדש
                name: trimmedName
            }));

            this.songForm.get('genreInput')?.setValue('');
            this.genreSuggestions = [];
        }
    }

    selectTag(tag: AutocompleteResult) {
        const exists = this.tagsArray.controls.some(ctrl => ctrl.value.id === tag.id);
        if (!exists) {
            this.tagsArray.push(this.fb.control({ id: tag.id, name: tag.value }));
        }
        this.songForm.get('tagInput')?.setValue('');
        this.tagSuggestions = [];
    }

    removeTag(index: number) {
        this.tagsArray.removeAt(index);
    }

    selectGenre(genre: AutocompleteResult) {
        const exists = this.genresArray.controls.some(ctrl => ctrl.value.id === genre.id);
        if (!exists) {
            this.genresArray.push(this.fb.control({ id: genre.id, name: genre.value }));
        }
        this.songForm.get('genreInput')?.setValue('');
        this.genreSuggestions = [];
    }

    removeGenre(index: number) {
        this.genresArray.removeAt(index);
    }

    onYoutubeUrlBlur() {
        const url = this.songForm.get('youtubeUrl')?.value;
        if (url && !this.songForm.get('youtubeUrl')?.errors) {
            this.isLoadingMetadata = true;
            this.songService.getYouTubeMetadata(url).subscribe({
                next: (metadata) => {
                    this.isLoadingMetadata = false;
                    this.youtubeMetadata = metadata;
                    if (metadata.success) {
                        if (metadata.thumbnailUrl && !this.songForm.get('imageUrl')?.value) {
                            this.songForm.patchValue({ imageUrl: metadata.thumbnailUrl });
                        }
                    }
                },
                error: () => this.isLoadingMetadata = false
            });
        }
    }

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            // Validate current step
            if (this.currentStep === 1) {
                const titleValid = this.songForm.get('title')?.valid;
                const artistsValid = this.artistsArray.length > 0;
                const youtubeValid = this.songForm.get('youtubeUrl')?.valid;

                if (!titleValid || !artistsValid || !youtubeValid) {
                    this.songForm.markAllAsTouched();
                    return;
                }
            } else if (this.currentStep === 2) {
                const lyricsValid = this.songForm.get('lyricsWithChords')?.valid;
                const keyValid = this.songForm.get('originalKeyId')?.valid;

                if (!lyricsValid || !keyValid) {
                    this.songForm.markAllAsTouched();
                    return;
                }
            }

            this.currentStep++;
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }

    submit() {
        if (this.songForm.valid && !this.isSubmitting) {
            this.isSubmitting = true;
            const formValue = this.songForm.value;

            const request: AddSongRequest = {
                title: formValue.title,
                artists: formValue.artists.map((a: any) => ({
                    id: a.id || undefined,  // undefined = אמן חדש
                    name: a.name
                })),
                youtubeUrl: formValue.youtubeUrl,
                spotifyUrl: formValue.spotifyUrl?.trim() || undefined,
                imageUrl: formValue.imageUrl,
                tags: formValue.tags.map((t: any) => ({
                    id: t.id || undefined,
                    name: t.name
                })),
                genres: formValue.genres.map((g: any) => ({
                    id: g.id || undefined,
                    name: g.name
                })),
                lyricsWithChords: formValue.lyricsWithChords,
                originalKeyId: Number(formValue.originalKeyId),
                easyKeyId: this.normalizeKeyId(formValue.easyKeyId) ?? undefined,
                composer: this.selectedComposer ? {
                    id: this.selectedComposer.id || undefined,
                    name: this.selectedComposer.name
                } : undefined,
                lyricist: undefined,  // נשאיר כרגע - נעדכן אחר כך
                arranger: undefined,  // נשאיר כרגע - נעדכן אחר כך
                isApproved: formValue.isApproved ?? false,
                uploaderUserId: this.selectedUploaderProfile?.userId,
                uploaderProfileType: this.selectedUploaderProfile?.profileType
            };

            // Choose add or update based on mode
            const operation = this.editMode && this.songToEdit
                ? this.songService.updateSong(this.songToEdit.id, request)
                : this.songService.addSong(request);

            operation.subscribe({
                next: (res) => {
                    this.isSubmitting = false;
                    if (res.success) {
                        const message = this.editMode ? 'השיר עודכן בהצלחה!' : 'השיר נוסף בהצלחה!';
                        alert(message);
                        this.songAdded.emit();
                        this.close.emit();
                    } else {
                        alert('שגיאה: ' + res.message);
                    }
                },
                error: (err) => {
                    this.isSubmitting = false;
                    console.error('Full error:', err);
                    console.error('Error details:', err.error);
                    const message = this.editMode ? 'אירעה שגיאה בעדכון השיר' : 'אירעה שגיאה בשמירת השיר';
                    alert(message);
                }
            });
        } else {
            this.songForm.markAllAsTouched();
        }
    }
    get formattedLyrics(): SafeHtml {
        const rawLyrics = this.songForm.get('lyricsWithChords')?.value || '';
        if (!rawLyrics) return '';

        // Escape HTML to prevent XSS (basic)
        let safeLyrics = rawLyrics
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Replace newlines with <br>
        safeLyrics = safeLyrics.replace(/\n/g, '<br>');

        // Replace chords [Am] with <span class="chord">Am</span>
        // We use a regex to find content inside brackets
        const html = safeLyrics.replace(/\[(.*?)\]/g, '<span class="chord">$1</span>');

        return this.sanitizer.bypassSecurityTrustHtml(html);
    }

    closeModal() {
        this.close.emit();
    }
}
