import { Component, OnInit, OnDestroy, AfterViewChecked, AfterViewInit, HostListener, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SongService } from '../../services/song.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { AddSongModalComponent } from '../add-song-modal/add-song-modal.component';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import {
    transposeChord,
    simplifyChord,
    analyzePreferFlat,
    preferFlatForKey,
    isChord,
    isChordLine,
    parseChord,
    enharmonicRoot
} from '../../utils/music-utils';

import { GUITAR_CHORDS, UKULELE_CHORDS, PIANO_CHORDS } from '../../utils/chord-data';

import { ChordTooltipComponent } from '../chord-tooltip/chord-tooltip.component';
import { PlaylistPopupComponent } from '../playlist-popup/playlist-popup.component';
import { ReportModalComponent } from '../shared/report-modal/report-modal.component';
import { ContentUploaderBadgeComponent } from '../shared/content-uploader-badge/content-uploader-badge.component';
import { PrintPanelComponent } from './print-panel/print-panel.component';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';
import { PlaylistService } from '../../services/playlist.service';
import { PlaylistDetail } from '../../models/playlist.model';
import { UserKnownChordService, KnownChordInstrument } from '../../services/user-known-chord.service';
import { SongRatingService } from '../../services/song-rating.service';
import { SeoService } from '../../services/seo.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { ArticleService } from '../../services/admin/article.service';
import { Article, ArticleContentType, ArticleStatus } from '../../models/article.model';
import { artistRoute, songSlug } from '../../utils/slug';
import { CloudflareImagePipe, CloudflareImageSrcsetPipe } from '../../pipes/cloudflare-image.pipe';

@Component({
    selector: 'app-song-page',
    standalone: true,
    imports: [CommonModule, RouterModule, ChordTooltipComponent, AddSongModalComponent, PlaylistPopupComponent, ReportModalComponent, ContentUploaderBadgeComponent, PrintPanelComponent, NewsBannerComponent, TranslatePipe, CloudflareImagePipe, CloudflareImageSrcsetPipe],
    templateUrl: './song-page.component.html',
    styleUrls: ['./song-page.component.css']
})
export class SongPageComponent implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit {

    @ViewChild('songHeaderBg') songHeaderBg?: ElementRef<HTMLDivElement>;
    @ViewChild('songHeaderContent') songHeaderContent?: ElementRef<HTMLDivElement>;
    @ViewChild('newsSentinel') newsSentinel?: ElementRef<HTMLDivElement>;
    @ViewChild('mainColumn') mainColumn?: ElementRef<HTMLDivElement>;
    @ViewChild('ratingSection') ratingSection?: ElementRef<HTMLDivElement>;
    private headerLayoutDone = false;
    private fullHeaderHeight = 0;
    private rafPending = false;

    songId: number | null = null;
    song: any = null;
    isLoading: boolean = false;
    error: string | null = null;
    dailyLimitInfo: { dailyViewCount: number; dailyLimit: number; tagHebrew?: string } | null = null;
    isPlaylistPopupOpen: boolean = false;
    isReportModalOpen: boolean = false;
    showCopyNotification: boolean = false;

    // Toolbar State
    transposeStep: number = 0;
    fontSize: number = 18;
    isAutoScroll: boolean = false;
    scrollSpeed: number = 1;
    showChords: boolean = true;
    selectedInstrument: 'guitar' | 'piano' | 'ukulele' | 'lyrics' = 'guitar';
    isDarkMode: boolean = false;
    isToolbarSticky: boolean = false;
    preferFlat: boolean = false;
    isEasyMode: boolean = false;
    showInlineChordDiagrams: boolean = false;
    showKnownChordSummary: boolean = true;

    // Tooltip State
    hoveredChord: string | null = null;
    tooltipPosition: { x: number, y: number } = { x: 0, y: 0 };
    tooltipAbove: boolean = true;

    // Pinned Tooltip State (desktop only)
    pinnedChord: string | null = null;
    pinnedPosition: { x: number, y: number } = { x: 0, y: 0 };
    pinnedAbove: boolean = true;

    // Tooltip hover-sticky state
    tooltipHovered = false;
    private tooltipCloseTimer: any = null;

    // Cache for formattedLyricsHtml — prevents DOM replacement on every CD cycle
    private _lyricsHtmlCache: SafeHtml = '';
    private _lyricsHtmlCacheKey = '';

    // Cache for uniqueTransposedChords
    private _uniqueChordsCache: string[] = [];
    private _uniqueChordsCacheKey = '';

    // Print Panel State
    isPrintPanelOpen: boolean = false;

    // YouTube Modal State
    showYoutubeModal: boolean = false;
    youtubeEmbedUrl: SafeResourceUrl | null = null;

    // Bookmark State
    isSongSaved: boolean = false;
    shouldAutoSaveOnPopupOpen: boolean = false;

    canEdit: boolean = false;
    isEditModalOpen: boolean = false;

    // Playlist navigation bar
    playlistNavData: { name: string; songs: { songId: number; songTitle: string }[] } | null = null;
    playlistNavDismissed = false;
    private currentNavPlaylistId: number | null = null;

    // Rating State
    ratingAverage: number = 0;
    ratingCount: number = 0;
    userRating: number | null = null;
    isSubmittingRating: boolean = false;

    get isLoggedIn(): boolean { return this.authService.isLoggedIn; }

    get hasFullSongContent(): boolean {
        return !!this.song?.hasFullContent && !!this.song?.lyricsWithChords;
    }

    get songViewSubtitle(): string {
        switch (this.selectedInstrument) {
            case 'lyrics':
                return this.langService.translate('song.view_title_lyrics');
            case 'piano':
                return this.langService.translate('song.view_title_piano');
            case 'ukulele':
                return this.langService.translate('song.view_title_ukulele');
            default:
                return this.langService.translate('song.view_title_guitar');
        }
    }

