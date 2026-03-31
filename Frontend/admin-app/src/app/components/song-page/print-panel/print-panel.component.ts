import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
    transposeChord,
    simplifyChord,
    isChord,
    isChordLine,
    analyzePreferFlat,
    preferFlatForKey
} from '../../../utils/music-utils';

@Component({
    selector: 'app-print-panel',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './print-panel.component.html',
    styleUrls: ['./print-panel.component.css']
})
export class PrintPanelComponent implements OnInit {
    @Input() song: any;
    @Input() initialTransposeStep: number = 0;
    @Input() initialIsEasyMode: boolean = false;
    @Output() close = new EventEmitter<void>();

    columns: 1 | 2 | 3 = 1;
    fontSize: number = 16;
    chordColor: string = '#ddff53';
    lyricsColor: string = '#000000';
    transposeStep: number = 0;
    isEasyMode: boolean = false;
    showChords: boolean = true;
    isExporting: boolean = false;
    previewZoom: number = 1;

    private preferFlat: boolean = false;
    private readonly ZOOM_STEP = 0.15;
    private readonly ZOOM_MIN = 0.4;
    private readonly ZOOM_MAX = 2.0;

    // ===== מידות preview =====
    // רוחב עמוד תצוגה מקדימה (px) — תואם לרוחב PDF container
    readonly PAGE_W = 640;
    // גובה עמוד A4 ביחס לרוחב זה
    readonly PAGE_FULL_H = Math.round(640 * 297 / 210); // ≈ 906
    // גובה פס ה-brand (למעלה + למטה) בפיקסלים
    readonly BRAND_BAR_H = 20;

    private static readonly BRAND_TEXT =
        'הורד מאתר אקורדישקייט · המאגר הגדול והיחיד מסוגו לאקורדים במוזיקה היהודית';

    constructor(private sanitizer: DomSanitizer) {}

    ngOnInit() {
        this.transposeStep = this.initialTransposeStep;
        this.isEasyMode = this.initialIsEasyMode;
        if (this.song?.lyricsWithChords && this.song?.originalKeyName) {
            this.preferFlat = analyzePreferFlat(this.song.lyricsWithChords, this.song.originalKeyName);
        }
    }

    // ===== גטרים מוזיקליים =====

    get activePreferFlat(): boolean {
        if (this.transposeStep === 0) return this.preferFlat;
        return preferFlatForKey(this.currentKey) ?? this.preferFlat;
    }

    get currentKey(): string {
        if (!this.song?.originalKeyName) return '';
        if (this.transposeStep === 0) return this.song.originalKeyName;
        return transposeChord(this.song.originalKeyName, this.transposeStep, { preferFlat: this.preferFlat });
    }

    get transposeDisplay(): string {
        if (this.transposeStep === 0) return '0';
        const sign = this.transposeStep > 0 ? '+' : '';
        return `${sign}${this.transposeStep / 2}`;
    }

    get artistName(): string {
        return this.song?.artists?.map((a: any) => a.name).join(', ') || '';
    }

    // ===== זום =====

    get zoomPercent(): number { return Math.round(this.previewZoom * 100); }
    zoomIn()  { this.previewZoom = Math.min(this.ZOOM_MAX, +(this.previewZoom + this.ZOOM_STEP).toFixed(2)); }
    zoomOut() { this.previewZoom = Math.max(this.ZOOM_MIN, +(this.previewZoom - this.ZOOM_STEP).toFixed(2)); }

    // ===== עמודים =====

    /** גובה שורה ב-CSS px */
    get lineHeightCss(): number { return this.fontSize * 2; }

    /**
     * גובה אזור הקליפ של כל עמוד (חלק הביניים בין פסי ה-brand).
     * מוצמד למכפלה של גובה שורה כך שהחיתוך תמיד בין שורות.
     */
    get pageClipH(): number {
        const avail = this.PAGE_FULL_H - 2 * this.BRAND_BAR_H;
        return Math.floor(avail / this.lineHeightCss) * this.lineHeightCss;
    }

    /** גובה כרטיס עמוד כולל פסי brand */
    get pageCardH(): number {
        return this.pageClipH + 2 * this.BRAND_BAR_H;
    }

    /** מספר שורות (כולל שורות ריקות) בלירוס */
    private get totalLines(): number {
        return this.song?.lyricsWithChords?.split('\n').length ?? 0;
    }

    /**
     * מספר עמודים — מבוסס על גובה תוכן כולל (כותרת מוערכת + שורות).
     * הכותרת חלק מה-content window, לכן נחשבת בתחשיב.
     */
    get numPages(): number {
        const HEADER_EST = 90; // הערכת גובה כותרת (כותרת שיר + אמן + סולם + gap)
        const totalH = HEADER_EST + 16 + this.totalLines * this.lineHeightCss;
        return Math.max(1, Math.ceil(totalH / this.pageClipH));
    }

    get pageIndices(): number[] {
        return Array.from({ length: this.numPages }, (_, i) => i);
    }

