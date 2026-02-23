import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, FormArray } from '@angular/forms';
import { SongService } from '../../services/song.service';
import { AddSongRequest, AutocompleteResult, MusicalKey, SongBasicDto, YouTubeMetadata } from '../../models/song.model';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of, Subject } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'app-add-song-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './add-song-modal.component.html',
    styleUrls: ['./add-song-modal.component.css']
})
export class AddSongModalComponent implements OnInit {
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

    // Metadata
    youtubeMetadata: YouTubeMetadata | null = null;
    selectedComposer: { id: number; name: string } | null = null; 

    // Search subjects
    private artistSearch$ = new Subject<string>();
    private tagSearch$ = new Subject<string>();
    private genreSearch$ = new Subject<string>();
    private composerSearch$ = new Subject<string>();

    constructor(
        private fb: FormBuilder,
        private songService: SongService,
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
        
        // Only setup duplicate check for new songs
        if (!this.editMode) {
            this.setupDuplicateCheck();
        }
        
        // If edit mode, populate form with existing data
        if (this.editMode && this.songToEdit) {
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
            originalKeyId: this.songToEdit.originalKeyId,
            easyKeyId: this.songToEdit.easyKeyId || null,
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

    loadMusicalKeys() {
        this.isLoadingKeys = true;
        this.songService.getMusicalKeys().subscribe({
            next: (keys) => {
                this.musicalKeys = keys;
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
                artistIds: formValue.artists.map((a: any) => a.id),
                youtubeUrl: formValue.youtubeUrl,
                spotifyUrl: formValue.spotifyUrl?.trim() || undefined,
                imageUrl: formValue.imageUrl,
                tagIds: formValue.tags.map((t: any) => t.id),
                genreIds: formValue.genres.map((g: any) => g.id),
                lyricsWithChords: formValue.lyricsWithChords,
                originalKeyId: formValue.originalKeyId,
                easyKeyId: formValue.easyKeyId,
                composerId: formValue.composerId,
                lyricistId: formValue.lyricistId,
                arrangerId: formValue.arrangerId
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