    getDailyLimitMessage(): string {
        if (!this.dailyLimitInfo) return '';
        const tpl = this.langService.translate('song.daily_limit_message');
        return tpl.replace('{count}', String(this.dailyLimitInfo.dailyViewCount))
                  .replace('{limit}', String(this.dailyLimitInfo.dailyLimit));
    }
    artistSongs: any[] = [];
    popularSongs: any[] = [];
    similarSongs: any[] = [];
    musicNewsArticles: Article[] = [];
    isLoadingArtistSongs: boolean = false;
    isLoadingPopularSongs: boolean = false;
    isLoadingSimilarSongs: boolean = false;
    isLoadingMusicNews: boolean = false;
    isLoadingMoreNews: boolean = false;
    showMusicNewsLink: boolean = false;
    musicNewsLinkHeight: number = 44;
    private allMusicNewsArticles: Article[] = [];
    private musicNewsLoadedCount: number = 0;
    private newsObserver: IntersectionObserver | null = null;

    // Auto Scroll State
    private scrollInterval: any = null;
    private authSubscription?: Subscription;
    private routeSub?: Subscription;
    private queryParamsSub?: Subscription;

    constructor(
        private route: ActivatedRoute,
        private songService: SongService,
        private sanitizer: DomSanitizer,
        public authService: AuthService,
        private router: Router,
        private ngZone: NgZone,
        private playlistService: PlaylistService,
        private knownChordService: UserKnownChordService,
        private songRatingService: SongRatingService,
        private seo: SeoService,
        private langService: LanguageService,
        private articleService: ArticleService,
    ) { }

    handleRandomSongClick(): void {
        this.songService.getRandomSong().subscribe({
            next: (song: any) => {
                if (song?.id) {
                    const slug = songSlug(song);
                    this.router.navigate(slug ? ['/song', song.id, slug] : ['/song', song.id]);
                }
            },
            error: (err: any) => console.error('Failed to get random song', err)
        });
    }

    ngOnInit(): void {
        this.routeSub = this.route.params.subscribe(params => {
            const id = params['id'];
            const slug = params['slug'];
            if (id) {
                this.songId = +id;
                this.loadSong(this.songId, slug);
            }
        });

        this.queryParamsSub = this.route.queryParams.subscribe(queryParams => {
            const playlistId = queryParams['playlistId'];
            const view = queryParams['view'];
            if (this.isSongView(view) && view !== this.selectedInstrument) {
                this.selectInstrument(view, false);
            }
            if (playlistId) {
                const numId = +playlistId;
                this.playlistNavDismissed = false;
                if (numId !== this.currentNavPlaylistId) {
                    this.currentNavPlaylistId = numId;
                    this.loadPlaylistNav(numId);
                }
            } else {
                this.currentNavPlaylistId = null;
                this.playlistNavData = null;
            }
        });

        // All native listeners run outside Angular zone — no change detection on scroll/click
        this.authSubscription = this.authService.currentUser$.subscribe(user => {
            if (user && this.songId && this.song?.hasFullContent === false) {
                this.loadSong(this.songId);
            }
        });

        this.ngZone.runOutsideAngular(() => {
            document.addEventListener('click', this.nativeDocumentClick);
            window.addEventListener('scroll', this.nativeWindowScroll, { passive: true });
        });

        // חסימת העתקה וקליק ימני בדף השיר
        document.addEventListener('copy', this.preventCopy);
        document.addEventListener('contextmenu', this.preventContextMenu);
        document.addEventListener('selectstart', this.preventSelect);
    }

    ngOnDestroy() {
        document.removeEventListener('click', this.nativeDocumentClick);
        window.removeEventListener('scroll', this.nativeWindowScroll);
        document.removeEventListener('copy', this.preventCopy);
        document.removeEventListener('contextmenu', this.preventContextMenu);
        document.removeEventListener('selectstart', this.preventSelect);
        this.authSubscription?.unsubscribe();
        this.routeSub?.unsubscribe();
        this.queryParamsSub?.unsubscribe();
        this.stopAutoScroll();
        this.isAutoScroll = false;
        this.stopNewsObserver();
    }

    // חסימת העתקה, קליק ימני, סימון טקסט
    private preventCopy = (e: ClipboardEvent) => e.preventDefault();
    private preventContextMenu = (e: MouseEvent) => e.preventDefault();
    private preventSelect = (e: Event) => e.preventDefault();

    // Arrow function preserves `this` when used as a callback
    private nativeDocumentClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const isChord = target.classList.contains('chord-inline') ||
                        target.classList.contains('chord-block');

        if (isChord && !this.isMobileDevice()) {
            const chord = target.innerText.trim();
            const pos = this.tooltipPositionFromRect(target.getBoundingClientRect());
            this.ngZone.run(() => {
                this.hoveredChord = null;
                this.pinnedChord = chord;
                this.pinnedPosition = { x: pos.x, y: pos.y };
                this.pinnedAbove = pos.above;
            });
            return;
        }

        if (this.pinnedChord && !isChord) {
            this.ngZone.run(() => { this.pinnedChord = null; });
        }