    /**
     * offset שלילי של תוכן ה-content-window בתוך כל קליפ.
     * עמוד 0: 0  → רואים [0 .. pageClipH] (כולל כותרת)
     * עמוד i: -(i * pageClipH) → רואים [i*pageClipH .. (i+1)*pageClipH]
     */
    getContentOffset(pageIndex: number): number {
        return -(pageIndex * this.pageClipH);
    }

    // ===== מוסיקה =====

    transpose(dir: number) {
        if ((this.transposeStep >= 6 && dir > 0) || (this.transposeStep <= -5 && dir < 0)) return;
        this.isEasyMode = false;
        this.transposeStep += dir;
    }

    setVersion(easy: boolean) {
        if (easy === this.isEasyMode) return;
        if (!easy) { this.isEasyMode = false; this.transposeStep = 0; }
        else { this.applyEasyMode(); }
    }

    private applyEasyMode() {
        if (!this.song?.easyKeyId || !this.song?.easyKeyName || !this.song?.originalKeyName) return;
        const keys     = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const flatKeys = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
        const idx = (k: string) => { const b = k.replace('m','').trim(); let i = keys.indexOf(b); return i === -1 ? flatKeys.indexOf(b) : i; };
        const d = idx(this.song.easyKeyName) - idx(this.song.originalKeyName);
        this.transposeStep = d > 6 ? d - 12 : d < -6 ? d + 12 : d;
        this.isEasyMode = true;
    }

    // ===== HTML מילים =====

