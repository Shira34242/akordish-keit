import { Component, OnInit, OnDestroy, AfterViewChecked, HostListener, Input, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
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
    isChordLine
} from '../../utils/music-utils';

import { ChordTooltipComponent } from '../chord-tooltip/chord-tooltip.component';
import { PlaylistPopupComponent } from '../playlist-popup/playlist-popup.component';
import { ReportModalComponent } from '../shared/report-modal/report-modal.component';
import { ContentUploaderBadgeComponent } from '../shared/content-uploader-badge/content-uploader-badge.component';

@Component({
    selector: 'app-song-page',
    standalone: true,
    imports: [CommonModule, ChordTooltipComponent, AddSongModalComponent, PlaylistPopupComponent, ReportModalComponent, ContentUploaderBadgeComponent],
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
    selectedInstrument: 'guitar' | 'piano' | 'lyrics' = 'guitar';
    isDarkMode: boolean = false;
    isToolbarSticky: boolean = false;
    preferFlat: boolean = false;
    isEasyMode: boolean = false;

    // Tooltip State
    hoveredChord: string | null = null;
    tooltipPosition: { x: number, y: number } = { x: 0, y: 0 };
    tooltipAbove: boolean = true;

    // Pinned Tooltip State (desktop only)
    pinnedChord: string | null = null;
    pinnedPosition: { x: number, y: number } = { x: 0, y: 0 };
    pinnedAbove: boolean = true;

    // YouTube Modal State
    showYoutubeModal: boolean = false;
    youtubeEmbedUrl: SafeResourceUrl | null = null;

    // Bookmark State
    isSongSaved: boolean = false;

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
    ) { }

   ngOnInit(): void {
        this.route.params.subscribe(params => {
            const id = params['id'];
            if (id) {
                this.songId = +id; 
                this.loadSong(this.songId);
            }
        });
    }

    ngOnDestroy() {
        this.stopAutoScroll();
        this.isAutoScroll = false;
    }

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
                this.stopAutoScroll();
                this.isAutoScroll = false;
                this.checkEditPermission(id);
                this.loadArtistSongs();
                this.loadPopularSongs();

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

    /**
     * Central click handler at document level.
     * Checks the click target directly — no stopPropagation needed.
     */
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;

        // Click on a chord element → pin it (desktop only)
        if (target.classList.contains('chord-inline') || target.classList.contains('chord-block')) {
            if (!this.isMobileDevice()) {
                const chord = target.innerText.trim();
                const pos = this.tooltipPositionFromRect(target.getBoundingClientRect());
                this.hoveredChord = null;
                this.pinnedChord = chord;
                this.pinnedPosition = { x: pos.x, y: pos.y };
                this.pinnedAbove = pos.above;
            }
            return;
        }

        // Any other click → close pin
        if (this.pinnedChord) this.pinnedChord = null;
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
        const tooltipW = 150;
        const tooltipH = 180;
        let x = rect.left + rect.width / 2;
        x = Math.max(tooltipW / 2 + 8, Math.min(window.innerWidth - tooltipW / 2 - 8, x));
        const above = rect.top > tooltipH + 16;
        const y = above ? rect.top - 8 : rect.bottom + 8;
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
        this.transposeStep += direction;
    }

    resetTranspose() {
        this.transposeStep = 0;
    }

    changeFontSize(delta: number): void {
        // עדכן את הגודל לפני הלוג – כך שה‑console יציג את הערך החדש
        this.fontSize = Math.max(10, Math.min(32, this.fontSize + delta));
        console.log('Font size changed to', this.fontSize);
    }


    selectInstrument(instrument: 'guitar' | 'piano' | 'lyrics') {
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
        if (this.pinnedChord) return; // hover suppressed while pinned
        const target = event.target as HTMLElement;
        if (target.classList.contains('chord-inline') || target.classList.contains('chord-block')) {
            this.hoveredChord = target.innerText.trim();
            const pos = this.tooltipPositionFromRect(target.getBoundingClientRect());
            this.tooltipPosition = { x: pos.x, y: pos.y };
            this.tooltipAbove = pos.above;
        } else {
            this.hoveredChord = null;
        }
    }

    handleLyricsLeave() {
        if (this.pinnedChord) return; // don't close while pinned
        this.hoveredChord = null;
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

        const artistName = this.song.artists && this.song.artists.length > 0
            ? this.song.artists.map((a: any) => a.name).join(', ')
            : (this.song.artistName || '');

        const originalKey = this.song.originalKeyName || '';

        // Process lyrics for print
        const lines = this.song.lyricsWithChords.split('\n');
        const processedLyrics = lines.map((line: string) => {
            // Block Chords
            if (isChordLine(line)) {
                return line.replace(/\S+/g, (token) =>
                    isChord(token) ? `<span class="chord">${token}</span>` : token
                );
            }

            // Inline Chords [Am] — only real chords; [Verse] etc. pass through
            return line.replace(/\[(.*?)\]/g, (match, chord) =>
                isChord(chord) ? `<span class="chord">${chord}</span>` : match
            );
        }).join('\n');

        const printContent = `
      <html dir="rtl">
        <head>
          <title>${this.song.title} - ${artistName}</title>
          <style>
            body { font-family: 'Heebo', Arial, sans-serif; margin: 20px; direction: rtl; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .artist { font-size: 18px; color: #666; }
            .key { font-size: 14px; color: #888; }
            .lyrics { white-space: pre-wrap; font-family: 'Heebo', sans-serif; font-size: 14px; line-height: 2.2; }
            .chord { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-weight: bold; color: #0066cc; margin: 0 2px; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #ccc; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${this.song.title}</div>
            <div class="artist">${artistName}</div>
            ${originalKey ? `<div class="key">סולם: ${originalKey}</div>` : ''}
          </div>
          <div class="lyrics">${processedLyrics}</div>
          <div class="footer">
            מודפס מאתר אקורדישקייט - ${window.location.origin}
          </div>
        </body>
      </html>
    `;

        const printWindow = window.open('', '', 'height=600,width=800');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    }

    handleImageError(event: any) {
        event.target.src = 'public/logo.png';
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
        this.isPlaylistPopupOpen = !this.isPlaylistPopupOpen;
    }

    closePlaylistPopup(): void {
        this.isPlaylistPopupOpen = false;
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
        this.isSongSaved = true;
        this.isPlaylistPopupOpen = false;
    }
}