import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LanguageService } from '../../../services/language.service';
import { SongService } from '../../../services/song.service';
import { firstValueFrom } from 'rxjs';
import {
    transposeChord,
    simplifyChord,
    isChord,
    isChordLine,
    analyzePreferFlat,
    preferFlatForKey,
    parseChord,
    enharmonicRoot
} from '../../../utils/music-utils';
import { GUITAR_CHORDS, UKULELE_CHORDS, PIANO_CHORDS, GuitarChord, UkuleleChord } from '../../../utils/chord-data';

// ===== ממשק פריט תרשים אקורד =====
interface ChordDiagramItem {
    name: string;
    guitarChord: GuitarChord | null;
    ukuleleChord: UkuleleChord | null;
    pianoKeys: number[] | null;
    pianoWhiteKeys: { note: number }[];
    pianoBlackKeys: { x: number; note: number }[];
    pianoDisplayWidth: number;
    activeAbsoluteNotes: Set<number>;
    minActiveFret: number;
    ukuMinActiveFret: number;
}

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
    showDiagrams: boolean = false;
    diagramInstrument: 'guitar' | 'piano' | 'ukulele' = 'guitar';
    isExporting: boolean = false;
    isPrinting: boolean = false;
    printMessage: string = '';
    previewZoom: number = 1;

    private preferFlat: boolean = false;
    private readonly ZOOM_STEP = 0.15;
    private readonly ZOOM_MIN = 0.4;
    private readonly ZOOM_MAX = 2.0;

    readonly PAGE_W = 640;
    readonly PAGE_FULL_H = Math.round(640 * 297 / 210); // ≈ 906
    readonly BRAND_BAR_H = 20;

    private static readonly BRAND_TEXT =
        'הורד מאתר אקורדישקייט · המאגר הגדול והיחיד מסוגו לאקורדים במוזיקה היהודית';

    // ===== פסנתר: קבועים =====
    private readonly whiteNotesInOctave = [0, 2, 4, 5, 7, 9, 11];
    private readonly blackNotesInOctave = [1, 3, 6, 8, 10];
    private readonly blackKeyOffsets: Record<number, number> = { 1: 14, 3: 34, 6: 74, 8: 94, 10: 114 };

    private readonly langService = inject(LanguageService);

    constructor(
        private sanitizer: DomSanitizer,
        private songService: SongService
    ) {}

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

    get genreNames(): string[] {
        return this.song?.genres?.map((g: any) => g.name) || [];
    }

    get composerLine(): string {
        const parts: string[] = [];
        if (this.song?.composer?.name) parts.push(this.langService.translate('print.composer_melody') + ' ' + this.song.composer.name);
        if (this.song?.lyricist?.name) parts.push(this.langService.translate('print.composer_lyrics') + ' ' + this.song.lyricist.name);
        return parts.join(' | ');
    }

    // ===== זום =====

    get zoomPercent(): number { return Math.round(this.previewZoom * 100); }
    zoomIn()  { this.previewZoom = Math.min(this.ZOOM_MAX, +(this.previewZoom + this.ZOOM_STEP).toFixed(2)); }
    zoomOut() { this.previewZoom = Math.max(this.ZOOM_MIN, +(this.previewZoom - this.ZOOM_STEP).toFixed(2)); }

    // ===== עמודים =====

    get lineHeightCss(): number { return this.fontSize * 2; }

    get pageClipH(): number {
        const avail = this.PAGE_FULL_H - 2 * this.BRAND_BAR_H;
        return Math.floor(avail / this.lineHeightCss) * this.lineHeightCss;
    }

    get pageCardH(): number {
        return this.pageClipH + 2 * this.BRAND_BAR_H;
    }

    private get totalLines(): number {
        return this.song?.lyricsWithChords?.split('\n').length ?? 0;
    }

    get numPages(): number {
        const HEADER_EST = 120; // כולל תמונה ופרטים
        const DIAGRAMS_EST = this.showDiagrams && this.chordDiagrams.length > 0
            ? Math.ceil(this.chordDiagrams.length / 5) * 150 + 24
            : 0;
        const totalH = HEADER_EST + DIAGRAMS_EST + this.totalLines * this.lineHeightCss;
        return Math.max(1, Math.ceil(totalH / this.pageClipH));
    }

    get pageIndices(): number[] {
        return Array.from({ length: this.numPages }, (_, i) => i);
    }

    getContentOffset(pageIndex: number): number {
        return -(pageIndex * this.pageClipH);
    }

    // ===== תרשימי אקורדים =====

    get chordDiagrams(): ChordDiagramItem[] {
        if (!this.showDiagrams || !this.song?.lyricsWithChords) return [];
        const names = this.extractUniqueChords();
        return names
            .map(n => this.buildDiagramItem(n))
            .filter(d => d.guitarChord || d.ukuleleChord || d.pianoKeys);
    }

    private extractUniqueChords(): string[] {
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
                if (!seen.has(key)) { seen.add(key); result.push(c); }
            }
        }
        return result;
    }

    private buildDiagramItem(chordName: string): ChordDiagramItem {
        const variations = this.getChordVariations(chordName);
        const guitarChord = this.findInMap(GUITAR_CHORDS, variations) ?? null;
        const ukuleleChord = this.findInMap(UKULELE_CHORDS, variations) ?? null;
        const pianoKeys = this.findInMap(PIANO_CHORDS, variations) ?? null;

        let pianoWhiteKeys: { note: number }[] = [];
        let pianoBlackKeys: { x: number; note: number }[] = [];
        let activeAbsoluteNotes: Set<number> = new Set();
        let pianoDisplayWidth = 200;

        if (pianoKeys) {
            const p = this.computePianoDisplay(pianoKeys);
            pianoWhiteKeys = p.whiteKeys;
            pianoBlackKeys = p.blackKeys;
            activeAbsoluteNotes = p.activeNotes;
            pianoDisplayWidth = p.width;
        }

        const gActive = guitarChord?.frets.filter(f => f > 0) ?? [];
        const uActive = ukuleleChord?.frets.filter(f => f > 0) ?? [];

        return {
            name: chordName,
            guitarChord,
            ukuleleChord,
            pianoKeys,
            pianoWhiteKeys,
            pianoBlackKeys,
            pianoDisplayWidth,
            activeAbsoluteNotes,
            minActiveFret: gActive.length ? Math.min(...gActive) : 1,
            ukuMinActiveFret: uActive.length ? Math.min(...uActive) : 1,
        };
    }

    private findInMap<T>(map: Record<string, T>, variations: string[]): T | undefined {
        for (const v of variations) if (map[v]) return map[v];
        return undefined;
    }

    private getChordVariations(chord: string): string[] {
        const variations: string[] = [chord];
        const parsed = parseChord(chord);
        if (parsed?.normalizedName && !variations.includes(parsed.normalizedName)) {
            variations.push(parsed.normalizedName);
        }
        if (parsed) {
            const { root, suffix, bass } = parsed;
            if (bass && !variations.includes(root + suffix)) variations.push(root + suffix);
            const altRoot = enharmonicRoot(root);
            if (altRoot) {
                const alt = altRoot + suffix + (bass ? '/' + bass : '');
                if (!variations.includes(alt)) variations.push(alt);
            }
            const basic = simplifyChord(chord);
            if (!variations.includes(basic)) variations.push(basic);
        }
        return variations;
    }

    private computePianoDisplay(pianoKeys: number[]): {
        whiteKeys: { note: number }[];
        blackKeys: { x: number; note: number }[];
        activeNotes: Set<number>;
        width: number;
    } {
        if (!pianoKeys.length) return { whiteKeys: [], blackKeys: [], activeNotes: new Set(), width: 120 };
        const notes = pianoKeys.map(n => ((n % 12) + 12) % 12);
        const root = notes[0];
        const absNotes: number[] = notes.map(n => n < root ? n + 12 : n);
        const activeNotes = new Set(absNotes);
        const maxNote = Math.max(...absNotes);
        let endNote = maxNote + 1;
        while (!this.whiteNotesInOctave.includes(endNote % 12)) endNote++;
        const whiteKeys: { note: number }[] = [];
        for (let n = 0; n <= endNote; n++) {
            if (this.whiteNotesInOctave.includes(n % 12)) whiteKeys.push({ note: n });
        }
        const blackKeys: { x: number; note: number }[] = [];
        for (let i = 0; i < whiteKeys.length; i++) {
            const bn = whiteKeys[i].note + 1;
            if (bn <= endNote && this.blackNotesInOctave.includes(bn % 12)) {
                const oct = Math.floor(bn / 12);
                blackKeys.push({ x: oct * 140 + this.blackKeyOffsets[bn % 12], note: bn });
            }
        }
        return { whiteKeys, blackKeys, activeNotes, width: whiteKeys.length * 20 };
    }

    // ===== helpers לתבנית (SVG) =====

    pianoKeyFill(item: ChordDiagramItem, note: number): string {
        return item.activeAbsoluteNotes.has(note) ? '#ddff53' : 'white';
    }

    pianoBlackFill(item: ChordDiagramItem, note: number): string {
        return item.activeAbsoluteNotes.has(note) ? '#ddff53' : 'black';
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

    private renderPreservedSpaces(value: string): string {
        return value
            .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
            .replace(/ /g, '&nbsp;');
    }

    private escapeHtml(value: string): string {
        return (value || '')
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#039;');
    }

    private renderChordOnlyLine(line: string, chordCol: string): string {
        return (line.match(/\s+|\S+/g) ?? []).map(tok => {
            if (/^\s+$/.test(tok)) {
                return this.renderPreservedSpaces(tok);
            }

            if (!isChord(tok)) {
                return this.escapeHtml(tok);
            }

            let c = this.transposeStep !== 0 ? transposeChord(tok, this.transposeStep, { preferFlat: this.activePreferFlat }) : tok;
            if (this.isEasyMode) c = simplifyChord(c);
            return `<span style="color:${chordCol};font-weight:700">${this.escapeHtml(c)}</span>`;
        }).join('');
    }

    private buildLyricsHtml(chordCol: string, lyricsCol: string): string {
        if (!this.song?.lyricsWithChords) return '';
        const lines = this.song.lyricsWithChords.split('\n');
        const out = lines.map((line: string) => {
            if (isChordLine(line)) {
                if (!this.showChords) return null;
                return this.renderChordOnlyLine(line, chordCol);
            }
            let p = this.escapeHtml(line);
            if (this.showChords) {
                p = p.replace(/\[(.*?)\]/g, (m: string, chord: string) => {
                    if (!isChord(chord)) return m;
                    let r = this.transposeStep !== 0 ? transposeChord(chord, this.transposeStep, { preferFlat: this.activePreferFlat }) : chord;
                    if (this.isEasyMode) r = simplifyChord(r);
                    return `<span style="color:${chordCol};font-weight:700">${this.escapeHtml(r)}</span>`;
                });
            } else {
                p = p.replace(/\[(.*?)\]/g, '');
            }
            return `<span style="color:${lyricsCol}">${p}</span>`;
        }).filter((l: any) => l !== null);
        return out.join('\n');
    }

    // ===== בניית container לצילום =====

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
        const colCss = this.columns > 1 ? `column-count:${this.columns};column-gap:24px;column-fill:balance;` : '';
        const genreHtml = this.genreNames.map(g =>
            `<span style="display:inline-block;background:#F2F2F2;border-radius:999px;padding:1px 8px;font-size:9px;font-weight:300;margin:1px 2px;color:#404040">${g}</span>`
        ).join('');
        const composerHtml = this.composerLine
            ? `<div style="font-size:9px;font-weight:300;color:#888;margin-top:3px">${this.composerLine}</div>`
            : '';
        const imageHtml = this.song?.imageUrl
            ? `<img src="${this.song.imageUrl}" crossorigin="anonymous" style="width:80px;height:80px;object-fit:cover;border-radius:12px;flex-shrink:0;display:block" alt="">`
            : '';
        const diagramsHtml = this.showDiagrams && this.chordDiagrams.length > 0
            ? `<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e8e8e8">
                 <div style="font-size:8.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#888;margin-bottom:8px">${this.langService.translate('print.chord_diagrams')}</div>
                 <div style="display:flex;flex-wrap:wrap;gap:10px;direction:rtl">${this.buildDiagramsHtml()}</div>
               </div>`
            : '';

        container.innerHTML = `
<div class="pdf-header" style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e8e8e8">
  ${imageHtml}
  <div style="flex:1;text-align:right">
    <div style="font-size:17px;font-weight:800;line-height:1.2;margin-bottom:3px">${this.song?.title || ''}</div>
    <div style="font-size:12px;font-weight:300;color:#404040;margin-bottom:3px">${this.artistName}</div>
    ${this.song?.originalKeyName ? `<div style="font-size:10px;color:#888;margin-bottom:4px">${this.langService.translate('print.key_label')} ${this.currentKey}</div>` : ''}
    <div style="margin-top:2px">${genreHtml}</div>
    ${composerHtml}
  </div>
</div>
${diagramsHtml}
<div class="pdf-lyrics" style="white-space:pre-wrap;font-size:${this.fontSize}px;line-height:2;color:${this.lyricsColor};${colCss}">${lyricsHtml}</div>`;
        return container;
    }

    private buildDiagramsHtml(): string {
        return this.chordDiagrams.map(item => {
            const svgHtml = this.diagramInstrument === 'guitar'
                ? this.buildGuitarSvg(item)
                : this.diagramInstrument === 'ukulele'
                    ? this.buildUkuleleSvg(item)
                    : this.buildPianoSvg(item);
            if (!svgHtml) return '';
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;background:#F2F2F2;border-radius:10px;padding:6px 8px">
                      <div style="font-size:10px;font-weight:700;font-family:Arial;direction:ltr">${item.name}</div>
                      ${svgHtml}
                    </div>`;
        }).filter(Boolean).join('');
    }

    private buildGuitarSvg(item: ChordDiagramItem): string {
        if (!item.guitarChord) return '';
        const { frets, barres } = item.guitarChord;
        let svg = `<svg viewBox="0 0 80 80" width="65" height="72">`;
        svg += `<line x1="10" y1="10" x2="60" y2="10" stroke="black" stroke-width="2"/>`;
        for (let i = 1; i <= 5; i++) svg += `<line x1="10" y1="${10+i*12}" x2="60" y2="${10+i*12}" stroke="#999" stroke-width="1"/>`;
        for (let i = 0; i <= 5; i++) svg += `<line x1="${10+i*10}" y1="10" x2="${10+i*10}" y2="70" stroke="black" stroke-width="1"/>`;
        frets.forEach((fret: number, i: number) => {
            if (fret === -1) svg += `<text x="${10+i*10}" y="6" text-anchor="middle" font-size="8" font-family="Arial">x</text>`;
            else if (fret === 0) svg += `<circle cx="${10+i*10}" cy="5" r="2" fill="none" stroke="black" stroke-width="1"/>`;
            else svg += `<circle cx="${10+i*10}" cy="${10+fret*12-6}" r="3.5" fill="#1a1a1a"/>`;
        });
        if (barres) barres.forEach((b: any) => {
            const mx = Math.min(b.fromString, b.toString);
            svg += `<rect x="${10+mx*10-4}" y="${10+b.fret*12-9}" width="${Math.abs(b.fromString-b.toString)*10+8}" height="6" rx="3" fill="#1a1a1a" opacity="0.2"/>`;
        });
        if (item.minActiveFret > 1) svg += `<text x="65" y="${10+item.minActiveFret*12-2}" text-anchor="start" font-size="7" font-family="Arial" fill="#555">${item.minActiveFret}fr</text>`;
        svg += '</svg>';
        return svg;
    }

    private buildUkuleleSvg(item: ChordDiagramItem): string {
        if (!item.ukuleleChord) return '';
        const { frets, barres } = item.ukuleleChord;
        let svg = `<svg viewBox="0 0 56 84" width="52" height="75">`;
        svg += `<line x1="10" y1="10" x2="52" y2="10" stroke="black" stroke-width="2"/>`;
        for (let i = 1; i <= 5; i++) svg += `<line x1="10" y1="${10+i*12}" x2="52" y2="${10+i*12}" stroke="#999" stroke-width="1"/>`;
        for (let i = 0; i <= 3; i++) svg += `<line x1="${10+i*14}" y1="10" x2="${10+i*14}" y2="70" stroke="black" stroke-width="1"/>`;
        ['G','C','E','A'].forEach((lbl, i) => svg += `<text x="${10+i*14}" y="79" text-anchor="middle" font-size="6" font-family="Arial" fill="#555">${lbl}</text>`);
        frets.forEach((fret: number, i: number) => {
            if (fret === -1) svg += `<text x="${10+i*14}" y="6" text-anchor="middle" font-size="8" font-family="Arial">x</text>`;
            else if (fret === 0) svg += `<circle cx="${10+i*14}" cy="5" r="2" fill="none" stroke="black" stroke-width="1"/>`;
            else svg += `<circle cx="${10+i*14}" cy="${10+fret*12-6}" r="3.5" fill="#1a1a1a"/>`;
        });
        if (barres) barres.forEach((b: any) => {
            const mx = Math.min(b.fromString, b.toString);
            svg += `<rect x="${10+mx*14-4}" y="${10+b.fret*12-9}" width="${Math.abs(b.fromString-b.toString)*14+8}" height="6" rx="3" fill="#1a1a1a" opacity="0.2"/>`;
        });
        if (item.ukuMinActiveFret > 1) svg += `<text x="56" y="${10+item.ukuMinActiveFret*12-2}" text-anchor="start" font-size="7" font-family="Arial" fill="#555">${item.ukuMinActiveFret}fr</text>`;
        svg += '</svg>';
        return svg;
    }

    private buildPianoSvg(item: ChordDiagramItem): string {
        if (!item.pianoKeys) return '';
        const w = item.pianoDisplayWidth;
        let svg = `<svg viewBox="0 0 ${w} 50" width="${Math.max(w, 60)}" height="50">`;
        item.pianoWhiteKeys.forEach((key, i) => {
            const fill = item.activeAbsoluteNotes.has(key.note) ? '#ddff53' : 'white';
            svg += `<rect x="${i*20}" y="0" width="20" height="50" stroke="black" stroke-width="1" fill="${fill}"/>`;
        });
        item.pianoBlackKeys.forEach(key => {
            const fill = item.activeAbsoluteNotes.has(key.note) ? '#ddff53' : 'black';
            svg += `<rect x="${key.x}" y="0" width="12" height="30" fill="${fill}"/>`;
        });
        svg += '</svg>';
        return svg;
    }

    // ===== ציור brand text + watermark על canvas =====

    private drawBrandOnCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
        const text = PrintPanelComponent.BRAND_TEXT;
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

    // ===== הדפסה — תמונה בלבד =====

    async print() {
        if (this.isPrinting || !this.song?.id) return;
        this.isPrinting = true;
        this.printMessage = '';
        const overlay = this.createOverlay(this.langService.translate('print.preparing_print'));
        document.body.appendChild(overlay);
        const container = this.buildPrintContainer();
        document.body.appendChild(container);
        try {
            const sliceImages = await this.captureAndSlice(container, 2);
            const w = window.open('', '_blank', 'height=900,width=900');
            if (!w) return;
            const limitResult = await firstValueFrom(this.songService.registerPrint(this.song.id));
            if (!limitResult.allowed) {
                w.close();
                this.printMessage = 'הגעת למגבלת ההדפסות היומית';
                return;
            }
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
            this.printMessage = 'לא ניתן להדפיס כרגע';
        } finally {
            document.body.removeChild(container);
            document.body.removeChild(overlay);
            this.isPrinting = false;
        }
    }

    // ===== ייצוא PDF =====

    async exportPdf() {
        this.isExporting = true;
        const overlay = this.createOverlay(this.langService.translate('print.preparing_pdf'));
        document.body.appendChild(overlay);
        const container = this.buildPrintContainer();
        document.body.appendChild(container);
        try {
            const sliceImages = await this.captureAndSlice(container, 2);
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWmm = pdf.internal.pageSize.getWidth();
            const marginMm = 10;
            const contentW = pageWmm - marginMm * 2;
            const pxPerMm = this.PAGE_W / contentW;
            for (let i = 0; i < sliceImages.length; i++) {
                const img = new Image();
                await new Promise<void>(r => { img.onload = () => r(); img.src = sliceImages[i]; });
                const displayH = (img.naturalHeight / 2) / pxPerMm;
                if (i > 0) pdf.addPage();
                pdf.addImage(sliceImages[i], 'JPEG', marginMm, marginMm, contentW, displayH);
            }
            pdf.save(`${this.song?.title || this.langService.translate('print.filename_fallback')} - ${this.artistName}.pdf`);
        } catch (e) {
            console.error('PDF export failed:', e);
        } finally {
            document.body.removeChild(container);
            document.body.removeChild(overlay);
            this.isExporting = false;
        }
    }

    // ===== לוגיקת צילום וחיתוך =====

    private async captureAndSlice(container: HTMLElement, scale: number): Promise<string[]> {
        const html2canvas = (await import('html2canvas')).default;
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 200));
        const headerEl  = container.querySelector('.pdf-header') as HTMLElement;
        const paddingPx = 20;
        const captureH  = container.scrollHeight;
        container.style.height = captureH + 'px';
        const canvas = await html2canvas(container, {
            scale, useCORS: true, backgroundColor: '#ffffff', logging: false,
            width: this.PAGE_W, height: captureH
        });
        const lineHCanvas   = this.fontSize * 2 * scale;
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
            slice.width  = canvas.width;
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
