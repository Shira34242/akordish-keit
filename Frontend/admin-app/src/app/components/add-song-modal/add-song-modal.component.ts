import { AfterViewInit, Component, ElementRef, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, FormArray } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SongService } from '../../services/song.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { AddSongRequest, AutocompleteResult, ImportedSongDraft, MusicalKey, SongBasicDto, YouTubeMetadata, YouTubeSearchResult } from '../../models/song.model';
import { UserWithProfileDto } from '../../models/user.model';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map, takeUntil } from 'rxjs/operators';
import { forkJoin, of, Subject } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { extractChords, parseChord } from '../../utils/music-utils';
import { RequiredFieldFeedbackService } from '../../services/required-field-feedback.service';
import { FileUploadInputComponent } from '../shared/file-upload-input/file-upload-input.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

export interface InitialSongRequest {
    songName: string;
    artistName: string;
}

@Component({
    selector: 'app-add-song-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, FileUploadInputComponent, TranslatePipe],
    templateUrl: './add-song-modal.component.html',
    styleUrls: ['./add-song-modal.component.css']
})
export class AddSongModalComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('modalContent') modalContent?: ElementRef<HTMLDivElement>;
    @ViewChild('titleInput') titleInput?: ElementRef<HTMLInputElement>;
    @ViewChild('manualYoutubeInput') manualYoutubeInput?: ElementRef<HTMLInputElement>;
    @ViewChild('lyricsInput') lyricsInput?: ElementRef<HTMLTextAreaElement>;

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
    @Input() songPrefill: ImportedSongDraft | null = null;
    @Input() embedded: boolean = false;
    @Input() initialSongRequest: InitialSongRequest | null = null;

    currentStep: number = 1;
    isManualAddMode: boolean = false;
    showManualYoutubeInput: boolean = false;
    isPreviewEditing: boolean = false;

    isSubmitting: boolean = false;
    showInlineSuccess = false;
    successMessage = '';
    submissionError = '';

    songForm: FormGroup;

    // Data sources
    musicalKeys: MusicalKey[] = [];
    artistSuggestions: AutocompleteResult[] = [];
    composerSuggestions: AutocompleteResult[] = []; 
    tagSuggestions: AutocompleteResult[] = [];
    genreSuggestions: AutocompleteResult[] = [];
    similarSongs: SongBasicDto[] = [];
    youtubeSearchResults: YouTubeSearchResult[] = [];
    artistMatchSuggestions: AutocompleteResult[] = [];

    // Loading states
    isLoadingKeys = false;
    isCheckingDuplicate = false;
    isLoadingMetadata = false;
    isDetectingOriginalKey = false;
    isDetectingEasyKey = false;
    isSearchingYouTube = false;
    hasSearchedYouTube = false;
    lastSearchQuery = '';
    dismissedDuplicatePrompt = false;

    // אם המשתמש שינה ידנית — לא לדרוס
    userChangedOriginalKey = false;
    userChangedEasyKey = false;
    autoDetectedOriginalKeyName: string | null = null;
    autoDetectedEasyKeyName: string | null = null;

    // Metadata
    youtubeMetadata: YouTubeMetadata | null = null;
    selectedComposer: { id?: number; name: string } | null = null;
    selectedYouTubeResult: YouTubeSearchResult | null = null;
    pendingSuggestedArtistName: string | null = null;

    // Uploader profile search state
    profileSearchQuery = '';
    profileSearchResults: UserWithProfileDto[] = [];
    profileSearchLoading = false;
    selectedUploaderProfile: UserWithProfileDto | null = null;
    myUploaderProfiles: UserWithProfileDto[] = [];
    profileTypeFilter: 'all' | 'artist' | 'teacher' | 'serviceProvider' | 'user' = 'all';
    profileSort: 'name' | 'type' = 'name';
    showProfileDropdown = false;
    tagAsMyself = true;
    private profileSearch$ = new Subject<string>();
    private destroy$ = new Subject<void>();

    get isAdminUser(): boolean {
        return this.authService.isAdminOrManager();
    }

    get isLegacyFlow(): boolean {
        return this.editMode || this.isManualAddMode;
    }

    get isSmartFlow(): boolean {
        return !this.isLegacyFlow;
    }

    get totalSteps(): number {
        return 3;
    }

    get hasSelectedVideo(): boolean {
        return !!this.songForm.get('youtubeUrl')?.value && (!!this.selectedYouTubeResult || this.showManualYoutubeInput);
    }

    get smartStepLabel(): string {
        return `${this.currentStep} / ${this.totalSteps}`;
    }

    get smartHeaderTitle(): string {
        switch (this.currentStep) {
            case 1:
                return this.langService.translate('song_modal.smart_step1_title');
            case 2:
                return this.langService.translate('song_modal.smart_step2_title');
            case 3:
                return this.langService.translate('song_modal.smart_step3_title');
            default:
                return this.langService.translate('song_modal.add_short');
        }
    }

    get smartHeaderDescription(): string {
        switch (this.currentStep) {
            case 1:
                return this.langService.translate('song_modal.smart_step1_desc');
            case 2:
                return this.langService.translate('song_modal.smart_step2_desc');
            case 3:
                return this.langService.translate('song_modal.smart_step3_desc');
            default:
                return '';
        }
    }

    get stepOneHelperText(): string {
        if (this.hasSelectedVideo) {
            return this.langService.translate('song_modal.helper_wrong_song');
        }

        if (this.isSearchingYouTube) {
            return this.langService.translate('song_modal.helper_searching_yt');
        }

        if (this.showManualYoutubeInput) {
            return this.isLoadingMetadata ? this.langService.translate('song_modal.helper_loading_meta') : '';
        }

        if (this.hasSearchedYouTube && this.youtubeSearchResults.length === 0) {
            return this.langService.translate('song_modal.helper_no_results');
        }

        return '';
    }

    get lyricsHelperText(): string {
        if (this.isDetectingOriginalKey || this.isDetectingEasyKey) {
            return this.langService.translate('song_modal.helper_detecting_key');
        }

        return '';
    }

    get smartPreviewMessage(): string {
        const title = this.songForm.get('title')?.value;
        return title
            ? `${this.langService.translate('song_modal.preview_ready_pre')} "${title}" ${this.langService.translate('song_modal.preview_ready_suf')}`
            : this.langService.translate('song_modal.preview_ready');
    }

    get selectedArtistsLabel(): string {
        return this.artistsArray.controls
            .map(control => control.value?.name)
            .filter((name: string | undefined): name is string => !!name)
            .join(', ');
    }

    get showDuplicateSuggestion(): boolean {
        return this.hasSearchedYouTube && this.similarSongs.length > 0 && !this.dismissedDuplicatePrompt && !this.hasSelectedVideo;
    }

    get primarySimilarSong(): SongBasicDto | null {
        return this.similarSongs[0] ?? null;
    }

    get smartPrimaryActionLabel(): string {
        if (this.currentStep === 2) {
            return this.langService.translate('song_modal.action_preview');
        }

        if (this.currentStep === 3) {
            return this.isSubmitting ? this.langService.translate('song_modal.saving') : this.langService.translate('song_modal.submit_approval');
        }

        return this.langService.translate('song_modal.next');
    }

    get isProfessionalNonAdmin(): boolean {
        return (this.authService.currentUserValue?.hasProfessionalProfile ?? false) && !this.isAdminUser;
    }

    get filteredProfileSearchResults(): UserWithProfileDto[] {
        const filtered = this.profileSearchResults.filter(profile => {
            if (this.profileTypeFilter === 'all') return true;
            if (this.profileTypeFilter === 'user') return profile.profileType === 'user';
            if (this.profileTypeFilter === 'teacher') return profile.profileType === 'serviceProvider' && profile.isTeacher;
            if (this.profileTypeFilter === 'serviceProvider') return profile.profileType === 'serviceProvider' && !profile.isTeacher;
            return profile.profileType === this.profileTypeFilter;
        });

        return [...filtered].sort((a, b) => {
            if (this.profileSort === 'type') {
                const typeCompare = this.getProfileTypeLabel(a.profileType, a.isTeacher)
                    .localeCompare(this.getProfileTypeLabel(b.profileType, b.isTeacher), 'he');
                if (typeCompare !== 0) return typeCompare;
            }

            return a.displayName.localeCompare(b.displayName, 'he');
        });
    }

    // Search subjects
    private artistSearch$ = new Subject<string>();
    private tagSearch$ = new Subject<string>();
    private genreSearch$ = new Subject<string>();
    private composerSearch$ = new Subject<string>();

    private readonly langService = inject(LanguageService);

    constructor(
        private fb: FormBuilder,
        private songService: SongService,
        private userService: UserService,
        private authService: AuthService,
        private sanitizer: DomSanitizer,
        private host: ElementRef<HTMLElement>,
        private requiredFieldFeedback: RequiredFieldFeedbackService
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
            sheetMusicUrl: [''],

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
        this.setupYouTubeSearch();

        // Only setup duplicate check for new songs
        if (!this.editMode) {
            this.setupDuplicateCheck();
            this.initializeUploaderSelector();
        }

        // If edit mode, populate form with existing data — and mark keys as user-set
        if (this.editMode && this.songToEdit) {
            this.userChangedOriginalKey = true;
            this.userChangedEasyKey = true;
            this.populateFormForEdit();
        } else if (this.songPrefill) {
            this.applySongPrefill();
        } else if (this.initialSongRequest) {
            this.applyInitialSongRequest();
        }
    }

    ngAfterViewInit(): void {
        this.scrollModalToTop();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.artistSearch$.complete();
        this.composerSearch$.complete();
        this.tagSearch$.complete();
        this.genreSearch$.complete();
        this.profileSearch$.complete();
    }

    private applyInitialSongRequest(): void {
        const songName = this.initialSongRequest?.songName?.trim();
        const artistName = this.initialSongRequest?.artistName?.trim();

        if (songName) {
            this.songForm.patchValue({ title: songName });
        }

        if (artistName) {
            this.addNewArtist(artistName);
        }
    }

    private applySongPrefill(): void {
        if (!this.songPrefill) return;

        this.isManualAddMode = true;
        this.showManualYoutubeInput = !!this.songPrefill.youtubeUrl;
        this.currentStep = this.songPrefill.youtubeUrl && this.songPrefill.lyricsWithChords ? 2 : 1;

        this.songForm.patchValue({
            title: this.songPrefill.title || '',
            youtubeUrl: this.songPrefill.youtubeUrl || '',
            imageUrl: this.songPrefill.imageUrl || '',
            lyricsWithChords: this.songPrefill.lyricsWithChords || '',
            originalKeyId: this.normalizeKeyValue(this.songPrefill.originalKeyId),
            easyKeyId: this.normalizeKeyValue(this.songPrefill.easyKeyId)
        });

        this.artistsArray.clear();
        this.songPrefill.artists?.forEach(artist => {
            if (artist.name) {
                this.artistsArray.push(this.fb.control({
                    id: artist.id,
                    name: artist.name
                }));
            }
        });

        this.tagsArray.clear();
        this.songPrefill.tags?.forEach(tag => {
            if (tag.name) {
                this.tagsArray.push(this.fb.control({
                    id: tag.id,
                    name: tag.name
                }));
            }
        });
    }

    populateFormForEdit(): void {
        if (!this.songToEdit) return;

        // Basic fields
        this.songForm.patchValue({
            title: this.songToEdit.title,
            youtubeUrl: this.songToEdit.youtubeUrl,
            spotifyUrl: this.songToEdit.spotifyUrl || '',
            imageUrl: this.songToEdit.imageUrl || '',
            sheetMusicUrl: this.songToEdit.sheetMusicUrl || '',
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
        if (this.songToEdit.uploaderProfile) {
            this.selectedUploaderProfile = {
                userId: this.songToEdit.uploaderUserId,
                displayName: this.songToEdit.uploaderProfile.name,
                imageUrl: this.songToEdit.uploaderProfile.imageUrl,
                profileType: this.songToEdit.uploaderProfile.type,
                profileId: this.songToEdit.uploaderProfileId ?? this.songToEdit.uploaderProfile.profileId,
                profileUrl: this.songToEdit.uploaderProfile.profileUrl,
                isTeacher: false,
                status: 'None',
                categories: []
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
        if (this.musicalKeys.length > 0) return;
        this.isLoadingKeys = true;
        this.songService.getMusicalKeys().pipe(takeUntil(this.destroy$)).subscribe({
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
            }),
            takeUntil(this.destroy$)
        ).subscribe(results => this.artistSuggestions = results);

        this.composerSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query || query.length < 2) return of([]);
                return this.songService.autocompletePeople(query).pipe(catchError(() => of([])));
            }),
            takeUntil(this.destroy$)
        ).subscribe(results => this.composerSuggestions = results);

        // Tag Autocomplete
        this.tagSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query || query.length < 2) return of([]);
                return this.songService.autocompleteTags(query).pipe(catchError(() => of([])));
            }),
            takeUntil(this.destroy$)
        ).subscribe(results => this.tagSuggestions = results);

        // Genre Autocomplete
        this.genreSearch$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query || query.length < 2) return of([]);
                return this.songService.autocompleteGenres(query).pipe(catchError(() => of([])));
            }),
            takeUntil(this.destroy$)
        ).subscribe(results => this.genreSuggestions = results);
    }

    setupYouTubeSearch() {
        this.songForm.get('title')?.valueChanges.pipe(
            debounceTime(200),
            distinctUntilChanged(),
            switchMap(title => {
                const query = (title || '').trim();

                if (this.editMode) {
                    return of(title);
                }

                if (this.lastSearchQuery && query !== this.lastSearchQuery) {
                    this.youtubeSearchResults = [];
                    this.hasSearchedYouTube = false;
                    if (!this.showManualYoutubeInput) {
                        this.selectedYouTubeResult = null;
                    }
                }

                return of(title);
            }),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.isSearchingYouTube = false;
        });
    }

    searchYouTubeByTitle(): void {
        const query = (this.songForm.get('title')?.value || '').trim();

        this.songForm.get('title')?.markAsTouched();

        if (this.editMode || query.length < 2 || this.isSearchingYouTube) {
            return;
        }

        if (this.similarSongs.length > 0 && !this.dismissedDuplicatePrompt) {
            this.hasSearchedYouTube = true;
            this.youtubeSearchResults = [];
            this.showManualYoutubeInput = false;
            this.selectedYouTubeResult = null;
            this.scrollModalToTop();
            return;
        }

        this.isSearchingYouTube = true;
        this.hasSearchedYouTube = true;
        this.lastSearchQuery = query;
        this.youtubeSearchResults = [];
        this.showManualYoutubeInput = false;
        this.selectedYouTubeResult = null;

        this.songService.searchYouTubeSongs(query, 3).pipe(
            map(results => this.refineYouTubeResults(query, results)),
            catchError(() => of([]))
        ).subscribe(results => {
            this.youtubeSearchResults = results;
            this.isSearchingYouTube = false;
            this.scrollModalToTop();
        });
    }

    initializeUploaderSelector(): void {
        if (this.isAdminUser) {
            this.tagAsMyself = false;
            this.clearUploaderProfile();
            this.onProfileFilterChange();
            return;
        }

        this.autoFillUploaderFromCurrentUser();
    }

    autoFillUploaderFromCurrentUser(): void {
        if (!this.isProfessionalNonAdmin) return;

        this.userService.getMyAllPages().subscribe(profiles => {
            this.myUploaderProfiles = profiles;

            if (!this.tagAsMyself) {
                return;
            }

            if (profiles.length === 1) {
                this.selectUploaderProfile(profiles[0]);
                return;
            }

            if (profiles.length > 1) {
                this.tagAsMyself = true;
                this.clearUploaderProfile();
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
                return this.userService.searchUsersWithProfiles(q, 100, this.profileTypeFilter).pipe(catchError(() => of([])));
            }),
            takeUntil(this.destroy$)
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

    onProfileFilterChange(): void {
        this.clearUploaderProfile();
        this.profileSearchLoading = true;
        this.userService.searchUsersWithProfiles('', 100, this.profileTypeFilter)
            .pipe(catchError(() => of([])))
            .subscribe(results => {
                this.profileSearchResults = results;
                this.profileSearchLoading = false;
                this.showProfileDropdown = true;
            });
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

    getProfileTypeLabel(type: string, isTeacher: boolean = false): string {
        if (type === 'artist') return this.langService.translate('song_modal.profile_artist');
        if (type === 'user') return this.langService.translate('song_modal.profile_user');
        if (type === 'serviceProvider') return isTeacher ? this.langService.translate('song_modal.profile_teacher') : this.langService.translate('song_modal.profile_service');
        return type === 'artist' ? this.langService.translate('song_modal.profile_artist') : this.langService.translate('song_modal.profile_pro');
    }

    getProfileConnectionLabel(profile: UserWithProfileDto | null): string {
        return profile && profile.profileType !== 'user' && !profile.userId
            ? this.langService.translate('song_modal.not_linked')
            : '';
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
        this.songForm.get('originalKeyId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.userChangedOriginalKey = true;
            this.autoDetectedOriginalKeyName = null;
        });
        this.songForm.get('easyKeyId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.userChangedEasyKey = true;
            this.autoDetectedEasyKeyName = null;
        });

        // זיהוי אוטומטי בעת הקלדה
        this.songForm.get('lyricsWithChords')?.valueChanges.pipe(
            debounceTime(800),
            distinctUntilChanged(),
            takeUntil(this.destroy$)
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
                this.autoDetectedOriginalKeyName = this.getKeyNameById(detectedOriginalKeyId);
            }

            if ((target === 'easy' || target === 'both') && !this.userChangedEasyKey && detectedEasyKeyId !== null) {
                this.songForm.get('easyKeyId')?.setValue(String(detectedEasyKeyId), { emitEvent: false });
                this.autoDetectedEasyKeyName = this.getKeyNameById(detectedEasyKeyId);
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

    private getKeyNameById(keyId: number): string | null {
        const key = this.musicalKeys.find(item => this.normalizeKeyId(item.id) === keyId);
        return key?.name ?? null;
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
            }),
            takeUntil(this.destroy$)
        ).subscribe(response => {
            this.isCheckingDuplicate = false;
            if (response && response.isPotentialDuplicate) {
                this.similarSongs = response.similarSongs;
                this.dismissedDuplicatePrompt = false;
            } else {
                this.similarSongs = [];
                this.dismissedDuplicatePrompt = false;
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
        this.ensureArtistSelected(artist);
        this.clearPendingArtistSuggestion();
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

            this.clearPendingArtistSuggestion();
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
                        this.applySelectedVideo({
                            title: metadata.title || this.songForm.get('title')?.value || '',
                            youtubeUrl: url,
                            thumbnailUrl: metadata.thumbnailUrl,
                            channelTitle: metadata.channelTitle,
                            durationSeconds: metadata.durationSeconds,
                            description: metadata.description,
                            publishedAt: metadata.publishedAt,
                            suggestedArtistName: metadata.channelTitle
                        });
                    }
                },
                error: () => this.isLoadingMetadata = false
            });
        }
    }

    fetchManualYoutubeMetadata(): void {
        this.songForm.get('youtubeUrl')?.markAsTouched();
        if (this.songForm.get('youtubeUrl')?.invalid || this.isLoadingMetadata) {
            return;
        }

        this.onYoutubeUrlBlur();
    }

    selectYouTubeSuggestion(result: YouTubeSearchResult) {
        this.applySelectedVideo(result);
    }

    clearSelectedVideoChoice(): void {
        this.selectedYouTubeResult = null;
        this.youtubeMetadata = null;
        this.youtubeSearchResults = [];
        this.showManualYoutubeInput = false;
        this.hasSearchedYouTube = false;
        this.lastSearchQuery = '';
        this.songForm.patchValue({
            youtubeUrl: '',
            imageUrl: ''
        });
        this.scrollModalToTop();
    }

    continueAfterDuplicatePrompt(): void {
        this.dismissedDuplicatePrompt = true;
        this.searchYouTubeByTitle();
    }

    private applySelectedVideo(result: Partial<YouTubeSearchResult>) {
        const smartTitle = this.pickSmartSongTitle(this.songForm.get('title')?.value || '', result.title, result.channelTitle);

        this.selectedYouTubeResult = {
            videoId: result.videoId ?? '',
            youtubeUrl: result.youtubeUrl ?? '',
            title: smartTitle,
            channelTitle: result.channelTitle,
            thumbnailUrl: result.thumbnailUrl,
            durationSeconds: result.durationSeconds,
            description: result.description,
            publishedAt: result.publishedAt,
            suggestedArtistName: result.suggestedArtistName
        };
        this.youtubeSearchResults = [];

        this.songForm.patchValue({
            title: smartTitle,
            youtubeUrl: result.youtubeUrl ?? this.songForm.get('youtubeUrl')?.value ?? '',
            imageUrl: result.thumbnailUrl || this.songForm.get('imageUrl')?.value || ''
        });

        this.youtubeMetadata = {
            success: true,
            title: smartTitle,
            channelTitle: result.channelTitle,
            thumbnailUrl: result.thumbnailUrl,
            durationSeconds: result.durationSeconds,
            description: result.description,
            publishedAt: result.publishedAt
        };

        this.artistsArray.clear();
        this.applySuggestedArtists(result.suggestedArtistName || result.channelTitle || result.title?.split('-')[0] || '');

        this.showManualYoutubeInput = false;
        this.hasSearchedYouTube = false;
        this.lastSearchQuery = '';

        if (!this.isLegacyFlow && this.currentStep === 1) {
            this.currentStep = 2;
            this.scrollModalToTop();
        }
    }

    private applySuggestedArtists(artistName: string) {
        const trimmedName = artistName.trim();
        if (trimmedName.length < 2) {
            return;
        }

        const primaryCandidate = this.extractSuggestedArtistCandidates(trimmedName)[0] || trimmedName;
        this.pendingSuggestedArtistName = primaryCandidate;
        this.artistMatchSuggestions = [];
        this.resolveArtistMatches(primaryCandidate).subscribe(matches => {
            const bestMatch = matches[0];

            if (bestMatch && bestMatch.score >= 70) {
                this.artistsArray.clear();
                this.artistsArray.push(this.fb.control({ id: bestMatch.result.id, name: bestMatch.result.value }));
                this.artistMatchSuggestions = matches
                    .filter(match => match.result.id && match.result.id !== bestMatch.result.id && match.score >= 35)
                    .slice(0, 5)
                    .map(match => match.result);
                return;
            }

            this.artistsArray.clear();
            this.addNewArtist(primaryCandidate);
        });
    }

    selectSuggestedArtistMatch(artist: AutocompleteResult) {
        this.selectArtist(artist);
    }

    createSuggestedArtist() {
        if (!this.pendingSuggestedArtistName) {
            return;
        }

        this.addNewArtist(this.pendingSuggestedArtistName);
    }

    private clearPendingArtistSuggestion() {
        this.pendingSuggestedArtistName = null;
        this.artistMatchSuggestions = [];
    }

    private ensureArtistSelected(artist: AutocompleteResult) {
        const normalizedArtist = this.normalizeArtistText(artist.value);
        const existingIndex = this.artistsArray.controls.findIndex(ctrl =>
            (artist.id && ctrl.value.id === artist.id) ||
            this.normalizeArtistText(ctrl.value.name) === normalizedArtist
        );

        if (existingIndex >= 0) {
            if (artist.id && !this.artistsArray.at(existingIndex).value.id) {
                this.artistsArray.at(existingIndex).setValue({ id: artist.id, name: artist.value });
            }
            return;
        }

        if (this.artistsArray.length < 5) {
            this.artistsArray.push(this.fb.control({ id: artist.id, name: artist.value }));
        }
    }

    private populateFallbackArtists(result: Partial<YouTubeSearchResult>): void {
        const candidatePool = [
            result.suggestedArtistName,
            result.channelTitle,
            result.title?.split('-')[0]
        ]
            .filter((value): value is string => !!value && value.trim().length >= 2)
            .flatMap(value => this.extractSuggestedArtistCandidates(value))
            .slice(0, 3);

        for (const artistName of candidatePool) {
            this.addNewArtist(artistName);
            if (this.artistsArray.length >= 3) {
                break;
            }
        }
    }

    private resolveArtistMatches(artistName: string) {
        const searchTerms = this.buildArtistSearchTerms(artistName);
        const searchRequests = searchTerms.map(term =>
            this.songService.autocompleteArtists(term).pipe(catchError(() => of([])))
        );

        return forkJoin(searchRequests).pipe(
            switchMap(resultsGroups => {
                const mergedResults = this.mergeArtistMatches(resultsGroups.flat());
                return of(this.rankArtistMatches(artistName, mergedResults));
            })
        );
    }

    private rankArtistMatches(artistName: string, results: AutocompleteResult[]): Array<{ result: AutocompleteResult; score: number }> {
        const normalizedParts = this.extractArtistMatchParts(artistName);

        return results
            .map(result => ({
                result,
                score: this.scoreArtistMatch(normalizedParts, result)
            }))
            .filter(match => match.score > 0)
            .sort((a, b) => b.score - a.score || a.result.displayText.localeCompare(b.result.displayText, 'he'));
    }

    private scoreArtistMatch(normalizedParts: string[], result: AutocompleteResult): number {
        const normalizedOptions = [
            this.normalizeArtistText(result.value),
            this.normalizeArtistText(result.displayText),
            this.normalizeArtistText(result.secondaryText)
        ].filter(Boolean);

        let bestScore = 0;

        for (const option of normalizedOptions) {
            const optionWords = this.splitArtistWords(option);

            for (const part of normalizedParts) {
                if (!part) {
                    continue;
                }

                if (option === part) {
                    bestScore = Math.max(bestScore, 110);
                    continue;
                }

                if (option.startsWith(part) || part.startsWith(option)) {
                    bestScore = Math.max(bestScore, 92);
                }

                if (option.includes(part) || part.includes(option)) {
                    bestScore = Math.max(bestScore, 78);
                }

                const partWords = this.splitArtistWords(part);
                const commonWords = partWords.filter(word => optionWords.includes(word));

                if (commonWords.length > 0) {
                    const coverageScore = Math.round((commonWords.length / partWords.length) * 70);
                    const wordBonus = commonWords.length * 8;
                    bestScore = Math.max(bestScore, coverageScore + wordBonus);
                }
            }
        }

        return bestScore;
    }

    private buildArtistSearchTerms(artistName: string): string[] {
        const normalizedParts = this.extractArtistMatchParts(artistName);
        const terms = new Set<string>([artistName.trim()]);

        normalizedParts.forEach(part => {
            if (part.length >= 2) {
                terms.add(part);
            }
        });

        return Array.from(terms).slice(0, 6);
    }

    private extractSuggestedArtistCandidates(value: string): string[] {
        const cleanedValue = value
            .replace(/\s+\bfeat\.?\b/gi, ' feat ')
            .replace(/\s+\bft\.?\b/gi, ' feat ')
            .replace(/\s+\bwith\b/gi, ' עם ')
            .replace(/\s+\bx\b/gi, ' x ');

        const rawCandidates = cleanedValue
            .split(/\s+\bfeat\b\s+|\s+\bעם\b\s+|\s+\bx\b\s+|,|&|\//gi)
            .map(candidate => candidate.trim())
            .filter(candidate => candidate.length >= 2);

        return Array.from(new Set(rawCandidates)).slice(0, 5);
    }

    private extractArtistMatchParts(value: string): string[] {
        const normalizedValue = this.normalizeArtistText(value);
        const rawParts = normalizedValue
            .split(/\s+\b(?:feat|ft|official|topic|with)\b\s+|\||,|\/|&|\+|\bx\b/gi)
            .map(part => part.trim())
            .filter(part => part.length >= 2);

        const parts = new Set<string>();

        if (normalizedValue.length >= 2) {
            parts.add(normalizedValue);
        }

        rawParts.forEach(part => {
            parts.add(part);

            const words = this.splitArtistWords(part);
            if (words.length >= 2) {
                parts.add(words.slice(0, 2).join(' '));
            }
        });

        return Array.from(parts);
    }

    private splitArtistWords(value: string): string[] {
        return value
            .split(' ')
            .map(word => word.trim())
            .filter(word => word.length >= 2);
    }

    private mergeArtistMatches(results: AutocompleteResult[]): AutocompleteResult[] {
        const uniqueResults = new Map<string, AutocompleteResult>();

        results.forEach(result => {
            const key = result.id ? `id-${result.id}` : this.normalizeArtistText(`${result.displayText} ${result.secondaryText ?? ''}`);
            if (!uniqueResults.has(key)) {
                uniqueResults.set(key, result);
            }
        });

        return Array.from(uniqueResults.values());
    }

    private normalizeArtistText(value?: string): string {
        return (value || '')
            .toLowerCase()
            .replace(/\(official.*?\)|\[official.*?\]/gi, ' ')
            .replace(/\bofficial\b/gi, ' ')
            .replace(/\bvideo\b/gi, ' ')
            .replace(/\baudio\b/gi, ' ')
            .replace(/\blyrics?\b/gi, ' ')
            .replace(/- topic$/gi, ' ')
            .replace(/[|]+/g, ' | ')
            .replace(/[^\p{L}\p{N}|]+/gu, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }

    formatDuration(durationSeconds?: number): string {
        if (!durationSeconds || durationSeconds < 1) {
            return '';
        }

        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    private refineYouTubeResults(query: string, results: YouTubeSearchResult[]): YouTubeSearchResult[] {
        const rankedResults = results
            .map(result => ({
                result,
                score: this.scoreYouTubeResult(query, result)
            }))
            .filter(item => item.score >= 20)
            .sort((a, b) => b.score - a.score);

        return rankedResults.slice(0, 3).map(item => item.result);
    }

    private scoreYouTubeResult(query: string, result: YouTubeSearchResult): number {
        const normalizedQuery = this.normalizeSearchText(query);
        const queryWords = this.extractSearchWords(normalizedQuery);
        const normalizedTitle = this.normalizeSearchText(result.title);
        const normalizedChannel = this.normalizeSearchText(result.channelTitle);

        if (!normalizedTitle || queryWords.length === 0) {
            return 0;
        }

        let score = 0;

        if (normalizedTitle.includes(normalizedQuery)) {
            score += 100;
        }

        const titleWords = this.extractSearchWords(normalizedTitle);
        const channelWords = this.extractSearchWords(normalizedChannel);
        const commonTitleWords = queryWords.filter(word => titleWords.includes(word)).length;
        const commonChannelWords = queryWords.filter(word => channelWords.includes(word)).length;

        score += commonTitleWords * 28;
        score += commonChannelWords * 10;

        if (commonTitleWords === 0 && commonChannelWords === 0) {
            score -= 40;
        }

        if (/podcast|interview|ראיון|shorts|vlog|פרק|episode/i.test(result.title || '')) {
            score -= 35;
        }

        if (/song|lyrics|audio|official|מילים|שיר|אקוסטי|live/i.test(result.title || '')) {
            score += 8;
        }

        return score;
    }

    private normalizeSearchText(value?: string): string {
        return (value || '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private extractSearchWords(value: string): string[] {
        return value
            .split(' ')
            .map(word => word.trim())
            .filter(word => word.length >= 2);
    }

    private pickSmartSongTitle(query: string, youtubeTitle?: string, channelTitle?: string): string {
        const cleanQuery = query.trim();
        const cleanYoutubeTitle = this.cleanVideoTitle(youtubeTitle, channelTitle);

        if (!cleanYoutubeTitle) {
            return cleanQuery;
        }

        if (!cleanQuery) {
            return cleanYoutubeTitle;
        }

        const parts = cleanYoutubeTitle
            .split(/\s+-\s+|\s+\|\s+/)
            .map(part => part.trim())
            .filter(part => part.length >= 2);

        const bestPart = parts
            .map(part => ({ part, score: this.scoreSongTitle(part, cleanQuery) }))
            .sort((a, b) => b.score - a.score)[0];

        return bestPart && bestPart.score >= 45 ? bestPart.part : cleanQuery;
    }

    private cleanVideoTitle(value?: string, channelTitle?: string): string {
        return (value || '')
            .replace(new RegExp(this.escapeRegExp(channelTitle || ''), 'gi'), ' ')
            .replace(/\[(.*?)\]|\((.*?)\)/g, ' ')
            .replace(/\b(official|video|audio|lyrics?|live|topic|hd|4k)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^[\-|:/\s]+|[\-|:/\s]+$/g, '')
            .trim();
    }

    private scoreSongTitle(candidate: string, query: string): number {
        const normalizedCandidate = this.normalizeSearchText(candidate);
        const normalizedQuery = this.normalizeSearchText(query);

        if (!normalizedCandidate || !normalizedQuery) {
            return 0;
        }

        if (normalizedCandidate === normalizedQuery) {
            return 100;
        }

        if (normalizedCandidate.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedCandidate)) {
            return 80;
        }

        const queryWords = this.extractSearchWords(normalizedQuery);
        const candidateWords = this.extractSearchWords(normalizedCandidate);
        const commonWords = queryWords.filter(word => candidateWords.includes(word)).length;

        return commonWords > 0 ? commonWords * 30 : 0;
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    showManualYoutubeStep() {
        this.showManualYoutubeInput = true;
        this.youtubeSearchResults = [];
        this.hasSearchedYouTube = true;
        this.showInlineSuccess = false;
        this.scrollModalToTop();
    }

    useManualAddMode() {
        this.isManualAddMode = true;
        this.isPreviewEditing = false;
        this.currentStep = 1;
        this.youtubeSearchResults = [];
        this.scrollModalToTop();
    }

    returnToSmartFlow() {
        this.isManualAddMode = false;
        this.isPreviewEditing = false;
        this.currentStep = 1;
        this.showManualYoutubeInput = false;
        this.showInlineSuccess = false;
        this.scrollModalToTop();
    }

    openFullDetailsEditor() {
        this.togglePreviewEdit();
    }

    togglePreviewEdit() {
        this.isPreviewEditing = !this.isPreviewEditing;
    }

    confirmPreviewEdit() {
        this.isPreviewEditing = false;
    }

    private scrollModalToTop(): void {
        setTimeout(() => {
            const modalContent = this.modalContent?.nativeElement;
            if (modalContent) {
                modalContent.scrollTop = 0;
            }
            this.focusCurrentInput();
        });
    }

    private focusCurrentInput(): void {
        if (this.showInlineSuccess) {
            return;
        }

        if (!this.isLegacyFlow && this.currentStep === 1) {
            const target = this.showManualYoutubeInput ? this.manualYoutubeInput?.nativeElement : this.titleInput?.nativeElement;
            target?.focus();
            target?.select();
            return;
        }

        if (!this.isLegacyFlow && this.currentStep === 2) {
            this.lyricsInput?.nativeElement.focus();
        }
    }

    private moveToPreview(): void {
        const lyrics = this.songForm.get('lyricsWithChords')?.value ?? '';
        const fallbackResult = this.detectKeyLocally(lyrics);

        this.isDetectingOriginalKey = true;
        this.isDetectingEasyKey = true;

        this.songService.detectKey(lyrics).pipe(
            catchError(() => of(null))
        ).subscribe(result => {
            this.isDetectingOriginalKey = false;
            this.isDetectingEasyKey = false;

            const effectiveResult = result ?? fallbackResult;

            if (effectiveResult) {
                const detectedOriginalKeyId = this.readDetectedKeyId(effectiveResult, 'original') ?? fallbackResult?.originalKeyId ?? null;
                const detectedEasyKeyId = this.readDetectedKeyId(effectiveResult, 'easy') ?? fallbackResult?.easyKeyId ?? null;

                if (detectedOriginalKeyId !== null) {
                    this.songForm.get('originalKeyId')?.setValue(String(detectedOriginalKeyId), { emitEvent: false });
                    this.autoDetectedOriginalKeyName = this.getKeyNameById(detectedOriginalKeyId);
                }

                if (detectedEasyKeyId !== null) {
                    this.songForm.get('easyKeyId')?.setValue(String(detectedEasyKeyId), { emitEvent: false });
                    this.autoDetectedEasyKeyName = this.getKeyNameById(detectedEasyKeyId);
                }
            }

            if (this.songForm.get('originalKeyId')?.value) {
                this.currentStep = 3;
                this.scrollModalToTop();
                return;
            }

            this.songForm.get('originalKeyId')?.markAsTouched();
        });
    }

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            if (this.isLegacyFlow) {
                if (this.currentStep === 1) {
                    const titleValid = this.songForm.get('title')?.valid;
                    const artistsValid = this.artistsArray.length > 0;
                    const youtubeValid = this.songForm.get('youtubeUrl')?.valid;

                    if (!titleValid || !artistsValid || !youtubeValid) {
                        this.songForm.markAllAsTouched();
                        if (!titleValid) {
                            this.showRequiredField('[formControlName="title"]');
                        } else if (!artistsValid) {
                            this.showRequiredField('[data-required-artists]');
                        } else {
                            this.showRequiredField('[formControlName="youtubeUrl"]');
                        }
                        return;
                    }
                } else if (this.currentStep === 2) {
                    const lyricsValid = this.songForm.get('lyricsWithChords')?.valid;
                    const keyValid = this.songForm.get('originalKeyId')?.valid;

                    if (!lyricsValid || !keyValid) {
                        this.songForm.markAllAsTouched();
                        this.showRequiredField(lyricsValid ? '[formControlName="originalKeyId"]' : '[formControlName="lyricsWithChords"]');
                        return;
                    }
                }
            } else {
                if (this.currentStep === 1) {
                    const hasVideoSelection = !!this.songForm.get('youtubeUrl')?.value && (!!this.selectedYouTubeResult || this.showManualYoutubeInput);
                    if (!hasVideoSelection) {
                        this.songForm.get('youtubeUrl')?.markAsTouched();
                        this.showRequiredField('[formControlName="youtubeUrl"]');
                        return;
                    }

                    if (this.artistsArray.length === 0) {
                        this.populateFallbackArtists({
                            suggestedArtistName: this.youtubeMetadata?.channelTitle,
                            channelTitle: this.youtubeMetadata?.channelTitle,
                            title: this.songForm.get('title')?.value
                        });
                    }
                } else if (this.currentStep === 2) {
                    const lyricsValid = this.songForm.get('lyricsWithChords')?.valid;

                    if (!lyricsValid) {
                        this.songForm.get('lyricsWithChords')?.markAsTouched();
                        this.showRequiredField('[formControlName="lyricsWithChords"]');
                        return;
                    }

                    this.moveToPreview();
                    return;
                }
            }

            this.currentStep++;
            this.scrollModalToTop();
        }
    }

    prevStep() {
        if (!this.isLegacyFlow && this.currentStep === 3 && this.isPreviewEditing) {
            this.isPreviewEditing = false;
            return;
        }

        if (this.currentStep > 1) {
            if (!this.isLegacyFlow && this.currentStep === 3) {
                this.currentStep = 2;
                this.scrollModalToTop();
                return;
            }

            this.currentStep--;
            this.scrollModalToTop();
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
                sheetMusicUrl: formValue.sheetMusicUrl?.trim() || undefined,
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
                uploaderProfileType: this.selectedUploaderProfile?.profileType,
                uploaderProfileId: this.selectedUploaderProfile?.profileId
            };

            // Choose add or update based on mode
            const operation = this.editMode && this.songToEdit
                ? this.songService.updateSong(this.songToEdit.id, request)
                : this.songService.addSong(request);

            operation.subscribe({
                next: (res) => {
                    this.isSubmitting = false;
                    if (res.success) {
                        this.successMessage = this.editMode
                            ? this.langService.translate('song_modal.success_updated')
                            : this.langService.translate('song_modal.success_sent');
                        this.showInlineSuccess = true;
                        this.scrollModalToTop();
                        this.songAdded.emit();
                    } else {
                        this.submissionError = res.message || this.langService.translate('song_modal.error_prefix');
                    }
                },
                error: (err) => {
                    this.isSubmitting = false;
                    console.error('Full error:', err);
                    console.error('Error details:', err.error);
                    const message = this.editMode
                        ? this.langService.translate('song_modal.error_update')
                        : this.langService.translate('song_modal.error_save');
                    this.submissionError = message;
                }
            });
        } else {
            this.songForm.markAllAsTouched();
            const invalidField = this.getFirstInvalidSongField();
            if (invalidField) {
                this.currentStep = invalidField.step;
                this.showRequiredField(invalidField.selector);
            }
        }
    }

    private showRequiredField(selector: string): void {
        setTimeout(() => this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, selector));
    }

    private getFirstInvalidSongField(): { step: number; selector: string } | null {
        if (this.songForm.get('title')?.invalid) return { step: 1, selector: '[formControlName="title"]' };
        if (this.artistsArray.length === 0) return { step: 1, selector: '[data-required-artists]' };
        if (this.songForm.get('youtubeUrl')?.invalid) return { step: 1, selector: '[formControlName="youtubeUrl"]' };
        if (this.songForm.get('lyricsWithChords')?.invalid) return { step: 2, selector: '[formControlName="lyricsWithChords"]' };
        if (this.songForm.get('originalKeyId')?.invalid) return { step: 2, selector: '[formControlName="originalKeyId"]' };
        return null;
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
