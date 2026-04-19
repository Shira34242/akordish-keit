import {
    Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChordTooltipComponent } from '../chord-tooltip/chord-tooltip.component';
import { GUITAR_CHORDS, PIANO_CHORDS, UKULELE_CHORDS, GuitarChord, UkuleleChord } from '../../utils/chord-data';
import { ChordPlayerService } from '../../services/chord-player.service';

export type Instrument = 'guitar' | 'piano' | 'ukulele';

interface SuffixInfo { key: string; label: string; }
interface ChordTheory { intervals: number[]; scaleName: string; degrees: string; }
interface FingerLine { text: string; isOpen?: boolean; }
interface PianoKey { note: number; }
interface PianoBlackKey { x: number; note: number; }

export interface ChordDetail {
    chordName: string;
    hebrewTitle: string;
    hebrewNotes: string[];
    rootHebrew: string;
    scaleName: string;
    degrees: string;
    fingerLines: FingerLine[];
    startFrom: string;
    hasData: boolean;
}

@Component({
    selector: 'app-chord-dictionary',
    standalone: true,
    imports: [CommonModule, RouterModule, ChordTooltipComponent],
    templateUrl: './chord-dictionary.component.html',
    styleUrls: ['./chord-dictionary.component.css']
})
export class ChordDictionaryComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;
    private fullHeroHeight = 0;
    private rafPending = false;

    selectedInstrument: Instrument = 'guitar';
    selectedRoot = 'A';
    selectedSuffix: string | null = null;
    selectedChord: string | null = null;
    chordDetail: ChordDetail | null = null;
    isPlayingDetail = false;
    private playTimer: any = null;

    // Piano large display data
    pianoLargeWhites: PianoKey[] = [];
    pianoLargeBlacks: PianoBlackKey[] = [];
    pianoLargeWidth = 0;
    pianoLargeActive = new Set<number>();

    readonly instruments: { key: Instrument; label: string }[] = [
        { key: 'guitar',  label: 'גיטרה' },
        { key: 'piano',   label: 'קלידים' },
        { key: 'ukulele', label: 'יוקלילי' },
    ];

    readonly roots = [
        { key: 'A',  display: 'A' },
        { key: 'A#', display: 'A# / B♭' },
        { key: 'B',  display: 'B' },
        { key: 'C',  display: 'C' },
        { key: 'C#', display: 'C# / D♭' },
        { key: 'D',  display: 'D' },
        { key: 'D#', display: 'D# / E♭' },
        { key: 'E',  display: 'E' },
        { key: 'F',  display: 'F' },
        { key: 'F#', display: 'F# / G♭' },
        { key: 'G',  display: 'G' },
        { key: 'G#', display: 'G# / A♭' },
    ];

    readonly suffixes: SuffixInfo[] = [
        { key: '',      label: 'Major' },
        { key: 'm',     label: 'Minor' },
        { key: '7',     label: '7' },
        { key: 'maj7',  label: 'Maj7' },
        { key: 'm7',    label: 'm7' },
        { key: 'dim',   label: 'dim' },
        { key: 'dim7',  label: 'dim7' },
        { key: 'aug',   label: 'aug' },
        { key: 'sus4',  label: 'sus4' },
        { key: 'sus2',  label: 'sus2' },
        { key: '6',     label: '6' },
        { key: 'm6',    label: 'm6' },
        { key: '9',     label: '9' },
        { key: 'm9',    label: 'm9' },
        { key: 'add9',  label: 'add9' },
        { key: 'm7b5',  label: 'm7b5' },
    ];

    private readonly CHORD_THEORY: { [s: string]: ChordTheory } = {
        '':     { intervals: [0, 4, 7],         scaleName: 'Major',           degrees: '1, 3, 5' },
        'm':    { intervals: [0, 3, 7],         scaleName: 'Minor',           degrees: '1, ♭3, 5' },
        '7':    { intervals: [0, 4, 7, 10],     scaleName: 'Dominant 7th',    degrees: '1, 3, 5, ♭7' },
        'maj7': { intervals: [0, 4, 7, 11],     scaleName: 'Major 7th',       degrees: '1, 3, 5, 7' },
        'm7':   { intervals: [0, 3, 7, 10],     scaleName: 'Minor 7th',       degrees: '1, ♭3, 5, ♭7' },
        'dim':  { intervals: [0, 3, 6],         scaleName: 'Diminished',      degrees: '1, ♭3, ♭5' },
        'dim7': { intervals: [0, 3, 6, 9],      scaleName: 'Diminished 7th',  degrees: '1, ♭3, ♭5, ♭♭7' },
        'aug':  { intervals: [0, 4, 8],         scaleName: 'Augmented',       degrees: '1, 3, ♯5' },
        'sus4': { intervals: [0, 5, 7],         scaleName: 'Suspended 4th',   degrees: '1, 4, 5' },
        'sus2': { intervals: [0, 2, 7],         scaleName: 'Suspended 2nd',   degrees: '1, 2, 5' },
        '6':    { intervals: [0, 4, 7, 9],      scaleName: 'Major 6th',       degrees: '1, 3, 5, 6' },
        'm6':   { intervals: [0, 3, 7, 9],      scaleName: 'Minor 6th',       degrees: '1, ♭3, 5, 6' },
        '9':    { intervals: [0, 4, 7, 10, 14], scaleName: 'Dominant 9th',    degrees: '1, 3, 5, ♭7, 9' },
        'm9':   { intervals: [0, 3, 7, 10, 14], scaleName: 'Minor 9th',       degrees: '1, ♭3, 5, ♭7, 9' },
        'add9': { intervals: [0, 4, 7, 14],     scaleName: 'Added 9th',       degrees: '1, 3, 5, 9' },
        'm7b5': { intervals: [0, 3, 6, 10],     scaleName: 'Half Diminished', degrees: '1, ♭3, ♭5, ♭7' },
    };

    private readonly NOTE_SEMITONE: { [n: string]: number } = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };

    private readonly SEMITONE_NOTE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

    private readonly HEBREW_NOTE: { [n: string]: string } = {
        'C': 'דו', 'C#': 'דו♯', 'Db': 'רה♭', 'D': 'רה', 'D#': 'רה♯', 'Eb': 'מי♭',
        'E': 'מי', 'F': 'פה', 'F#': 'פה♯', 'Gb': 'סול♭', 'G': 'סול',
        'G#': 'סול♯', 'Ab': 'לה♭', 'A': 'לה', 'A#': 'לה♯', 'Bb': 'סי♭', 'B': 'סי'
    };

    private readonly FINGER_NAME: { [n: number]: string } = {
        1: 'אצבע מורה', 2: 'אמה', 3: 'קמיצה', 4: 'זרת'
    };

    // Guitar: index 0 = string 6 (E, thickest) ... index 5 = string 1 (e, thinnest)
    private readonly G_STR_NAME   = ['E','A','D','G','B','e'];
    private readonly G_STR_NUM    = [6, 5, 4, 3, 2, 1];
    private readonly G_OPEN_SEMI  = [4, 9, 2, 7, 11, 4];

    // Ukulele: index 0=G(4), 1=C(3), 2=E(2), 3=A(1)
    private readonly U_STR_NAME   = ['G','C','E','A'];
    private readonly U_STR_NUM    = [4, 3, 2, 1];
    private readonly U_OPEN_SEMI  = [7, 0, 4, 9];

    private readonly SHARP_FLAT: { [k: string]: string } = {
        'A#': 'Bb', 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab'
    };

    private readonly WHITE_IN_OCT = [0, 2, 4, 5, 7, 9, 11];
    private readonly BLACK_X_28: { [n: number]: number } = { 1: 20, 3: 48, 6: 104, 8: 132, 10: 160 };

    constructor(private chordPlayer: ChordPlayerService) {}

    ngOnInit(): void {}

    ngAfterViewInit(): void {
        setTimeout(() => this.initHeroHeight(), 0);
    }

    ngOnDestroy(): void {}

    @HostListener('window:scroll')
    onScroll(): void {
        if (this.rafPending) return;
        this.rafPending = true;
        requestAnimationFrame(() => { this.shrinkHero(); this.rafPending = false; });
    }

    @HostListener('window:resize')
    onResize(): void { this.initHeroHeight(); }

    private initHeroHeight(): void {
        const bg = this.heroBg?.nativeElement;
        if (!bg) return;
        this.fullHeroHeight = Math.round(window.innerHeight * 0.42);
        bg.style.height = this.fullHeroHeight + 'px';
        this.shrinkHero();
    }

    private shrinkHero(): void {
        const bg = this.heroBg?.nativeElement;
        if (!bg || this.fullHeroHeight === 0) return;
        const min = 56;
        const h = Math.max(min, this.fullHeroHeight - window.scrollY);
        bg.style.height = h + 'px';
        const ov = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
        if (ov) {
            const range = this.fullHeroHeight - min;
            ov.style.opacity = String(range > 0 ? Math.min(1, (this.fullHeroHeight - h) / range) : 0);
        }
    }

    // ─── Instrument / Root / Suffix selection ───────────────────────────────

    selectInstrument(inst: Instrument): void {
        this.selectedInstrument = inst;
        this.clearDetail();
    }

    selectRoot(root: string): void {
        this.selectedRoot = root;
        this.clearDetail();
    }

    toggleSuffix(suffix: string): void {
        this.selectedSuffix = this.selectedSuffix === suffix ? null : suffix;
        this.clearDetail();
    }

    private clearDetail(): void {
        this.selectedChord = null;
        this.chordDetail = null;
        this.isPlayingDetail = false;
    }

    // ─── Chord grid ─────────────────────────────────────────────────────────

    getDB(): { [k: string]: any } {
        return this.selectedInstrument === 'guitar'  ? GUITAR_CHORDS
             : this.selectedInstrument === 'piano'   ? PIANO_CHORDS
             : UKULELE_CHORDS;
    }

    getAvailableChords(): string[] {
        const db = this.getDB();
        const flat = this.SHARP_FLAT[this.selectedRoot];
        const result: string[] = [];

        for (const s of this.suffixes) {
            if (this.selectedSuffix !== null && s.key !== this.selectedSuffix) continue;
            const sharp = this.selectedRoot + s.key;
            if (db[sharp]) { result.push(sharp); continue; }
            if (flat) {
                const fb = flat + s.key;
                if (db[fb]) result.push(fb);
            }
        }
        return result;
    }

    selectChord(name: string): void {
        if (this.selectedChord === name) {
            this.clearDetail();
            return;
        }
        this.selectedChord = name;
        this.chordDetail = this.buildDetail(name);
        if (this.selectedInstrument === 'piano') this.buildPianoLarge(name);
        setTimeout(() => {
            document.querySelector('.chord-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    }

    // ─── Chord detail builder ────────────────────────────────────────────────

    private buildDetail(name: string): ChordDetail {
        const suffix = this.extractSuffix(name);
        const root   = name.slice(0, name.length - suffix.length);
        const theory = this.CHORD_THEORY[suffix];
        const db     = this.getDB();
        const data   = db[name];
        const label  = { guitar: 'גיטרה', piano: 'קלידים', ukulele: 'יוקלילי' }[this.selectedInstrument];

        let hebrewNotes: string[] = [];
        let fingerLines: FingerLine[] = [];
        let startFrom = '';

        if (data && theory) {
            hebrewNotes = this.computeNotes(root, theory, data);
            if (this.selectedInstrument === 'guitar')
                ({ fingerLines, startFrom } = this.guitarLines(data as GuitarChord));
            else if (this.selectedInstrument === 'ukulele')
                ({ fingerLines, startFrom } = this.ukuleleLines(data as UkuleleChord));
            else
                fingerLines = [{ text: 'לחצו בו-זמנית על כל המקשים המסומנים בצהוב.' }];
        }

        return {
            chordName: name,
            hebrewTitle: `איך לנגן את אקורד ${name} ב${label}`,
            hebrewNotes,
            rootHebrew: this.HEBREW_NOTE[root] ?? root,
            scaleName: theory?.scaleName ?? '',
            degrees:   theory?.degrees   ?? '',
            fingerLines,
            startFrom,
            hasData: !!data,
        };
    }

    private extractSuffix(name: string): string {
        const sorted = [...this.suffixes].sort((a, b) => b.key.length - a.key.length);
        for (const s of sorted) {
            if (!s.key) continue;
            if (name.endsWith(s.key)) {
                const possibleRoot = name.slice(0, name.length - s.key.length);
                if (this.NOTE_SEMITONE[possibleRoot] !== undefined) return s.key;
            }
        }
        return '';
    }

    private computeNotes(root: string, theory: ChordTheory, _data: any): string[] {
        if (this.selectedInstrument === 'piano') {
            return (_data as number[]).map(n => {
                const s = ((n % 12) + 12) % 12;
                return this.HEBREW_NOTE[this.SEMITONE_NOTE[s]] ?? '';
            });
        }
        const rootS = this.NOTE_SEMITONE[root] ?? 0;
        const seen = new Set<number>();
        const out: string[] = [];
        for (const iv of theory.intervals) {
            const s = (rootS + iv) % 12;
            if (!seen.has(s)) {
                seen.add(s);
                out.push(this.HEBREW_NOTE[this.SEMITONE_NOTE[s]] ?? '');
            }
        }
        return out;
    }

    private guitarLines(chord: GuitarChord): { fingerLines: FingerLine[], startFrom: string } {
        const lines: FingerLine[] = [];
        let startNum: number | null = null;
        let startName = '';

        for (let i = 0; i < chord.frets.length; i++) {
            const f  = chord.frets[i];
            const fn = chord.fingers?.[i] ?? 0;
            const sn = this.G_STR_NAME[i];
            const snum = this.G_STR_NUM[i];

            if (f === -1) {
                lines.push({ text: `מיתר ${snum} (${sn}) — מושתק, לא מנגנים`, isOpen: true });
            } else if (f === 0) {
                lines.push({ text: `מיתר ${snum} (${sn}) — מיתר פתוח`, isOpen: true });
                if (startNum === null) { startNum = snum; startName = sn; }
            } else {
                const fname = fn > 0 ? ` — ${this.FINGER_NAME[fn]} (${fn})` : '';
                lines.push({ text: `מיתר ${snum} (${sn}), סריג ${f}${fname}` });
                if (startNum === null) { startNum = snum; startName = sn; }
            }
        }

        const startFrom = startNum !== null
            ? `התחילו לנגן ממיתר ${startNum} (${startName}, העבה)`
            : '';
        return { fingerLines: lines, startFrom };
    }

    private ukuleleLines(chord: UkuleleChord): { fingerLines: FingerLine[], startFrom: string } {
        const lines: FingerLine[] = [];

        for (let i = 0; i < chord.frets.length; i++) {
            const f  = chord.frets[i];
            const fn = chord.fingers?.[i] ?? 0;
            const sn = this.U_STR_NAME[i];
            const snum = this.U_STR_NUM[i];

            if (f === -1) {
                lines.push({ text: `מיתר ${sn} (${snum}) — מושתק`, isOpen: true });
            } else if (f === 0) {
                lines.push({ text: `מיתר ${sn} (${snum}) — מיתר פתוח`, isOpen: true });
            } else {
                const fname = fn > 0 ? ` — ${this.FINGER_NAME[fn]} (${fn})` : '';
                lines.push({ text: `מיתר ${sn} (${snum}), סריג ${f}${fname}` });
            }
        }

        return {
            fingerLines: lines,
            startFrom: 'פרטו את כל המיתרים יחד ממיתר G (4) עד מיתר A (1)'
        };
    }

    // ─── Piano large display ─────────────────────────────────────────────────

    private buildPianoLarge(name: string): void {
        const keys: number[] | undefined = PIANO_CHORDS[name];
        if (!keys) { this.pianoLargeWhites = []; this.pianoLargeBlacks = []; return; }

        const rootS = this.NOTE_SEMITONE[this.selectedRoot] ?? 0;
        const abs = new Set<number>();
        for (const k of keys) {
            const s = ((k % 12) + 12) % 12;
            abs.add(s < rootS ? s + 12 : s);
        }
        this.pianoLargeActive = abs;

        const maxNote = Math.max(...abs);
        let end = maxNote + 1;
        while (!this.WHITE_IN_OCT.includes(end % 12)) end++;

        const whites: PianoKey[] = [];
        const blacks: PianoBlackKey[] = [];

        for (let n = 0; n <= end; n++) {
            if (this.WHITE_IN_OCT.includes(n % 12)) whites.push({ note: n });
        }

        for (let n = 1; n <= end; n++) {
            const oct = Math.floor(n / 12);
            const io  = n % 12;
            if (!this.WHITE_IN_OCT.includes(io) && this.BLACK_X_28[io] !== undefined) {
                blacks.push({ x: oct * 196 + this.BLACK_X_28[io], note: n });
            }
        }

        this.pianoLargeWhites = whites;
        this.pianoLargeBlacks = blacks;
        this.pianoLargeWidth  = whites.length * 28;
    }

    isPianoActive(note: number): boolean { return this.pianoLargeActive.has(note); }

    getPianoFill(note: number, isBlack: boolean): string {
        return this.isPianoActive(note) ? '#ddff53' : isBlack ? '#1a1a1a' : 'white';
    }

    // ─── Guitar large SVG helpers ────────────────────────────────────────────

    getGuitarChord(): GuitarChord | null {
        return this.selectedInstrument === 'guitar' && this.selectedChord
            ? GUITAR_CHORDS[this.selectedChord] ?? null : null;
    }

    gX(i: number)   { return 24 + i * 22; }
    gY(fret: number){ return 24 + fret * 26; }

    gMinFret(): number {
        const c = this.getGuitarChord(); if (!c) return 1;
        const a = c.frets.filter(f => f > 0);
        return a.length ? Math.min(...a) : 1;
    }

    gBarreX(b: any)  { return this.gX(Math.min(b.fromString, b.toString)) - 8; }
    gBarreW(b: any)  { return Math.abs(b.fromString - b.toString) * 22 + 16; }

    // ─── Ukulele large SVG helpers ────────────────────────────────────────────

    getUkuleleChord(): UkuleleChord | null {
        return this.selectedInstrument === 'ukulele' && this.selectedChord
            ? UKULELE_CHORDS[this.selectedChord] ?? null : null;
    }

    uX(i: number)   { return 24 + i * 30; }
    uY(fret: number){ return 24 + fret * 26; }

    uMinFret(): number {
        const c = this.getUkuleleChord(); if (!c) return 1;
        const a = c.frets.filter(f => f > 0);
        return a.length ? Math.min(...a) : 1;
    }

    uBarreX(b: any)  { return this.uX(Math.min(b.fromString, b.toString)) - 8; }
    uBarreW(b: any)  { return Math.abs(b.fromString - b.toString) * 30 + 16; }

    // ─── Play ────────────────────────────────────────────────────────────────

    get detailRoot(): string {
        if (!this.selectedChord) return '';
        const suffixLen = this.selectedSuffix?.length ?? 0;
        return this.selectedChord.slice(0, this.selectedChord.length - suffixLen);
    }

    async playDetail(): Promise<void> {
        if (!this.selectedChord) return;
        if (this.isPlayingDetail) {
            this.chordPlayer.stopAll();
            this.isPlayingDetail = false;
            clearTimeout(this.playTimer);
            return;
        }
        this.isPlayingDetail = true;
        const db = this.getDB();
        const data = db[this.selectedChord];
        if (!data) { this.isPlayingDetail = false; return; }

        if (this.selectedInstrument === 'guitar') {
            await this.chordPlayer.playGuitar(data.frets);
            this.playTimer = setTimeout(() => this.isPlayingDetail = false, 1500);
        } else if (this.selectedInstrument === 'ukulele') {
            await this.chordPlayer.playUkulele(data.frets);
            this.playTimer = setTimeout(() => this.isPlayingDetail = false, 1800);
        } else {
            const rootS = this.NOTE_SEMITONE[this.selectedRoot] ?? 0;
            const abs = new Set<number>((data as number[]).map((n: number) => {
                const s = ((n % 12) + 12) % 12;
                return s < rootS ? s + 12 : s;
            }));
            await this.chordPlayer.playPiano(abs, null);
            this.playTimer = setTimeout(() => this.isPlayingDetail = false, 2500);
        }
    }
}
