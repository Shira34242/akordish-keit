import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SongService } from '../../../services/song.service';
import { PlaylistDetail } from '../../../models/playlist.model';
import { isChord, isChordLine } from '../../../utils/music-utils';

type ColumnMode = 'auto' | 1 | 2 | 3;

@Component({
    selector: 'app-chord-book-panel',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './chord-book-panel.component.html',
    styleUrls: ['./chord-book-panel.component.css']
})
export class ChordBookPanelComponent implements OnInit {
    @Input() playlist!: PlaylistDetail;
    @Output() close = new EventEmitter<void>();

    columnMode: ColumnMode = 'auto';
    fontSize: number = 16;
    chordColor: string = '#ddff53';
    lyricsColor: string = '#000000';
    showChords: boolean = true;

    previewSongIndex = 0;
    previewSongData: any = null;
    isLoadingPreview = false;

    zoomedPage: 'cover' | 'index' | 'song' | null = null;

    isExporting: boolean = false;
    progressText: string = '';
    progressPercent: number = 0;

    private static readonly BRAND_TEXT =
        'הורד מאתר אקורדישקייט · המאגר הגדול והיחיד מסוגו לאקורדים במוזיקה היהודית';

    readonly PAGE_W = 640;
    readonly PAGE_FULL_H = Math.round(640 * 297 / 210); // ≈ 906
    readonly BRAND_BAR_H = 20;

    constructor(private songService: SongService, private sanitizer: DomSanitizer) {}

    ngOnInit(): void {
        this.loadPreviewSong(0);
    }