        // מובייל — סגור טולטיפ hover כשלוחצים על אזור שאינו אקורד
        if (this.isMobileDevice() && !isChord && this.hoveredChord) {
            this.ngZone.run(() => { this.hoveredChord = null; });
        }
    };

    loadSong(id: number, currentSlug?: string) {
        this.headerLayoutDone = false;
        this.isLoading = true;
        this.error = null;
        this.dailyLimitInfo = null;
        this.canEdit = false; 
        this.isEasyMode = false;
        this.showKnownChordSummary = true;

        if (currentSlug === undefined) {
            const snapshotSlug = this.route.snapshot.paramMap.get('slug');
            currentSlug = snapshotSlug || undefined;
        }

        const isPreview = this.route.snapshot.queryParamMap.get('preview') === 'true';
        const songRequest = isPreview
            ? this.songService.getSongByIdForAdmin(id)
            : this.songService.getSongById(id);

        songRequest.subscribe({
            next: (data) => {
                this.song = data;
                this.isLoading = false;

                const expectedSlug = songSlug(this.song);
                if (expectedSlug && currentSlug !== expectedSlug) {
                    this.router.navigate(['/song', id, expectedSlug], {
                        replaceUrl: true,
                        queryParams: this.route.snapshot.queryParams
                    });
                    return;
                }

                this.applySeo();

                this.preferFlat = this.hasFullSongContent
                    ? analyzePreferFlat(this.song.lyricsWithChords, this.song.originalKeyName)
                    : false;

                this.transposeStep = 0;
                this.fontSize = window.innerWidth <= 600 ? 14 : 18;
                this.isSongSaved = false;
                this.shouldAutoSaveOnPopupOpen = false;
                this.showInlineChordDiagrams = false;
                this.stopAutoScroll();
                this.isAutoScroll = false;
                this.checkEditPermission(id);
                this.loadArtistSongs();
                this.loadSimilarSongs();
                this.loadPopularSongs();
                this.loadMusicNews();
                this.loadSongSavedState();
                if (this.hasFullSongContent) {
                    this.loadKnownChordsForCurrentInstrument();
                }
                this.loadRating(id);

                // Increment view count with unique tracking
                if (this.hasFullSongContent) {
                    this.songService.incrementView(id).subscribe({
                        next: (response) => {
                            // Update the view count in the UI
                            if (this.song && response.viewCount) {
                                this.song.viewCount = response.viewCount;
                            }
                        },
                        error: (err) => {
                            if (err.status === 429) {
                                this.dailyLimitInfo = err.error || null;
                            }
                            console.error('Error incrementing view count:', err);
                        }
                    });
                }

            },
            error: (err) => {
                console.error('Error loading song:', err);
                if (err.status === 429) {
                    this.dailyLimitInfo = err.error || { dailyViewCount: 0, dailyLimit: 10 };
                } else {
                    this.error = this.langService.translate('song.error_load');
                }
                this.isLoading = false;
            }
        });
    }

    loadSongSavedState(): void {
        if (!this.songId || !this.authService.isLoggedIn) {
            this.isSongSaved = false;
            return;
        }

        this.playlistService.getSongPlaylistState(this.songId).subscribe({
            next: (state) => {
                this.isSongSaved = state.isInDefault;
            },
            error: () => {
                this.isSongSaved = false;
            }
        });
    }

    private applySeo(): void {
        if (!this.song || !this.songId) return;
        const artistName = this.getArtistNames();
        const viewText = this.getSeoViewText();
        const title = artistName
            ? `${this.song.title} - ${artistName} ${viewText}`
            : `${this.song.title} ${viewText}`;
        const description = artistName
            ? `${viewText} לשיר ${this.song.title} של ${artistName}, כולל סולם וכלי נגינה לגיטרה, קלידים ויוקלילי.`
            : `${viewText} לשיר ${this.song.title}, כולל סולם וכלי נגינה לגיטרה, קלידים ויוקלילי.`;
        const slug = songSlug(this.song);
        const path = slug ? `/song/${this.songId}/${slug}` : `/song/${this.songId}`;

        this.seo.set({
            title,
            description,
            path,
            imageUrl: this.song.imageUrl,
            structuredData: [
                this.seo.organizationSchema(),
                this.seo.breadcrumbSchema([
                    { name: this.langService.translate('nav.home_label'), path: '/' },
                    { name: this.langService.translate('song_page.breadcrumb_chords'), path: '/chords' },
                    { name: this.song.title, path }
                ]),
                {
                    '@context': 'https://schema.org',
                    '@type': 'MusicRecording',
                    name: this.song.title,
                    byArtist: artistName ? { '@type': 'MusicGroup', name: artistName } : undefined,
                    image: this.song.imageUrl ? this.seo.absoluteUrl(this.song.imageUrl) : undefined,
                    url: this.seo.absoluteUrl(path)
                }
            ]
        });
    }

    private getSeoViewText(): string {
        switch (this.selectedInstrument) {
            case 'lyrics':
                return 'מילים';
            case 'piano':
                return 'אקורדים לקלידים';
            case 'ukulele':
                return 'אקורדים ליוקלילי';
            default:
                return 'אקורדים לגיטרה';
        }
    }

    private getArtistNames(): string {
        if (this.song?.artists?.length) {
            return this.song.artists.map((artist: any) => artist.name).filter(Boolean).join(', ');
        }
        return this.song?.artistName || '';
    }

    checkEditPermission(songId: number) {
        this.songService.canEditSong(songId).subscribe({
            next: (canEdit) => {
                this.canEdit = canEdit;
            },
            error: () => {
                this.canEdit = false;
            }
        });
    }

    // הוסיפי פונקציות לפתיחה/סגירה של מודאל העריכה
    openEditModal() {
        this.isEditModalOpen = true;
    }

    closeEditModal() {
        this.isEditModalOpen = false;
    }

    onSongUpdated() {
        this.closeEditModal();
        // רענון השיר
        if (this.songId) {
            this.loadSong(this.songId);
        }
    }

    ngAfterViewChecked() {
        if (!this.headerLayoutDone && this.songHeaderBg && this.songHeaderContent) {
            this.headerLayoutDone = true;
            setTimeout(() => this.updateHeaderLayout(), 0);
        }
    }

    @HostListener('window:resize')
    onResize() {
        this.headerLayoutDone = false;
    }

    // Runs outside Angular zone — no change detection on every scroll event
    private nativeWindowScroll = () => {
        const shouldBeSticky = window.scrollY > 300;

        // Bring into zone only when value actually changes
        if (shouldBeSticky !== this.isToolbarSticky) {
            this.ngZone.run(() => { this.isToolbarSticky = shouldBeSticky; });
        }

        if (!this.rafPending) {
            this.rafPending = true;
            requestAnimationFrame(() => {
                this.shrinkHeader();
                this.rafPending = false;
            });
        }

        // On mobile, scroll closes the open tooltip
        if (this.isMobileDevice() && this.hoveredChord) {
            this.ngZone.run(() => { this.hoveredChord = null; });
        }
    };


    /** Active chord for the single shared tooltip element */
    get activeTooltipChord(): string | null {
        return this.pinnedChord ?? this.hoveredChord;
    }
    get activeTooltipPosition() {
        return this.pinnedChord ? this.pinnedPosition : this.tooltipPosition;
    }
    get activeTooltipAbove(): boolean {
        return this.pinnedChord ? this.pinnedAbove : this.tooltipAbove;
    }

    /** Compute tooltip position from a bounding rect — shared between hover and pin */
    private tooltipPositionFromRect(rect: DOMRect): { x: number; y: number; above: boolean } {
        const tooltipW = 160;
        const tooltipH = 210;
        const margin = 8;

        // Horizontal: center on chord element, clamped so tooltip never exits viewport
        let x = rect.left + rect.width / 2;
        x = Math.max(tooltipW / 2 + margin, Math.min(window.innerWidth - tooltipW / 2 - margin, x));

        // Vertical: prefer above; fallback to below; if neither fits, pick whichever has more room
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        const above = spaceAbove >= tooltipH + margin
            ? true
            : spaceBelow >= tooltipH + margin
                ? false
                : spaceAbove >= spaceBelow;

        const y = above ? rect.top - margin : rect.bottom + margin;
        return { x, y, above };
    }

    private updateHeaderLayout() {
        const bg = this.songHeaderBg?.nativeElement;
        const content = this.songHeaderContent?.nativeElement;
        if (!bg || !content) return;
        const contentRect = content.getBoundingClientRect();
        const boxTop = 8; // matches CSS top: 8px
        const h = Math.round(contentRect.bottom - boxTop + window.scrollY);
        this.fullHeaderHeight = h;
        bg.style.height = h + 'px';
        this.shrinkHeader();
    }

    private shrinkHeader() {
        const bg = this.songHeaderBg?.nativeElement;
        if (!bg || this.fullHeaderHeight === 0) return;

        const minHeight = window.innerWidth <= 600 ? 44 : 56;
        const newHeight = Math.max(minHeight, this.fullHeaderHeight - window.scrollY);
        bg.style.height = newHeight + 'px';

        // fade תוכן ב-160px הראשונים של הגלילה
        const content = this.songHeaderContent?.nativeElement;
        if (content) {
            const fadeProgress = Math.min(1, window.scrollY / 160);
            content.style.opacity = String(1 - fadeProgress);
        }

        // overlay אפור כהה — מתגבר ככל שהתיבה מתכווצת
        const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
        if (collapseOverlay) {
            const collapseRange = this.fullHeaderHeight - minHeight;
            const collapseProgress = collapseRange > 0
                ? Math.min(1, (this.fullHeaderHeight - newHeight) / collapseRange)
                : 0;
            collapseOverlay.style.opacity = String(collapseProgress);
        }
    }

    transpose(direction: number) {
        if ((this.transposeStep >= 6 && direction > 0) || (this.transposeStep <= -5 && direction < 0)) return;
        this.isEasyMode = false;
        this.transposeStep += direction;
    }

    resetTranspose() {
        this.isEasyMode = false;
        this.transposeStep = 0;
    }

    changeFontSize(delta: number): void {
        // עדכן את הגודל לפני הלוג – כך שה‑console יציג את הערך החדש
        this.fontSize = Math.max(10, Math.min(32, this.fontSize + delta));
    }


    private isSongView(value: unknown): value is 'guitar' | 'piano' | 'ukulele' | 'lyrics' {
        return value === 'guitar' || value === 'piano' || value === 'ukulele' || value === 'lyrics';
    }

    selectInstrument(instrument: 'guitar' | 'piano' | 'ukulele' | 'lyrics', updateUrl: boolean = true) {
        this.selectedInstrument = instrument;
        this.showChords = instrument !== 'lyrics';
        this.showKnownChordSummary = true;
        this.showInlineChordDiagrams = this.showInlineChordDiagrams && this.hasFullSongContent;
        this.loadKnownChordsForCurrentInstrument();
        this.applySeo();

        if (updateUrl) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { view: instrument === 'guitar' ? null : instrument },
                queryParamsHandling: 'merge',
                replaceUrl: true
            });
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
    }

    toggleAutoScroll() {
        this.isAutoScroll = !this.isAutoScroll;
        if (this.isAutoScroll) {
            this.startAutoScroll();
        } else {
            this.stopAutoScroll();
        }
    }

    changeScrollSpeed(delta: number) {
        // Scroll speed ranges from 0.5 to 5
        this.scrollSpeed = Math.max(0.5, Math.min(5, this.scrollSpeed + (delta * 0.5)));
    }

    startAutoScroll() {
        this.stopAutoScroll();
        this.scrollInterval = setInterval(() => {
            window.scrollBy(0, this.scrollSpeed);
            if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight) {
                this.stopAutoScroll();
            }
        }, 50);
    }

    stopAutoScroll() {
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
            this.isAutoScroll = false;
        }
    }

    get capoFret(): number | null {
        if (this.transposeStep === 0) return null;
        return this.transposeStep > 0 ? this.transposeStep : 12 + this.transposeStep;
    }

   get currentKey(): string {
        if (!this.song || !this.song.originalKeyName) return '';
        const originalKey = this.song.originalKeyName;
        if (this.transposeStep === 0) return originalKey;
        return transposeChord(originalKey, this.transposeStep, { preferFlat: this.preferFlat });
    }

    /**
     * Returns the flat/sharp preference for the CURRENT (possibly transposed) key.
     * Used by all transposeChord calls so accidentals match the target key.
     */
    get activePreferFlat(): boolean {
        if (this.transposeStep === 0) return this.preferFlat;
        const key = this.currentKey;
        return key ? preferFlatForKey(key) : this.preferFlat;
    }


    /** בדיקה אם לאקורד יש נתונים במאגר עבור הכלי הנוכחי */
    private hasChordData(chord: string): boolean {
        const variations = this.getChordVariations(chord);
        const map = this.selectedInstrument === 'ukulele' ? UKULELE_CHORDS
                  : this.selectedInstrument === 'piano'   ? PIANO_CHORDS
                  : GUITAR_CHORDS;
        for (const v of variations) if (map[v]) return true;
        return false;
    }

    private getChordVariations(chord: string): string[] {
        const variations: string[] = [chord];
        const parsed = parseChord(chord);
        if (parsed?.normalizedName && !variations.includes(parsed.normalizedName)) {
            variations.push(parsed.normalizedName);
        }
        if (parsed) {
            const { root, suffix } = parsed;
            const altRoot = enharmonicRoot(root);
            if (altRoot) {
                const alt = altRoot + suffix;
                if (!variations.includes(alt)) variations.push(alt);
            }
            const basic = simplifyChord(chord);
            if (!variations.includes(basic)) variations.push(basic);
        }
        return variations;
    }

    /** רשימת אקורדים ייחודיים אחרי טרנספוזיציה — לתרשימים inline */
    get uniqueTransposedChords(): string[] {
        if (!this.song?.lyricsWithChords) return [];
        const cacheKey = `${this.song.lyricsWithChords}|${this.transposeStep}|${this.isEasyMode}|${this.activePreferFlat}|${this.selectedInstrument}`;
        if (cacheKey === this._uniqueChordsCacheKey) return this._uniqueChordsCache;

        const seen = new Set<string>();
        const result: string[] = [];
        for (const line of this.song.lyricsWithChords.split('\n')) {
            const rawChords: string[] = [];
            if (isChordLine(line)) {
                rawChords.push(...line.trim().split(/\s+/).filter((t: string) => isChord(t)));
            } else {
                const matches = [...line.matchAll(/\[([^\]]+)\]/g)];
                rawChords.push(...matches.map((m: any) => m[1]).filter((c: string) => isChord(c)));
            }
            for (const raw of rawChords) {
                let c = this.transposeStep !== 0
                    ? transposeChord(raw, this.transposeStep, { preferFlat: this.activePreferFlat })
                    : raw;
                if (this.isEasyMode) c = simplifyChord(c);
                const key = simplifyChord(c);
                if (!seen.has(key) && this.hasChordData(c)) { seen.add(key); result.push(c); }
            }
        }

        this._uniqueChordsCacheKey = cacheKey;
        this._uniqueChordsCache = result;
        return result;
    }

    get knownChordSummary() {
        const instrument = this.activeKnownInstrument;
        if (!this.showKnownChordSummary || !instrument || !this.authService.isLoggedIn) return null;
        return this.knownChordService.buildLocalSummary(instrument, this.uniqueTransposedChords);
    }

    hideKnownChordSummary(): void {
        this.showKnownChordSummary = false;
    }

    private get activeKnownInstrument(): KnownChordInstrument | null {
        return this.selectedInstrument === 'lyrics' ? null : this.selectedInstrument;
    }

    private loadKnownChordsForCurrentInstrument(): void {
        const instrument = this.activeKnownInstrument;
        if (!instrument || !this.authService.isLoggedIn || !this.hasFullSongContent) return;
        this.knownChordService.ensureLoaded(instrument).subscribe();
    }

    toggleInlineChordDiagrams() {
        if (!this.hasFullSongContent) {
            this.openLoginForSong();
            return;
        }
        this.showInlineChordDiagrams = !this.showInlineChordDiagrams;
    }

    // Get transpose display value in tones (half-steps / 2)
    get transposeDisplay(): string {
        if (this.transposeStep === 0) return '0';

        const tones = this.transposeStep / 2;
        const sign = this.transposeStep > 0 ? '+' : '';

        // Format: +0.5, +1, +1.5, etc.
        return `${sign}${tones}`;
    }

    // ⭐ הלוגיקה החדשה - תמיכה גם ב-Inline וגם ב-Block (Line over Line)
    get formattedLyricsHtml(): SafeHtml {
        if (!this.hasFullSongContent) return '';

        // Cache key — recompute only when relevant inputs change
        const cacheKey = `${this.song.lyricsWithChords}|${this.transposeStep}|${this.showChords}|${this.isEasyMode}|${this.activePreferFlat}`;
        if (cacheKey === this._lyricsHtmlCacheKey) return this._lyricsHtmlCache;

        const lines = this.song.lyricsWithChords.split('\n');

        const processedLines = lines.map((line: string) => {
            // 1. Check for Line-over-Line Chords (Block Chords)
            if (isChordLine(line)) {
                if (!this.showChords) return null; // Hide line if chords are hidden

                // Wrap each non-whitespace token that isChord recognises.
                // /\S+/g preserves all original spacing between chords.
                return line.replace(/\S+/g, (token) => {
                    if (!isChord(token)) return token;
                    let chord = this.transposeStep !== 0
                        ? transposeChord(token, this.transposeStep, { preferFlat: this.activePreferFlat })
                        : token;
                    if (this.isEasyMode) chord = simplifyChord(chord);
                    return `<span class="chord-block">${chord}</span>`;
                });
            }

            // 2. Normal Line (Lyrics + potentially Inline Chords)
            let processed = line;

            // Escape HTML (basic)
            processed = processed
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

            // Inline Chords [Am] — only real chords get highlighted; [Verse], [Intro] etc. pass through as-is
            if (this.showChords) {
                processed = processed.replace(/\[(.*?)\]/g, (match, chord) => {
                    if (!isChord(chord)) return match;
                    let result = this.transposeStep !== 0
                        ? transposeChord(chord, this.transposeStep, { preferFlat: this.activePreferFlat })
                        : chord;
                    if (this.isEasyMode) result = simplifyChord(result);
                    return `<span class="chord-inline">${result}</span>`;
                });
            } else {
                // Remove chords if hidden
                processed = processed.replace(/\[(.*?)\]/g, '');
            }

            return processed;
        }).filter((line: any) => line !== null);

        // Join lines with newlines (pre-wrap handles the display)
        this._lyricsHtmlCacheKey = cacheKey;
        this._lyricsHtmlCache = this.sanitizer.bypassSecurityTrustHtml(processedLines.join('\n'));
        return this._lyricsHtmlCache;
    }

    handleLyricsMouseOver(event: MouseEvent) {
        if (this.pinnedChord) return;
        const target = event.target as HTMLElement;
        if (target.classList.contains('chord-inline') || target.classList.contains('chord-block')) {
            clearTimeout(this.tooltipCloseTimer);
            this.hoveredChord = target.innerText.trim();
            const pos = this.tooltipPositionFromRect(target.getBoundingClientRect());
            this.tooltipPosition = { x: pos.x, y: pos.y };
            this.tooltipAbove = pos.above;
        }
        // אין else — הטולטיפ נשאר פתוח כשנעים בתוך אזור המילים
        // סגירה מתרחשת רק כשעוזבים את אזור המילים (handleLyricsLeave)
    }

    handleLyricsLeave() {
        if (this.pinnedChord) return;
        if (this.isMobileDevice()) return; // מובייל — סגירה רק מלחיצה/גלילה, לא מ-mouseleave מדומה
        clearTimeout(this.tooltipCloseTimer);
        this.tooltipCloseTimer = setTimeout(() => {
            if (!this.tooltipHovered) this.hoveredChord = null;
        }, 400);
    }

    /** נקרא כשהעכבר נכנס/יוצא מכפתור ההשמעה (שיש לו pointer-events: auto) */
    handlePlayBtnHover(hovered: boolean) {
        this.tooltipHovered = hovered;
        if (hovered) {
            clearTimeout(this.tooltipCloseTimer);
        } else if (!this.pinnedChord) {
            this.hoveredChord = null;
        }
    }

    // Mobile only: tap toggles hover tooltip (desktop pin is handled by onDocumentClick)
    handleLyricsClick(event: MouseEvent) {
        if (!this.isMobileDevice()) return;
        const target = event.target as HTMLElement;
        if (!target.classList.contains('chord-inline') && !target.classList.contains('chord-block')) return;
        const chord = target.innerText.trim();
        const pos = this.tooltipPositionFromRect(target.getBoundingClientRect());
        this.hoveredChord = this.hoveredChord === chord ? null : chord;
        this.tooltipPosition = { x: pos.x, y: pos.y };
        this.tooltipAbove = pos.above;
    }

    closePinnedTooltip() {
        this.pinnedChord = null;
    }

    // Check if user is on a touch/mobile device (pointer: coarse = no precise cursor)
    isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.matchMedia?.('(pointer: coarse)').matches ?? false);
    }

    // Show copy notification
    showCopyToast(): void {
        this.showCopyNotification = true;
        setTimeout(() => {
            this.showCopyNotification = false;
        }, 3000);
    }

    handleShare() {
        if (!this.song) return;

        const artistName = this.song.artists && this.song.artists.length > 0
            ? this.song.artists.map((a: any) => a.name).join(', ')
            : (this.song.artistName || '');

        const shareData = {
            title: `${this.song.title} - ${artistName}`,
            text: `${this.langService.translate('song.share_text_pre')} "${this.song.title}" ${this.langService.translate('song.share_text_mid')} ${artistName} ${this.langService.translate('song.share_text_suf')}`,
            url: window.location.href,
        };

        // If mobile - use native share dialog
        if (this.isMobileDevice() && navigator.share) {
            navigator.share(shareData).catch((err) => console.error('Share failed:', err));
        } else {
            // If desktop - copy link and show notification
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.showCopyToast();
            }).catch(() => {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = window.location.href;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.showCopyToast();
            });
        }
    }

    handlePrint() {
        if (!this.song) return;
        if (!this.hasFullSongContent) {
            this.openLoginForSong();
            return;
        }
        this.isPrintPanelOpen = true;
    }

    openLoginForSong(): void {
        this.authService.requestLogin(this.router.url);
    }

    closePrintPanel() {
        this.isPrintPanelOpen = false;
    }

    handleImageError(event: any) {
        event.target.src = '/logo.png';
    }
  toggleEasyMode(): void {
    if (!this.song?.easyKeyId || !this.song?.easyKeyName || !this.song?.originalKeyName) return;
    
    this.isEasyMode = !this.isEasyMode;
    
    if (this.isEasyMode) {
        // חישוב ההפרש בין הסולם המקורי לסולם הקל
        const originalIndex = this.getKeyIndex(this.song.originalKeyName);
        const easyIndex = this.getKeyIndex(this.song.easyKeyName);
        
        if (originalIndex !== -1 && easyIndex !== -1) {
            let diff = easyIndex - originalIndex;
            
            // נרמול לטווח -6 עד +6
            if (diff > 6) diff -= 12;
            if (diff < -6) diff += 12;
            
            this.transposeStep = diff;
        }
    } else {
        // חזרה לסולם המקורי
        this.transposeStep = 0;
    }
}

