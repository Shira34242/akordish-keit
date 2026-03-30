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
    chordColor: string = '#0055cc';
    lyricsColor: string = '#000000';
    transposeStep: number = 0;
    isEasyMode: boolean = false;
    showChords: boolean = true;
    isExporting: boolean = false;

    private preferFlat: boolean = false;

    constructor(private sanitizer: DomSanitizer) {}

    ngOnInit() {
        this.transposeStep = this.initialTransposeStep;
        this.isEasyMode = this.initialIsEasyMode;
        if (this.song?.lyricsWithChords && this.song?.originalKeyName) {
            this.preferFlat = analyzePreferFlat(this.song.lyricsWithChords, this.song.originalKeyName);
        }
    }

    get activePreferFlat(): boolean {
        if (this.transposeStep === 0) return this.preferFlat;
        const key = this.currentKey;
        return key ? preferFlatForKey(key) : this.preferFlat;
    }

    get currentKey(): string {
        if (!this.song?.originalKeyName) return '';
        if (this.transposeStep === 0) return this.song.originalKeyName;
        return transposeChord(this.song.originalKeyName, this.transposeStep, { preferFlat: this.preferFlat });
    }

    get transposeDisplay(): string {
        if (this.transposeStep === 0) return '0';
        const tones = this.transposeStep / 2;
        const sign = this.transposeStep > 0 ? '+' : '';
        return `${sign}${tones}`;
    }

    get artistName(): string {
        return this.song?.artists?.map((a: any) => a.name).join(', ') || '';
    }

    transpose(dir: number) {
        if ((this.transposeStep >= 6 && dir > 0) || (this.transposeStep <= -5 && dir < 0)) return;
        this.isEasyMode = false;
        this.transposeStep += dir;
    }

    setVersion(easy: boolean) {
        if (easy === this.isEasyMode) return;
        if (!easy) {
            this.isEasyMode = false;
            this.transposeStep = 0;
        } else {
            this.applyEasyMode();
        }
    }

    private applyEasyMode() {
        if (!this.song?.easyKeyId || !this.song?.easyKeyName || !this.song?.originalKeyName) return;
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const flatKeys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const getIdx = (k: string) => {
            const base = k.replace('m', '').trim();
            let i = keys.indexOf(base);
            if (i === -1) i = flatKeys.indexOf(base);
            return i;
        };
        const origIdx = getIdx(this.song.originalKeyName);
        const easyIdx = getIdx(this.song.easyKeyName);
        if (origIdx !== -1 && easyIdx !== -1) {
            let diff = easyIdx - origIdx;
            if (diff > 6) diff -= 12;
            if (diff < -6) diff += 12;
            this.transposeStep = diff;
        }
        this.isEasyMode = true;
    }

    get printLyricsHtml(): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(this.buildLyricsHtml(this.chordColor, this.lyricsColor));
    }

    private buildLyricsHtml(chordCol: string, lyricsCol: string): string {
        if (!this.song?.lyricsWithChords) return '';
        const lines = this.song.lyricsWithChords.split('\n');
        const processed = lines.map((line: string) => {
            if (isChordLine(line)) {
                if (!this.showChords) return null;
                return line.replace(/\S+/g, (token) => {
                    if (!isChord(token)) return token;
                    let chord = this.transposeStep !== 0
                        ? transposeChord(token, this.transposeStep, { preferFlat: this.activePreferFlat })
                        : token;
                    if (this.isEasyMode) chord = simplifyChord(chord);
                    return `<span style="color:${chordCol};font-weight:700">${chord}</span>`;
                });
            }
            let processed = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            if (this.showChords) {
                processed = processed.replace(/\[(.*?)\]/g, (match, chord) => {
                    if (!isChord(chord)) return match;
                    let result = this.transposeStep !== 0
                        ? transposeChord(chord, this.transposeStep, { preferFlat: this.activePreferFlat })
                        : chord;
                    if (this.isEasyMode) result = simplifyChord(result);
                    return `<span style="color:${chordCol};font-weight:700">${result}</span>`;
                });
            } else {
                processed = processed.replace(/\[(.*?)\]/g, '');
            }
            return `<span style="color:${lyricsCol}">${processed}</span>`;
        }).filter((l: any) => l !== null);
        return processed.join('\n');
    }

    print() {
        const lyricsHtml = this.buildLyricsHtml(this.chordColor, this.lyricsColor);
        const w = window.open('', '_blank', 'height=900,width=900');
        if (!w) return;

        const colCss = this.columns > 1
            ? `column-count:${this.columns};column-gap:32px;`
            : '';

        w.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="utf-8">
<title>${this.song?.title || ''} - ${this.artistName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,800&display=swap" rel="stylesheet">
<style>
*{-webkit-user-select:none;user-select:none;box-sizing:border-box;margin:0;padding:0}
body{font-family:"Open Sans",Arial,sans-serif;font-weight:300;direction:rtl;background:#fff;color:#000;padding:32px}
.ph{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e0e0e0}
.ph-title{font-size:22px;font-weight:800;margin-bottom:4px}
.ph-artist{font-size:14px;font-weight:300;color:#404040}
.ph-key{font-size:12px;color:#888;margin-top:4px}
.pl{white-space:pre-wrap;font-size:${this.fontSize}px;line-height:2;${colCss}color:${this.lyricsColor}}
@media print{body{padding:20px}@page{margin:12mm}}
</style>
</head>
<body>
<div class="ph">
<div class="ph-title">${this.song?.title || ''}</div>
<div class="ph-artist">${this.artistName}</div>
${this.song?.originalKeyName ? `<div class="ph-key">סולם: ${this.currentKey}</div>` : ''}
</div>
<div class="pl">${lyricsHtml}</div>
</body></html>`);
        w.document.close();
        w.focus();
        // מחכה לטעינת הפונטים לפני הדפסה
        const tryPrint = () => {
            if (w.document.fonts && w.document.fonts.status !== 'loaded') {
                w.document.fonts.ready.then(() => { w.print(); w.close(); });
            } else {
                w.print();
                w.close();
            }
        };
        setTimeout(tryPrint, 600);
    }

    async exportPdf() {
        this.isExporting = true;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const lyricsHtml = this.buildLyricsHtml(this.chordColor, this.lyricsColor);
            const artistName = this.artistName;
            const colCss = this.columns > 1
                ? `column-count:${this.columns};column-gap:32px;`
                : '';

            // אלמנט זמני — ממוקם שמאלה מחוץ לתצוגה, גלוי לדפדפן (לא display:none)
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:fixed;top:0;left:-9999px;width:1px;height:1px;overflow:visible;z-index:-1';

            const container = document.createElement('div');
            container.style.cssText = [
                'position:absolute',
                'top:0',
                'right:0',
                'width:794px',
                'background:#fff',
                'direction:rtl',
                'font-family:"Open Sans",Arial,sans-serif',
                'font-weight:300',
                `font-size:${this.fontSize}px`,
                'line-height:2',
                'padding:40px',
                'box-sizing:border-box'
            ].join(';');

            container.innerHTML = `
<div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e0e0e0">
  <div style="font-size:22px;font-weight:800;margin-bottom:4px">${this.song?.title || ''}</div>
  <div style="font-size:14px;font-weight:300;color:#404040">${artistName}</div>
  ${this.song?.originalKeyName ? `<div style="font-size:12px;color:#888;margin-top:4px">סולם: ${this.currentKey}</div>` : ''}
</div>
<div style="white-space:pre-wrap;font-size:${this.fontSize}px;line-height:2;${colCss}color:${this.lyricsColor}">${lyricsHtml}</div>`;

            wrapper.appendChild(container);
            document.body.appendChild(wrapper);

            // מחכה לרינדור
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => setTimeout(resolve, 80));

            const captureH = container.scrollHeight;
            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: 794,
                height: captureH,
                windowWidth: 794,
                scrollX: 0,
                scrollY: 0
            });

            document.body.removeChild(wrapper);

            // יצירת PDF עם תמונות בלבד — לא ניתן לבחור טקסט
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const contentW = pageW - margin * 2;   // 190mm
            const contentH = pageH - margin * 2;   // 277mm

            // פיקסלים לכל מ"מ
            const pxPerMm = canvas.width / contentW;
            const pageHeightPx = contentH * pxPerMm;

            let yOffset = 0;
            let pageNum = 0;

            while (yOffset < canvas.height) {
                const sliceH = Math.min(pageHeightPx, canvas.height - yOffset);
                const slice = document.createElement('canvas');
                slice.width = canvas.width;
                slice.height = Math.ceil(sliceH);
                const ctx = slice.getContext('2d')!;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, slice.width, slice.height);
                ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

                const imgData = slice.toDataURL('image/jpeg', 0.94);
                const displayH = sliceH / pxPerMm;

                if (pageNum > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', margin, margin, contentW, displayH);

                yOffset += pageHeightPx;
                pageNum++;
            }

            const filename = `${this.song?.title || 'שיר'} - ${artistName}.pdf`;
            pdf.save(filename);
        } catch (e) {
            console.error('PDF export failed:', e);
        } finally {
            this.isExporting = false;
        }
    }

    onBackdropClick(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains('print-panel-backdrop')) {
            this.close.emit();
        }
    }
}