    onBackdropClick(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains('chord-book-backdrop')) this.close.emit();
    }

    get lineHeightCss(): number { return this.fontSize * 2; }

    get pageClipH(): number {
        const avail = this.PAGE_FULL_H - 2 * this.BRAND_BAR_H;
        return Math.floor(avail / this.lineHeightCss) * this.lineHeightCss;
    }

    get songCount(): number { return this.playlist?.songs?.length ?? 0; }

    loadPreviewSong(index: number): void {
        if (!this.playlist?.songs?.length) return;
        const safeIdx = Math.max(0, Math.min(index, this.playlist.songs.length - 1));
        this.previewSongIndex = safeIdx;
        const target = this.playlist.songs[safeIdx];
        this.isLoadingPreview = true;
        this.songService.getSongById(target.songId).subscribe({
            next: (song) => {
                this.previewSongData = song;
                this.isLoadingPreview = false;
            },
            error: () => {
                this.previewSongData = null;
                this.isLoadingPreview = false;
            }
        });
    }

    nextPreviewSong(): void {
        if (this.previewSongIndex < this.songCount - 1) this.loadPreviewSong(this.previewSongIndex + 1);
    }
    prevPreviewSong(): void {
        if (this.previewSongIndex > 0) this.loadPreviewSong(this.previewSongIndex - 1);
    }

    openZoom(page: 'cover' | 'index' | 'song'): void { this.zoomedPage = page; }
    closeZoom(): void { this.zoomedPage = null; }
    onZoomBackdropClick(e: MouseEvent): void {
        if ((e.target as HTMLElement).classList.contains('zoom-backdrop')) this.closeZoom();
    }

    private chooseColumnsForSong(song: any): 1 | 2 | 3 {
        const lyrics: string = song?.lyricsWithChords || '';
        const totalLines = lyrics ? lyrics.split('\n').length : 0;
        const lineH = this.fontSize * 2;
        const approxHeaderH = 130;
        const avail = this.pageClipH - approxHeaderH;
        if (avail <= 0) return 1;
        for (let cols = 1; cols <= 3; cols++) {
            const colHeight = Math.ceil(totalLines / cols) * lineH;
            if (colHeight <= avail) return cols as 1 | 2 | 3;
        }
        return 3;
    }

    columnsForSong(song: any): 1 | 2 | 3 {
        if (this.columnMode === 'auto') return this.chooseColumnsForSong(song);
        return this.columnMode;
    }

    get previewSongPageHtml(): SafeHtml {
        const song = this.previewSongData;
        if (!song) return this.sanitizer.bypassSecurityTrustHtml('');
        const cols = this.columnsForSong(song);
        const html = this.buildSongInnerHtml(song, cols);
        return this.sanitizer.bypassSecurityTrustHtml(html);
    }

    get previewCoverPageHtml(): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(this.buildCoverInnerHtml());
    }

    get previewIndexPageHtml(): SafeHtml {
        const entries = this.playlist.songs.slice(0, 12).map((s, i) => ({
            title: s.songTitle, artist: s.artistName, page: 3 + i
        }));
        return this.sanitizer.bypassSecurityTrustHtml(this.buildIndexInnerHtml(entries));
    }

    private escapeHtml(s: string): string {
        return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ===== בניית HTML מילים =====

    private buildLyricsHtml(song: any): string {
        if (!song?.lyricsWithChords) return '';
        const lines = song.lyricsWithChords.split('\n');
        const out = lines.map((line: string) => {
            if (isChordLine(line)) {
                if (!this.showChords) return null;
                return line.replace(/\S+/g, tok => {
                    if (!isChord(tok)) return tok;
                    return `<span style="color:${this.chordColor};font-weight:700">${tok}</span>`;
                });
            }
            let p = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (this.showChords) {
                p = p.replace(/\[(.*?)\]/g, (m: string, chord: string) => {
                    if (!isChord(chord)) return m;
                    return `<span style="color:${this.chordColor};font-weight:700">${chord}</span>`;
                });
            } else {
                p = p.replace(/\[(.*?)\]/g, '');
            }
            return `<span style="color:${this.lyricsColor}">${p}</span>`;
        }).filter((l: any) => l !== null);
        return out.join('\n');
    }

    // ===== בניית HTML פנימי של שיר (משותף לייצוא ולתצוגה מקדימה) =====

    private buildSongInnerHtml(song: any, cols: 1 | 2 | 3): string {
        const lyricsHtml = this.buildLyricsHtml(song);
        const colCss = cols > 1
            ? `column-count:${cols};column-gap:24px;column-fill:balance;`
            : '';
        const artistName = song?.artists?.map((a: any) => a.name).join(', ') || '';
        const keyName = song?.originalKeyName || '';
        const genreHtml = (song?.genres || []).map((g: any) =>
            `<span style="display:inline-block;background:#F2F2F2;border-radius:999px;padding:1px 8px;font-size:9px;font-weight:300;margin:1px 2px;color:#404040">${this.escapeHtml(g.name || '')}</span>`
        ).join('');
        const composerParts: string[] = [];
        if (song?.composer?.name) composerParts.push('לחן: ' + song.composer.name);
        if (song?.lyricist?.name) composerParts.push('מילים: ' + song.lyricist.name);
        const composerHtml = composerParts.length
            ? `<div style="font-size:9px;font-weight:300;color:#888;margin-top:3px">${this.escapeHtml(composerParts.join(' | '))}</div>`
            : '';
        const imageHtml = song?.imageUrl
            ? `<img src="${song.imageUrl}" crossorigin="anonymous" style="width:80px;height:80px;object-fit:cover;border-radius:12px;flex-shrink:0;display:block" alt="">`
            : '';

        return `
<div class="pdf-header" style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e8e8e8">
  ${imageHtml}
  <div style="flex:1;text-align:right">
    <div style="font-size:17px;font-weight:800;line-height:1.2;margin-bottom:3px">${this.escapeHtml(song?.title || '')}</div>
    <div style="font-size:12px;font-weight:300;color:#404040;margin-bottom:3px">${this.escapeHtml(artistName)}</div>
    ${keyName ? `<div style="font-size:10px;color:#888;margin-bottom:4px">סולם: ${this.escapeHtml(keyName)}</div>` : ''}
    <div style="margin-top:2px">${genreHtml}</div>
    ${composerHtml}
  </div>
</div>
<div class="pdf-lyrics" style="white-space:pre-wrap;font-size:${this.fontSize}px;line-height:2;color:${this.lyricsColor};${colCss}">${lyricsHtml}</div>`;
    }

    private buildSongContainer(song: any, cols?: 1 | 2 | 3): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = [
            'position:fixed', 'top:0', 'left:-99999px',
            `width:${this.PAGE_W}px`,
            'background:#fff',
            'direction:rtl',
            'font-family:"Open Sans",Arial,sans-serif',
            'font-weight:300',
            `font-size:${this.fontSize}px`,
            'line-height:2',
            'padding:20px 24px',
            'box-sizing:border-box',
            'pointer-events:none',
            'z-index:-1'
        ].join(';');
        const finalCols = cols ?? this.columnsForSong(song);
        container.innerHTML = this.buildSongInnerHtml(song, finalCols);
        return container;
    }

    // ===== עמוד כריכה =====

    private buildCoverInnerHtml(): string {
        return `
<div style="color:#ddff53;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;margin-bottom:40px;opacity:0.7">ספר אקורדים</div>
<div style="color:#ffffff;font-size:38px;font-weight:800;line-height:1.25;margin-bottom:20px;max-width:480px">${this.escapeHtml(this.playlist.name)}</div>
<div style="color:#555;font-size:13px;font-weight:300;margin-bottom:56px">${this.songCount} שירים</div>
<div style="width:48px;height:3px;background:#ddff53;border-radius:999px;margin-bottom:56px"></div>
<div style="color:#ddff53;font-size:17px;font-weight:800;letter-spacing:.06em">אקורדישקייט</div>
<div style="color:#404040;font-size:11px;font-weight:300;margin-top:10px">המאגר הגדול והיחיד מסוגו לאקורדים במוזיקה היהודית</div>`;
    }

    private buildCoverContainer(): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = [
            'position:fixed', 'top:0', 'left:-99999px',
            `width:${this.PAGE_W}px`,
            `height:${this.PAGE_FULL_H}px`,
            'background:#000',
            'direction:rtl',
            'font-family:"Open Sans",Arial,sans-serif',
            'box-sizing:border-box',
            'pointer-events:none',
            'z-index:-1',
            'display:flex',
            'flex-direction:column',
            'align-items:center',
            'justify-content:center',
            'padding:60px 48px',
            'text-align:center'
        ].join(';');
        container.innerHTML = this.buildCoverInnerHtml();
        return container;
    }

    // ===== עמוד תוכן עניינים =====

    private buildIndexInnerHtml(entries: { title: string; artist: string; page: number }[]): string {
        const rows = entries.map((e, i) => `
<div style="display:flex;align-items:center;padding:9px 0;border-bottom:1px solid #F2F2F2;gap:12px">
  <span style="font-weight:800;font-size:10px;color:#aaa;min-width:22px;text-align:center;flex-shrink:0">${i + 1}</span>
  <div style="flex:1;min-width:0;text-align:right">
    <div style="font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.escapeHtml(e.title)}</div>
    <div style="font-weight:300;font-size:10px;color:#404040">${this.escapeHtml(e.artist)}</div>
  </div>
  <span style="font-weight:800;font-size:11px;background:#ddff53;border-radius:999px;padding:2px 10px;flex-shrink:0;direction:ltr">${e.page}</span>
</div>`).join('');

        return `
<div style="font-size:22px;font-weight:800;margin-bottom:4px">תוכן עניינים</div>
<div style="font-size:11px;font-weight:300;color:#888;margin-bottom:22px">${this.escapeHtml(this.playlist.name)}</div>
${rows}`;
    }

    private buildIndexContainer(entries: { title: string; artist: string; page: number }[]): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = [
            'position:fixed', 'top:0', 'left:-99999px',
            `width:${this.PAGE_W}px`,
            'background:#fff',
            'direction:rtl',
            'font-family:"Open Sans",Arial,sans-serif',
            'font-weight:300',
            'font-size:13px',
            'padding:28px 32px',
            'box-sizing:border-box',
            'pointer-events:none',
            'z-index:-1'
        ].join(';');
        container.innerHTML = this.buildIndexInnerHtml(entries);
        return container;
    }

    // ===== צילום וחיתוך =====

    private async captureAndSlice(container: HTMLElement, scale: number): Promise<string[]> {
        const html2canvas = (await import('html2canvas')).default;
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 200));
        const headerEl = container.querySelector('.pdf-header') as HTMLElement;
        const paddingPx = 20;
        const captureH = container.scrollHeight;
        container.style.height = captureH + 'px';
        const canvas = await html2canvas(container, {
            scale, useCORS: true, backgroundColor: '#ffffff', logging: false,
            width: this.PAGE_W, height: captureH
        });
        const lineHCanvas = this.fontSize * 2 * scale;
        const headerHCanvas = (paddingPx + (headerEl?.offsetHeight ?? 0)) * scale;
        const nominalPagePx = this.pageClipH * scale;
        const boundaries: number[] = [0];
        let nominal = nominalPagePx;
        while (nominal < canvas.height) {
            let snap = nominal;
            if (nominal > headerHCanvas) {
                const linesIn = Math.floor((nominal - headerHCanvas) / lineHCanvas);
                snap = headerHCanvas + linesIn * lineHCanvas;
                const prev = boundaries[boundaries.length - 1];
                if (snap <= prev) snap = prev + lineHCanvas;
            }
            snap = Math.min(Math.round(snap), canvas.height);
            if (snap > boundaries[boundaries.length - 1]) boundaries.push(snap);
            nominal += nominalPagePx;
        }
        if (boundaries[boundaries.length - 1] < canvas.height) boundaries.push(canvas.height);
        const images: string[] = [];
        for (let i = 0; i < boundaries.length - 1; i++) {
            const sliceStart = boundaries[i];
            const sliceH = boundaries[i + 1] - sliceStart;
            if (sliceH <= 0) continue;
            const slice = document.createElement('canvas');
            slice.width = canvas.width;
            slice.height = Math.ceil(sliceH);
            const ctx = slice.getContext('2d')!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, slice.width, slice.height);
            ctx.drawImage(canvas, 0, sliceStart, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
            this.drawBrandOnCanvas(ctx, slice.width, slice.height, scale);
            images.push(slice.toDataURL('image/jpeg', 0.94));
        }
        return images;
    }

    private async captureFullPage(container: HTMLElement, scale: number): Promise<string> {
        const html2canvas = (await import('html2canvas')).default;
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 150));
        const canvas = await html2canvas(container, {
            scale, useCORS: true, backgroundColor: '#000000', logging: false,
            width: this.PAGE_W, height: this.PAGE_FULL_H
        });
        return canvas.toDataURL('image/jpeg', 0.94);
    }

    private drawBrandOnCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
        const text = ChordBookPanelComponent.BRAND_TEXT;
        const fs = Math.round(8.5 * scale);
        ctx.save();
        ctx.fillStyle = '#b8b8b8';
        ctx.font = `300 ${fs}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        ctx.fillText(text, w / 2, Math.round(13 * scale));
        ctx.fillText(text, w / 2, h - Math.round(5 * scale));
        ctx.restore();
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.globalAlpha = 0.045;
        ctx.fillStyle = '#000';
        ctx.font = `800 ${Math.round(50 * scale)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        ctx.fillText('אקורדישקייט', 0, 0);
        ctx.restore();
    }

    // ===== ייצוא PDF =====

    async exportBook() {
        this.isExporting = true;
        this.progressPercent = 0;
        const scale = 2;
        const allPageImages: string[] = [];
        const indexEntries: { title: string; artist: string; page: number }[] = [];
        const songPageImages: string[][] = [];

        // עמוד 1 = כריכה, עמוד 2 = תוכן עניינים → שירים מתחילים מעמוד 3
        let currentPage = 3;

        try {
            // שלב 1: כריכה
            this.progressText = 'בונה עמוד כריכה...';
            this.progressPercent = 3;
            const coverEl = this.buildCoverContainer();
            document.body.appendChild(coverEl);
            const coverImg = await this.captureFullPage(coverEl, scale);
            document.body.removeChild(coverEl);
            allPageImages.push(coverImg);

            // שלב 2: שירים
            for (let i = 0; i < this.playlist.songs.length; i++) {
                const ps = this.playlist.songs[i];
                this.progressText = `מכין שיר ${i + 1} מתוך ${this.playlist.songs.length}: ${ps.songTitle}`;
                this.progressPercent = 8 + Math.round((i / this.playlist.songs.length) * 78);

                const songData = await new Promise<any>((resolve, reject) => {
                    this.songService.getSongById(ps.songId).subscribe({ next: resolve, error: reject });
                });

                const container = this.buildSongContainer(songData);
                document.body.appendChild(container);
                const images = await this.captureAndSlice(container, scale);
                document.body.removeChild(container);

                indexEntries.push({ title: ps.songTitle, artist: ps.artistName, page: currentPage });
                currentPage += images.length;
                songPageImages.push(images);
            }

            // שלב 3: תוכן עניינים (כעת יודעים מספרי עמודים)
            this.progressText = 'בונה תוכן עניינים...';
            this.progressPercent = 90;
            const indexEl = this.buildIndexContainer(indexEntries);
            document.body.appendChild(indexEl);
            const indexImages = await this.captureAndSlice(indexEl, scale);
            document.body.removeChild(indexEl);

            // סדר סופי: כריכה → תוכן עניינים → שירים
            allPageImages.push(...indexImages);
            for (const imgs of songPageImages) {
                allPageImages.push(...imgs);
            }

            // שלב 4: PDF
            this.progressText = 'מרכיב PDF...';
            this.progressPercent = 95;
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWmm = pdf.internal.pageSize.getWidth();
            const marginMm = 10;
            const contentW = pageWmm - marginMm * 2;
            const pxPerMm = this.PAGE_W / contentW;

            for (let i = 0; i < allPageImages.length; i++) {
                const img = new Image();
                await new Promise<void>(r => { img.onload = () => r(); img.src = allPageImages[i]; });
                const displayH = (img.naturalHeight / scale) / pxPerMm;
                if (i > 0) pdf.addPage();
                pdf.addImage(allPageImages[i], 'JPEG', marginMm, marginMm, contentW, displayH);
            }

            pdf.save(`${this.playlist.name} - ספר אקורדים.pdf`);
            this.progressPercent = 100;
        } catch (e) {
            console.error('Chord book export failed:', e);
            alert('שגיאה בייצוא הספר. נסה שוב.');
        } finally {
            this.isExporting = false;
            this.progressText = '';
            this.progressPercent = 0;
        }
    }
}