    get printLyricsHtml(): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(this.buildLyricsHtml(this.chordColor, this.lyricsColor));
    }

    private buildLyricsHtml(chordCol: string, lyricsCol: string): string {
        if (!this.song?.lyricsWithChords) return '';
        const lines = this.song.lyricsWithChords.split('\n');
        const out = lines.map((line: string) => {
            if (isChordLine(line)) {
                if (!this.showChords) return null;
                return line.replace(/\S+/g, tok => {
                    if (!isChord(tok)) return tok;
                    let c = this.transposeStep !== 0 ? transposeChord(tok, this.transposeStep, { preferFlat: this.activePreferFlat }) : tok;
                    if (this.isEasyMode) c = simplifyChord(c);
                    return `<span style="color:${chordCol};font-weight:700">${c}</span>`;
                });
            }
            let p = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            if (this.showChords) {
                p = p.replace(/\[(.*?)\]/g, (m, chord) => {
                    if (!isChord(chord)) return m;
                    let r = this.transposeStep !== 0 ? transposeChord(chord, this.transposeStep, { preferFlat: this.activePreferFlat }) : chord;
                    if (this.isEasyMode) r = simplifyChord(r);
                    return `<span style="color:${chordCol};font-weight:700">${r}</span>`;
                });
            } else {
                p = p.replace(/\[(.*?)\]/g, '');
            }
            return `<span style="color:${lyricsCol}">${p}</span>`;
        }).filter((l: any) => l !== null);
        return out.join('\n');
    }

    // ===== בניית container לצילום (preview ו-PDF משתמשים באותו HTML) =====

    buildPrintContainer(): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = [
            'position:fixed','top:0','left:0',
            `width:${this.PAGE_W}px`,
            'background:#fff',
            'direction:rtl',
            'font-family:"Open Sans",Arial,sans-serif',
            'font-weight:300',
            `font-size:${this.fontSize}px`,
            'line-height:2',
            'padding:20px 24px',
            'box-sizing:border-box',
            'z-index:99998'
        ].join(';');

        const lyricsHtml = this.buildLyricsHtml(this.chordColor, this.lyricsColor);
        const colCss = this.columns > 1
            ? `column-count:${this.columns};column-gap:24px;column-fill:auto;`
            : '';

        container.innerHTML = `
<div class="pdf-header" style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e8e8e8">
  <div style="font-size:17px;font-weight:800;margin-bottom:2px">${this.song?.title || ''}</div>
  <div style="font-size:12px;font-weight:300;color:#404040">${this.artistName}</div>
  ${this.song?.originalKeyName ? `<div style="font-size:10px;color:#888;margin-top:2px">סולם: ${this.currentKey}</div>` : ''}
</div>
<div class="pdf-lyrics" style="white-space:pre-wrap;font-size:${this.fontSize}px;line-height:2;color:${this.lyricsColor};${colCss}">${lyricsHtml}</div>`;
        return container;
    }

    // ===== ציור brand text + watermark על canvas slice =====

    private drawBrandOnCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
        const text = PrintPanelComponent.BRAND_TEXT;
        const fs = Math.round(8.5 * scale);

        ctx.save();
        ctx.fillStyle = '#b8b8b8';
        ctx.font = `300 ${fs}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';

        // brand text — למעלה
        ctx.fillText(text, w / 2, Math.round(13 * scale));
        // brand text — למטה
        ctx.fillText(text, w / 2, h - Math.round(5 * scale));

        ctx.restore();

        // watermark — אלכסוני במרכז
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

    // ===== הדפסה — תמונה בלבד =====

    async print() {
        const overlay = this.createOverlay('מכין להדפסה — רגע...');
        document.body.appendChild(overlay);

        const container = this.buildPrintContainer();
        document.body.appendChild(container);

        try {
            const sliceImages = await this.captureAndSlice(container, 2);

            const w = window.open('', '_blank', 'height=900,width=900');
            if (!w) return;
            const imgTags = sliceImages.map(src =>
                `<img src="${src}" style="width:100%;display:block;page-break-after:always">`
            ).join('');
            w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${this.song?.title || ''}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;-webkit-user-select:none;user-select:none}
body{background:#fff}@media print{@page{size:A4;margin:0}img{width:100%;page-break-after:always}}</style>
</head><body>${imgTags}</body></html>`);
            w.document.close();
            w.focus();
            setTimeout(() => { w.print(); }, 500);

        } catch (e) {
            console.error('Print failed:', e);
        } finally {
            document.body.removeChild(container);
            document.body.removeChild(overlay);
        }
    }

    // ===== ייצוא PDF =====

    async exportPdf() {
        this.isExporting = true;

        const overlay = this.createOverlay('מכין PDF — רגע...');
        document.body.appendChild(overlay);

        const container = this.buildPrintContainer();
        document.body.appendChild(container);

        try {
            const sliceImages = await this.captureAndSlice(container, 2);
            const { jsPDF } = await import('jspdf');

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWmm = pdf.internal.pageSize.getWidth();
            const pageHmm = pdf.internal.pageSize.getHeight();
            const marginMm = 10;
            const contentW = pageWmm - marginMm * 2;

            // גובה A4 (ב-mm) לכל slice — פרופורציונלי לגובה הפיקסלים
            // כל slice הוא pageClipH מהcontent window (640px → contentW mm)
            const pxPerMm = this.PAGE_W / contentW; // 640 / 190 ≈ 3.37
            for (let i = 0; i < sliceImages.length; i++) {
                // נקבל גובה slice בmm לפי הגודל בpx
                // כל slice (מלבד האחרון) הוא pageClipH גובה
                const isLast = i === sliceImages.length - 1;
                // טען תמונה לחישוב גובה
                const img = new Image();
                await new Promise<void>(r => { img.onload = () => r(); img.src = sliceImages[i]; });
                const displayH = (img.naturalHeight / 2) / pxPerMm; // /2 כי scale=2
                if (i > 0) pdf.addPage();
                pdf.addImage(sliceImages[i], 'JPEG', marginMm, marginMm, contentW, displayH);
            }

            pdf.save(`${this.song?.title || 'שיר'} - ${this.artistName}.pdf`);

        } catch (e) {
            console.error('PDF export failed:', e);
        } finally {
            document.body.removeChild(container);
            document.body.removeChild(overlay);
            this.isExporting = false;
        }
    }

    // ===== לוגיקת צילום וחיתוך — משותפת להדפסה ו-PDF =====

    private async captureAndSlice(container: HTMLElement, scale: number): Promise<string[]> {
        const html2canvas = (await import('html2canvas')).default;

        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 200));

        const headerEl  = container.querySelector('.pdf-header') as HTMLElement;
        const paddingPx = 20;
        const captureH  = container.scrollHeight;
        container.style.height = captureH + 'px';

        const canvas = await html2canvas(container, {
            scale,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: this.PAGE_W,
            height: captureH
        });

        // — חישוב נקודות חיתוך מוצמדות לשורות —
        const lineHCanvas    = this.fontSize * 2 * scale;
        const headerHCanvas  = (paddingPx + (headerEl?.offsetHeight ?? 0)) * scale;
        // גובה עמוד ב-canvas = pageClipH * scale (תואם בדיוק לתצוגה מקדימה)
        const nominalPagePx  = this.pageClipH * scale;

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

        // — חיתוך slices עם brand text ו-watermark —
        const images: string[] = [];
        for (let i = 0; i < boundaries.length - 1; i++) {
            const sliceStart = boundaries[i];
            const sliceH     = boundaries[i + 1] - sliceStart;
            if (sliceH <= 0) continue;

            const slice = document.createElement('canvas');
            slice.width  = canvas.width;
            slice.height = Math.ceil(sliceH);
            const ctx = slice.getContext('2d')!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, slice.width, slice.height);
            ctx.drawImage(canvas, 0, sliceStart, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

            // brand text + watermark
            this.drawBrandOnCanvas(ctx, slice.width, slice.height, scale);

            images.push(slice.toDataURL('image/jpeg', 0.94));
        }
        return images;
    }

    // ===== helpers =====

    private createOverlay(text: string): HTMLElement {
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;inset:0;background:rgba(64,64,64,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;font-size:14px;direction:rtl';
        el.textContent = text;
        return el;
    }

    onBackdropClick(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains('print-panel-backdrop')) this.close.emit();
    }
}