private getKeyIndex(keyName: string): number {
    // הסרת 'm' אם זה מינור, והסרת רווחים
    const baseKey = keyName.replace('m', '').trim();
    
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatKeys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    
    let index = keys.indexOf(baseKey);
    if (index === -1) {
        index = flatKeys.indexOf(baseKey);
    }
    
    return index;
}


    loadRating(songId: number): void {
        this.ratingAverage = 0;
        this.ratingCount = 0;
        this.userRating = null;

        this.songRatingService.getRating(songId).subscribe({
            next: (data) => {
                this.ratingAverage = data.averageRating;
                this.ratingCount = data.ratingCount;
                this.userRating = data.userRating ?? null;
            },
            error: () => { /* שקט — הדירוג לא קריטי */ }
        });
    }

    submitRating(rating: number): void {
        if (!this.authService.isLoggedIn) {
            this.authService.requestLogin(this.router.url);
            return;
        }
        if (!this.songId || this.isSubmittingRating) return;

        this.isSubmittingRating = true;
        this.songRatingService.rateSong(this.songId, rating).subscribe({
            next: (data) => {
                this.ratingAverage = data.averageRating;
                this.ratingCount = data.ratingCount;
                this.userRating = data.userRating ?? rating;
                this.isSubmittingRating = false;
            },
            error: () => {
                this.isSubmittingRating = false;
            }
        });
    }

    loadArtistSongs(): void {
        if (!this.song?.artists?.[0]?.id) return;
        
        this.isLoadingArtistSongs = true;
        const artistId = this.song.artists[0].id;
        
        this.songService.getSongsByArtist(artistId, 6).subscribe({
            next: (songs) => {
                this.artistSongs = songs;
                this.isLoadingArtistSongs = false;
            },
            error: () => {
                this.isLoadingArtistSongs = false;
            }
        });
    }

    loadPopularSongs(): void {
        this.isLoadingPopularSongs = true;
        
        this.songService.getPopularSongs(5).subscribe({
            next: (songs) => {
                this.popularSongs = songs;
                this.isLoadingPopularSongs = false;
            },
            error: () => {
                this.isLoadingPopularSongs = false;
            }
        });
    }

    loadMusicNews(): void {
        this.isLoadingMusicNews = true;
        this.showMusicNewsLink = false;
        this.musicNewsLoadedCount = 0;
        this.musicNewsArticles = [];
        this.allMusicNewsArticles = [];
        this.articleService.getArticles(1, 100, undefined, undefined, undefined, ArticleStatus.Published).subscribe({
            next: (response) => {
                this.allMusicNewsArticles = (response.items || [])
                    .filter(article => article.contentType == ArticleContentType.News);
                this.isLoadingMusicNews = false;
                this.expandMusicNews(5);
                this.startNewsObserver();
            },
            error: () => {
                this.allMusicNewsArticles = [];
                this.musicNewsArticles = [];
                this.isLoadingMusicNews = false;
            }
        });
    }

    private expandMusicNews(count: number): void {
        const next = this.musicNewsLoadedCount + count;
        const max = this.allMusicNewsArticles.length;
        if (next > max) {
            this.musicNewsArticles = [...this.allMusicNewsArticles];
            this.musicNewsLoadedCount = max;
            return;
        }
        this.musicNewsArticles = this.allMusicNewsArticles.slice(0, next);
        this.musicNewsLoadedCount = next;
    }

    private handleSentinelIntersect(): void {
        if (this.isLoadingMoreNews || this.showMusicNewsLink) return;
        if (this.musicNewsLoadedCount >= this.allMusicNewsArticles.length) {
            this.finishWithLink();
            return;
        }
        this.isLoadingMoreNews = true;
        this.expandMusicNews(1);
        this.isLoadingMoreNews = false;
        setTimeout(() => {
            if (this.newsExceedsRatingSection()) {
                this.trimOneCard();
                this.finishWithLink();
            } else {
                this.reobserveSentinel();
            }
        }, 150);
    }

    private finishWithLink(): void {
        this.stopNewsObserver();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => this.calcLinkHeight());
        });
    }

    private calcLinkHeight(): void {
        const rating = this.ratingSection?.nativeElement;
        const sentinel = this.newsSentinel?.nativeElement;
        if (!rating || !sentinel) {
            this.showMusicNewsLink = true;
            return;
        }
        const ratingBottom = rating.getBoundingClientRect().bottom;
        const sentinelBottom = sentinel.getBoundingClientRect().bottom;
        const cardPaddingBottom = 20;
        const listGap = 10;
        const gap = Math.floor(ratingBottom - sentinelBottom - listGap - cardPaddingBottom);

        const list = document.querySelector('.music-news-list') as HTMLElement;
        const firstCard = list?.querySelector('app-news-banner .news-banner') as HTMLElement;
        const maxHeight = firstCard ? firstCard.getBoundingClientRect().height : 160;

        this.musicNewsLinkHeight = Math.max(44, Math.min(gap, maxHeight));
        this.showMusicNewsLink = true;
    }

    private trimOneCard(): void {
        if (this.musicNewsArticles.length > 0) {
            this.musicNewsArticles = this.musicNewsArticles.slice(0, -1);
            this.musicNewsLoadedCount = this.musicNewsArticles.length;
        }
    }

    private newsExceedsRatingSection(): boolean {
        const rating = this.ratingSection?.nativeElement;
        const sentinel = this.newsSentinel?.nativeElement;
        if (!rating || !sentinel) return false;
        return sentinel.getBoundingClientRect().bottom >= rating.getBoundingClientRect().bottom;
    }

    private startNewsObserver(): void {
        this.stopNewsObserver();
        if (typeof IntersectionObserver === 'undefined') return;
        this.newsObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                this.ngZone.run(() => this.handleSentinelIntersect());
            }
        }, { rootMargin: '50px' });
        setTimeout(() => this.observeSentinel(), 100);
    }

    private observeSentinel(): void {
        if (this.newsObserver && this.newsSentinel?.nativeElement) {
            this.newsObserver.observe(this.newsSentinel.nativeElement);
        }
    }

    private reobserveSentinel(): void {
        if (this.newsObserver && this.newsSentinel?.nativeElement) {
            this.newsObserver.unobserve(this.newsSentinel.nativeElement);
            this.newsObserver.observe(this.newsSentinel.nativeElement);
        }
    }

    private stopNewsObserver(): void {
        if (this.newsObserver) {
            this.newsObserver.disconnect();
            this.newsObserver = null;
        }
    }

    ngAfterViewInit(): void {
        // Sentinel is observed via timeout in startNewsObserver after data arrives
    }

    loadSimilarSongs(): void {
        this.isLoadingSimilarSongs = true;
        const genreId = this.song?.genres?.[0]?.id;
        const artistId = this.song?.artists?.[0]?.id;

        if (genreId) {
            this.songService.getSongs(undefined, 1, 6, undefined, genreId, undefined, 'views').subscribe({
                next: (response) => {
                    if (this.setSimilarSongs(response?.songs || [])) {
                        this.isLoadingSimilarSongs = false;
                        return;
                    }
                    this.loadSimilarSongsByArtistOrPopular(artistId);
                },
                error: () => this.loadSimilarSongsByArtistOrPopular(artistId)
            });
            return;
        }

        this.loadSimilarSongsByArtistOrPopular(artistId);
    }

    private loadSimilarSongsByArtistOrPopular(artistId?: number): void {
        if (artistId) {
            this.songService.getSongsByArtist(artistId, 6).subscribe({
                next: (songs) => {
                    if (this.setSimilarSongs(songs)) {
                        this.isLoadingSimilarSongs = false;
                        return;
                    }
                    this.loadSimilarSongsPopularFallback();
                },
                error: () => this.loadSimilarSongsPopularFallback()
            });
            return;
        }

        this.loadSimilarSongsPopularFallback();
    }

    private loadSimilarSongsPopularFallback(): void {
        this.songService.getPopularSongs(6).subscribe({
            next: (songs) => {
                this.setSimilarSongs(songs);
                this.isLoadingSimilarSongs = false;
            },
            error: () => {
                this.similarSongs = [];
                this.isLoadingSimilarSongs = false;
            }
        });
    }

    private setSimilarSongs(songs: any[]): boolean {
        const uniqueSongs = (songs || [])
            .filter((song) => song?.id && song.id !== this.songId)
            .filter((song, index, self) => self.findIndex((item) => item.id === song.id) === index)
            .slice(0, 5);

        this.similarSongs = uniqueSongs;
        return uniqueSongs.length > 0;
    }

    loadPlaylistNav(playlistId: number): void {
        this.playlistService.getPlaylistById(playlistId).subscribe({
            next: (playlist: PlaylistDetail) => {
                this.playlistNavData = {
                    name: playlist.name,
                    songs: (playlist.songs || [])
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map(s => ({ songId: s.songId, songTitle: s.songTitle }))
                };
            },
            error: () => { this.playlistNavData = null; }
        });
    }

    dismissPlaylistNav(): void {
        this.playlistNavDismissed = true;
    }

    navigateToPlaylistSong(songId: number): void {
        this.router.navigate(['/song', songId], {
            queryParams: { playlistId: this.currentNavPlaylistId }
        });
    }

    get playlistNavVisible(): boolean {
        return !!this.playlistNavData && !this.playlistNavDismissed;
    }

    get currentSongIndexInPlaylist(): number {
        if (!this.playlistNavData || !this.songId) return -1;
        return this.playlistNavData.songs.findIndex(s => s.songId === this.songId);
    }

    get prevPlaylistSong(): { songId: number; songTitle: string } | null {
        const idx = this.currentSongIndexInPlaylist;
        if (idx <= 0) return null;
        return this.playlistNavData!.songs[idx - 1];
    }

    get nextPlaylistSong(): { songId: number; songTitle: string } | null {
        const idx = this.currentSongIndexInPlaylist;
        if (!this.playlistNavData || idx < 0 || idx >= this.playlistNavData.songs.length - 1) return null;
        return this.playlistNavData.songs[idx + 1];
    }

    navigateToSong(id: number): void {
        if (id === this.songId) return; // כבר בשיר הזה
        this.router.navigate(['/song', id]);
    }

    navigateToArtist(artist: { id?: number; name?: string } | undefined): void {
        if (artist?.id) {
            this.router.navigate(artistRoute({ id: artist.id, name: artist.name }));
        }
    }

    togglePlaylistPopup(): void {
        if (!this.authService.isLoggedIn) {
            this.authService.requestLogin(this.router.url);
            return;
        }

        if (this.isPlaylistPopupOpen) {
            this.isPlaylistPopupOpen = false;
            this.shouldAutoSaveOnPopupOpen = false;
            return;
        }

        this.shouldAutoSaveOnPopupOpen = !this.isSongSaved;
        this.isPlaylistPopupOpen = true;
    }

    closePlaylistPopup(): void {
        this.isPlaylistPopupOpen = false;
        this.shouldAutoSaveOnPopupOpen = false;
    }

    openReportModal(): void {
        this.isReportModalOpen = true;
    }

    closeReportModal(): void {
        this.isReportModalOpen = false;
    }

    openYoutubeVideo(): void {
        if (!this.song?.youtubeUrl) return;
        const videoId = this.extractYoutubeVideoId(this.song.youtubeUrl);
        if (videoId) {
            const url = `https://www.youtube.com/embed/${videoId}?rel=0`;
            this.youtubeEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
            this.showYoutubeModal = true;
        } else {
            // URL לא מוכר — פתח ביוטיוב ישירות
            window.open(this.song.youtubeUrl, '_blank');
        }
    }

    closeYoutubeVideo(): void {
        this.showYoutubeModal = false;
        this.youtubeEmbedUrl = null;
    }

    private extractYoutubeVideoId(url: string): string | null {
        // מטפל בפורמטים: watch?v=, youtu.be/, embed/, shorts/, m.youtube.com
        const match = url.match(
            /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        return match ? match[1] : null;
    }

    onSongSaved(): void {
        this.loadSongSavedState();
    }
}
