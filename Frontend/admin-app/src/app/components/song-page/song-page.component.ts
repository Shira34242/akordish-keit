import { Component, OnInit, OnDestroy, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SongService } from '../../services/song.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AddSongModalComponent } from '../add-song-modal/add-song-modal.component';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';

import {
    transposeChord,
    analyzePreferFlat,
    isChord
} from '../../utils/music-utils';

import { ChordTooltipComponent } from '../chord-tooltip/chord-tooltip.component';
import { PlaylistPopupComponent } from '../playlist-popup/playlist-popup.component';
import { ReportModalComponent } from '../shared/report-modal/report-modal.component';

@Component({
    selector: 'app-song-page',
    standalone: true,
    imports: [CommonModule, ChordTooltipComponent, AddSongModalComponent, PlaylistPopupComponent, ReportModalComponent],
    templateUrl: './song-page.component.html',
    styleUrls: ['./song-page.component.css']
})
export class SongPageComponent implements OnInit, OnDestroy {

    songId: number | null = null;
    song: any = null;
    isLoading: boolean = false;
    error: string | null = null;
    isPlaylistPopupOpen: boolean = false;
    isReportModalOpen: boolean = false;

    // Toolbar State
    transposeStep: number = 0;
    fontSize: number = 18;
    isAutoScroll: boolean = false;
    scrollSpeed: number = 1;
    showChords: boolean = true;
    selectedInstrument: 'guitar' | 'piano' = 'guitar';
    isDarkMode: boolean = false;
    isToolbarSticky: boolean = false;
    preferFlat: boolean = false;
    isEasyMode: boolean = false;

    // Tooltip State
    hoveredChord: string | null = null;
    tooltipPosition: { x: number, y: number } = { x: 0, y: 0 };

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
                this.fontSize = 18;
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

    @HostListener('window:scroll')
    onWindowScroll() {
        this.isToolbarSticky = window.scrollY > 300;
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


    toggleChords() {
        this.showChords = !this.showChords;
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
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
                this.stopAutoScroll();
            }
        }, 50);
    }

    stopAutoScroll() {
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
    }

   get currentKey(): string {
    if (!this.song || !this.song.originalKeyName) return '';

    const originalKey = this.song.originalKeyName;
    if (this.transposeStep === 0) return originalKey;

    return transposeChord(originalKey, this.transposeStep, { preferFlat: this.preferFlat });
}


    // Get transpose display value in tones (half-steps / 2)
    get transposeDisplay(): string {
        if (this.transposeStep === 0) return '0';

        const tones = this.transposeStep / 2;
        const sign = this.transposeStep > 0 ? '+' : '';

        // Format: +0.5, +1, +1.5, etc.
        return `${sign}${tones}`;
    }

    // Helper to check if a line is purely chords
    isChordLine(line: string): boolean {
        if (!line.trim()) return false;
        // If it contains Hebrew, it's definitely not a chord line
        if (/[א-ת]/.test(line)) return false;

        const tokens = line.trim().split(/\s+/);
        // Filter tokens that look like chords
        const chordCount = tokens.filter(t => isChord(t) || this.looksLikeChord(t)).length;

        // If more than 50% of tokens are chords, treat as chord line.
        return chordCount > 0 && (chordCount / tokens.length >= 0.5);
    }

    looksLikeChord(token: string): boolean {
        // Basic regex for things that look like chords but might not pass strict validation
        // e.g. A, Am, F#m7, G/B
        return /^[A-G][b#]?(m|maj|dim|aug|sus|add|7|9|11|13)*(\/[A-G][b#]?)?$/.test(token);
    }

    // ⭐ הלוגיקה החדשה - תמיכה גם ב-Inline וגם ב-Block (Line over Line)
    get formattedLyricsHtml(): SafeHtml {
        if (!this.song || !this.song.lyricsWithChords) return '';

        const lines = this.song.lyricsWithChords.split('\n');

        const processedLines = lines.map((line: string) => {
            // 1. Check for Line-over-Line Chords (Block Chords)
            if (this.isChordLine(line)) {
                if (!this.showChords) return null; // Hide line if chords are hidden

                // Wrap chords in span with class 'chord-block'
                // We use a regex to identify chords and wrap them, while preserving spaces.
                // Regex matches chord patterns.
                return line.replace(/([A-G][b#]?(?:m|maj|dim|aug|sus|add|7|9|11|13)*(?:\/[A-G][b#]?)?)/g, (match) => {
                    const transposed = this.transposeStep !== 0
                        ? transposeChord(match, this.transposeStep, { preferFlat: this.preferFlat })
                        : match;
                    return `<span class="chord-block">${transposed}</span>`;
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

            // Inline Chords [Am]
            if (this.showChords) {
                processed = processed.replace(/\[(.*?)\]/g, (match, chord) => {
                    const transposed = this.transposeStep !== 0
                        ? transposeChord(chord, this.transposeStep, { preferFlat: this.preferFlat })
                        : chord;
                    return `<span class="chord-inline">${transposed}</span>`;
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
        const target = event.target as HTMLElement;
        if (target.classList.contains('chord-inline') || target.classList.contains('chord-block')) {
            this.hoveredChord = target.innerText.trim();
            const rect = target.getBoundingClientRect();
            // Position tooltip centered above the chord
            // We'll use fixed positioning in CSS, so x/y are viewport coordinates
            this.tooltipPosition = {
                x: rect.left + rect.width / 2,
                y: rect.top
            };
        } else {
            this.hoveredChord = null;
        }
    }

    handleLyricsLeave() {
        this.hoveredChord = null;
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

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            navigator.share(shareData).catch((err) => console.error('Share failed:', err));
        } else {
            navigator.clipboard.writeText(window.location.href).then(() => {
                alert("הקישור הועתק ללוח!");
            }).catch(() => {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = window.location.href;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert("הקישור הועתק ללוח!");
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
            if (this.isChordLine(line)) {
                return line.replace(/([A-G][b#]?(?:m|maj|dim|aug|sus|add|7|9|11|13)*(?:\/[A-G][b#]?)?)/g,
                    '<span class="chord">$1</span>');
            }

            // Inline Chords [Am]
            return line.replace(/\[(.*?)\]/g, '<span class="chord">$1</span>');
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
}