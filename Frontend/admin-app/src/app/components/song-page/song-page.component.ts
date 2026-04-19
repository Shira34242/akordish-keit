import { Component, OnInit, OnDestroy, AfterViewChecked, HostListener, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SongService } from '../../services/song.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { AddSongModalComponent } from '../add-song-modal/add-song-modal.component';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';

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
import { PlaylistService } from '../../services/playlist.service';

@Component({
    selector: 'app-song-page',
    standalone: true,
    imports: [CommonModule, ChordTooltipComponent, AddSongModalComponent, PlaylistPopupComponent, ReportModalComponent, ContentUploaderBadgeComponent, PrintPanelComponent],
    templateUrl: './song-page.component.html',
    styleUrls: ['./song-page.component.css']
})
export class SongPageComponent implements OnInit, OnDestroy, AfterViewChecked {

    @ViewChild('songHeaderBg') songHeaderBg?: ElementRef<HTMLDivElement>;
    @ViewChild('songHeaderContent') songHeaderContent?: ElementRef<HTMLDivElement>;
    private headerLayoutDone = false;
    private fullHeaderHeight = 0;
    private rafPending = false;

    songId: number | null = null;
    song: any = null;
    isLoading: boolean = false;
    error: string | null = null;
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
    artistSongs: any[] = [];
    popularSongs: any[] = [];
    isLoadingArtistSongs: boolean = false;
    isLoadingPopularSongs: boolean = false;

    // Auto Scroll State
    private scrollInterval: any = null;

    constructor(
        private route: ActivatedRoute,
        private songService: SongService,
        private sanitizer: DomSanitizer,
        private authService: AuthService,
        private router: Router,
        private ngZone: NgZone,
        private playlistService: PlaylistService,
    ) { }

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            const id = params['id'];
            if (id) {
                this.songId = +id;
                this.loadSong(this.songId);
            }
        });

        // Native listener — guaranteed to fire in DOM bubble order, independent of Angular zone
        this.ngZone.runOutsideAngular(() => {
            document.addEventListener('click', this.nativeDocumentClick);
        });

        // חסימת העתקה וקליק ימני בדף השיר
        document.addEventListener('copy', this.preventCopy);
        document.addEventListener('contextmenu', this.preventContextMenu);
        document.addEventListener('selectstart', this.preventSelect);
    }

    ngOnDestroy() {
        document.removeEventListener('click', this.nativeDocumentClick);
        document.removeEventListener('copy', this.preventCopy);
        document.removeEventListener('contextmenu', this.preventContextMenu);
        document.removeEventListener('selectstart', this.preventSelect);
        this.stopAutoScroll();
        this.isAutoScroll = false;
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

    loadSong(id: number) {
        window.scrollTo(0, 0);
        this.headerLayoutDone = false;
        this.isLoading = true;
        this.error = null;
        this.canEdit = false; 
        this.isEasyMode = false;

        this.songService.getSongById(id).subscribe({
            next: (data) => {
                this.song = data;
                this.isLoading = false;

                this.preferFlat = analyzePreferFlat(
                    this.song.lyricsWithChords,
                    this.song.originalKeyName
                );

                this.transposeStep = 0;
                this.fontSize = window.innerWidth <= 600 ? 14 : 18;
                this.isSongSaved = false;
                this.shouldAutoSaveOnPopupOpen = false;
                this.stopAutoScroll();
                this.isAutoScroll = false;
                this.checkEditPermission(id);
                this.loadArtistSongs();
                this.loadPopularSongs();
                this.loadSongSavedState();

                // Increment view count with unique tracking
                this.songService.incrementView(id).subscribe({
                    next: (response) => {
                        // Update the view count in the UI
                        if (this.song && response.viewCount) {
                            this.song.viewCount = response.viewCount;
                        }
                    },
                    error: (err) => {
                        console.error('Error incrementing view count:', err);
                    }
                });

            },
            error: (err) => {
                console.error('Error loading song:', err);
                this.error = 'שגיאה בטעינת השיר';
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

    @HostListener('window:scroll')
    onWindowScroll() {
        this.isToolbarSticky = window.scrollY > 300;
        if (!this.rafPending) {
            this.rafPending = true;
            requestAnimationFrame(() => {
                this.shrinkHeader();
                this.rafPending = false;
            });
        }
        // On mobile, scroll closes the open tooltip
        if (this.isMobileDevice()) this.hoveredChord = null;
    }


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
        console.log('Font size changed to', this.fontSize);
    }


    selectInstrument(instrument: 'guitar' | 'piano' | 'ukulele' | 'lyrics') {
        this.selectedInstrument = instrument;
        this.showChords = instrument !== 'lyrics';
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
        return result;
    }

    toggleInlineChordDiagrams() {
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
        if (!this.song || !this.song.lyricsWithChords) return '';

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
        return this.sanitizer.bypassSecurityTrustHtml(processedLines.join('\n'));
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
            text: `בדוק את השיר "${this.song.title}" של ${artistName} באתר אקורדישקייט!`,
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
        this.isPrintPanelOpen = true;
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

    navigateToSong(id: number): void {
        if (id === this.songId) return; // כבר בשיר הזה
        this.router.navigate(['/song', id]);
    }

    navigateToArtist(id: number | undefined): void {
        if (id) {
            this.router.navigate(['/artist', id]);
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
