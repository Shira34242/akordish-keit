import {
    Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GUITAR_CHORDS, PIANO_CHORDS, UKULELE_CHORDS, GuitarChord, UkuleleChord } from '../../utils/chord-data';
import { ChordPlayerService } from '../../services/chord-player.service';
import { UserKnownChordService } from '../../services/user-known-chord.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

export type Instrument = 'guitar' | 'piano' | 'ukulele';

interface SuffixInfo { key: string; label: string; }
interface ChordTheory { intervals: number[]; scaleName: string; degrees: string; }
interface FingerLine { text: string; isOpen?: boolean; }
interface PianoKey { note: number; }
interface PianoBlackKey { x: number; note: number; }
interface PianoMiniData { whites: PianoKey[]; blacks: PianoBlackKey[]; active: Set<number>; width: number; }

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
    imports: [CommonModule, RouterModule, TranslatePipe],
    templateUrl: './chord-dictionary.component.html',
    styleUrls: ['./chord-dictionary.component.css']
})
export class ChordDictionaryComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;

    private fullHeroHeight = 0;
    private rafPending = false;

    selectedInstrument: Instrument = 'guitar';
    selectedRoot: string | null = null;
    selectedSuffix: string | null = null;
    selectedBass: string | null = null;
    selectedChord: string | null = null;
    chordDetail: ChordDetail | null = null;
    isPlayingDetail = false;
    private playTimer: any = null;

    showRootDrop   = false;
    showSuffixDrop = false;
    showBassDrop   = false;

    chordSearch = '';

    pianoLargeWhites: PianoKey[] = [];
    pianoLargeBlacks: PianoBlackKey[] = [];
    pianoLargeWidth  = 0;
    pianoLargeActive = new Set<number>();

    get instruments(): { key: Instrument; label: string }[] {
        return [
            { key: 'guitar',  label: this.langService.translate('dict.instr_guitar') },
            { key: 'piano',   label: this.langService.translate('dict.instr_piano') },
            { key: 'ukulele', label: this.langService.translate('dict.instr_ukulele') },
        ];
    }

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

    get bassNotes() {
        return [
        { key: null,  display: this.langService.translate('dict.no_bass') },
        { key: 'A',   display: 'A' },
        { key: 'A#',  display: 'A# / B♭' },
        { key: 'B',   display: 'B' },
        { key: 'C',   display: 'C' },
        { key: 'C#',  display: 'C# / D♭' },
        { key: 'D',   display: 'D' },
        { key: 'D#',  display: 'D# / E♭' },
        { key: 'E',   display: 'E' },
        { key: 'F',   display: 'F' },
        { key: 'F#',  display: 'F# / G♭' },
        { key: 'G',   display: 'G' },
        { key: 'G#',  display: 'G# / A♭' },
        ];
    }

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

    private get FINGER_NAME(): { [n: number]: string } {
        return {
            1: this.langService.translate('dict.finger_name_1'),
            2: this.langService.translate('dict.finger_2'),
            3: this.langService.translate('dict.finger_3'),
            4: this.langService.translate('dict.finger_4'),
        };
    }

    private readonly G_STR_NAME = ['E','A','D','G','B','e'];
    private readonly G_STR_NUM  = [6, 5, 4, 3, 2, 1];
    private readonly U_STR_NAME = ['G','C','E','A'];
    private readonly U_STR_NUM  = [4, 3, 2, 1];

    private readonly SHARP_FLAT: { [k: string]: string } = {
        'A#': 'Bb', 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab'
    };

    private readonly WHITE_IN_OCT = [0, 2, 4, 5, 7, 9, 11];
    private readonly BLACK_X_28: { [n: number]: number } = { 1: 20, 3: 48, 6: 104, 8: 132, 10: 160 };
    private readonly BLACK_X_13: { [n: number]: number } = { 1: 9,  3: 22, 6: 48,  8: 61,  10: 74 };

    isSavingKnownChord = false;

    constructor(
        private chordPlayer: ChordPlayerService,
        private knownChordService: UserKnownChordService,
        private authService: AuthService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.loadKnownChords();
    }

    ngAfterViewInit(): void {
        setTimeout(() => this.initHeroHeight(), 50);
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

    @HostListener('document:click', ['$event'])
    onDocClick(e: Event): void {
        const t = e.target as HTMLElement;
        if (!t.closest('.filter-drop'))
            this.showRootDrop = this.showSuffixDrop = this.showBassDrop = false;
    }

    private initHeroHeight(): void {
        const bg = this.heroBg?.nativeElement;
        if (!bg) return;
        this.fullHeroHeight = Math.round(window.innerHeight * 0.6);
        bg.style.height = this.fullHeroHeight + 'px';
        this.shrinkHero();
    }

    private shrinkHero(): void {
        const bg = this.heroBg?.nativeElement;
        if (!bg || this.fullHeroHeight === 0) return;
        const minHeight = 56;
        const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
        bg.style.height = newHeight + 'px';
        const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
        if (collapseOverlay) {
            const collapseRange = this.fullHeroHeight - minHeight;
            const collapseProgress = collapseRange > 0
                ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
                : 0;
            collapseOverlay.style.opacity = String(collapseProgress);
        }
    }

    // ─── Search ─────────────────────────────────────────────────────────────

    get isSearching(): boolean { return this.chordSearch.trim().length > 0; }

    get searchResults(): string[] {
        const q = this.chordSearch.trim();
        if (!q) return [];
        const db = this.getDB();
        const upper = q.toUpperCase();
        return Object.keys(db)
            .filter(k => k.toUpperCase().startsWith(upper))
            .sort()
            .slice(0, 24);
    }

    get displayedChords(): string[] {
        return this.isSearching ? this.searchResults : this.getAvailableChords();
    }

    onChordSearchInput(e: Event): void {
        this.chordSearch = (e.target as HTMLInputElement).value;
        this.clearDetail();
    }

    clearChordSearch(): void {
        this.chordSearch = '';
        this.clearDetail();
    }

    // ─── Display getters ────────────────────────────────────────────────────

    get selectedRootDisplay(): string {
        if (this.selectedRoot === null) return 'כל השורשים';
        return this.roots.find(r => r.key === this.selectedRoot)?.display ?? this.selectedRoot;
    }

    get selectedSuffixDisplay(): string {
        if (this.selectedSuffix === null) return 'כל הסוגים';
        return this.suffixes.find(s => s.key === this.selectedSuffix)?.label ?? this.selectedSuffix;
    }

    get selectedBassDisplay(): string {
        if (this.selectedBass === null) return 'ללא בס';
        return this.bassNotes.find(b => b.key === this.selectedBass)?.display ?? this.selectedBass;
    }

    get detailRoot(): string {
        if (!this.selectedChord) return '';
        const suffix = this.extractSuffix(this.selectedChord);
        const rootPart = this.selectedChord.split('/')[0];
        return rootPart.slice(0, rootPart.length - suffix.length);
    }

    // ─── Selection ──────────────────────────────────────────────────────────

    selectInstrument(inst: Instrument): void {
        this.selectedInstrument = inst;
        this.clearDetail();
        this.loadKnownChords();
    }

    selectRoot(root: string | null): void {
        this.selectedRoot = root;
        this.showRootDrop = false;
        this.clearDetail();
    }

    selectSuffix(suffix: string | null): void {
        this.selectedSuffix = suffix;
        this.showSuffixDrop = false;
        this.clearDetail();
    }

    selectBass(bass: string | null): void {
        this.selectedBass = bass;
        this.showBassDrop = false;
        this.clearDetail();
    }

    clearDetail(): void {
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

        // No root selected → show all chords (filtered by suffix/bass if set)
        if (this.selectedRoot === null) {
            return Object.keys(db)
                .filter(key => {
                    if (this.selectedSuffix !== null && this.extractSuffix(key) !== this.selectedSuffix) return false;
                    if (this.selectedBass !== null) {
                        const flatBass = this.SHARP_FLAT[this.selectedBass];
                        return key.includes('/' + this.selectedBass) ||
                               (flatBass ? key.includes('/' + flatBass) : false);
                    }
                    return !key.includes('/');
                })
                .sort();
        }

        const flat = this.SHARP_FLAT[this.selectedRoot];
        const result: string[] = [];

        for (const s of this.suffixes) {
            if (this.selectedSuffix !== null && s.key !== this.selectedSuffix) continue;

            if (this.selectedBass) {
                const slashS = this.selectedRoot + s.key + '/' + this.selectedBass;
                const flatB  = this.SHARP_FLAT[this.selectedBass];
                const slashF = flatB ? this.selectedRoot + s.key + '/' + flatB : '';
                if (db[slashS]) { result.push(slashS); continue; }
                if (slashF && db[slashF]) { result.push(slashF); continue; }
                if (flat) {
                    const ff = flat + s.key + '/' + this.selectedBass;
                    if (db[ff]) result.push(ff);
                }
            } else {
                const name = this.selectedRoot + s.key;
                if (db[name]) { result.push(name); continue; }
                if (flat) {
                    const fb = flat + s.key;
                    if (db[fb]) result.push(fb);
                }
            }
        }
        return result;
    }

    selectChord(name: string): void {
        if (this.selectedChord === name) { this.clearDetail(); return; }
        this.selectedChord = name;
        this.chordDetail = this.buildDetail(name);
        if (this.selectedInstrument === 'piano') this.buildPianoLarge(name);
    }

    get isSelectedChordKnown(): boolean {
        return !!this.selectedChord && this.knownChordService.isKnown(this.selectedInstrument, this.selectedChord);
    }

    toggleSelectedKnownChord(): void {
        if (!this.selectedChord) return;

        if (!this.authService.isLoggedIn) {
            this.authService.requestLogin(this.router.url);
            return;
        }

        if (this.isSavingKnownChord) return;
        this.isSavingKnownChord = true;
        this.knownChordService.toggle(this.selectedInstrument, this.selectedChord).subscribe({
            next: () => this.isSavingKnownChord = false,
            error: () => this.isSavingKnownChord = false
        });
    }

    private loadKnownChords(): void {
        if (!this.authService.isLoggedIn) return;
        this.knownChordService.ensureLoaded(this.selectedInstrument).subscribe();
    }

    private readonly langService = inject(LanguageService);

    get heroTitle(): string {
        const map: Record<Instrument, string> = {
            guitar:  this.langService.translate('dict.title_guitar'),
            piano:   this.langService.translate('dict.title_piano'),
            ukulele: this.langService.translate('dict.title_ukulele'),
        };
        return map[this.selectedInstrument];
    }

    // ─── Mini diagram helpers ────────────────────────────────────────────────

    getGuitarMini(chord: string): GuitarChord | null {
        return GUITAR_CHORDS[chord] ?? null;
    }

    getUkuleleMini(chord: string): UkuleleChord | null {
        return UKULELE_CHORDS[chord] ?? null;
    }

    // Mini guitar barre helpers
    mgBarreX(b: any): number { return 11 + Math.min(b.fromString, b.toString) * 10 - 4; }
    mgBarreW(b: any): number { return Math.abs(b.fromString - b.toString) * 10 + 8; }
    muBarreX(b: any): number { return 10 + Math.min(b.fromString, b.toString) * 14 - 4; }
    muBarreW(b: any): number { return Math.abs(b.fromString - b.toString) * 14 + 8; }

    getPianoMiniData(chord: string): PianoMiniData | null {
        const keys = PIANO_CHORDS[chord];
        if (!keys) return null;
        const rootS = this.selectedRoot ? (this.NOTE_SEMITONE[this.selectedRoot] ?? 0) : 0;
        const abs = new Set<number>();
        for (const k of keys) {
            const s = ((k % 12) + 12) % 12;
            abs.add(s < rootS ? s + 12 : s);
        }
        const maxNote = Math.max(...abs);
        let end = maxNote + 1;
        while (!this.WHITE_IN_OCT.includes(end % 12)) end++;
        const whites: PianoKey[] = [];
        const blacks: PianoBlackKey[] = [];
        for (let n = 0; n <= end; n++)
            if (this.WHITE_IN_OCT.includes(n % 12)) whites.push({ note: n });
        for (let n = 1; n <= end; n++) {
            const oct = Math.floor(n / 12), io = n % 12;
            if (!this.WHITE_IN_OCT.includes(io) && this.BLACK_X_13[io] !== undefined)
                blacks.push({ x: oct * 91 + this.BLACK_X_13[io], note: n });
        }
        return { whites, blacks, active: abs, width: whites.length * 13 };
    }

    // ─── Detail builder ──────────────────────────────────────────────────────

    private buildDetail(name: string): ChordDetail {
        const suffix = this.extractSuffix(name);
        const rootPart = name.split('/')[0];
        const root = rootPart.slice(0, rootPart.length - suffix.length);
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
        const rootPart = name.split('/')[0];
        const sorted = [...this.suffixes].sort((a, b) => b.key.length - a.key.length);
        for (const s of sorted) {
            if (!s.key) continue;
            if (rootPart.endsWith(s.key)) {
                const possible = rootPart.slice(0, rootPart.length - s.key.length);
                if (this.NOTE_SEMITONE[possible] !== undefined) return s.key;
            }
        }
        return '';
    }

    private computeNotes(root: string, theory: ChordTheory, data: any): string[] {
        if (this.selectedInstrument === 'piano') {
            return (data as number[]).map((n: number) => {
                const s = ((n % 12) + 12) % 12;
                return this.HEBREW_NOTE[this.SEMITONE_NOTE[s]] ?? '';
            });
        }
        const rootS = this.NOTE_SEMITONE[root] ?? 0;
        const seen = new Set<number>();
        const out: string[] = [];
        for (const iv of theory.intervals) {
            const s = (rootS + iv) % 12;
            if (!seen.has(s)) { seen.add(s); out.push(this.HEBREW_NOTE[this.SEMITONE_NOTE[s]] ?? ''); }
        }
        return out;
    }

    private autoAssignFingers(frets: number[]): number[] {
        // Sort active frets ascending → assign fingers 1, 2, 3, 4
        const active = frets
            .map((f, i) => ({ f, i }))
            .filter(x => x.f > 0)
            .sort((a, b) => a.f - b.f || a.i - b.i);
        const result = new Array(frets.length).fill(0);
        active.forEach((x, idx) => { result[x.i] = idx + 1; });
        return result;
    }

    private guitarLines(chord: GuitarChord): { fingerLines: FingerLine[]; startFrom: string } {
        const fingers = chord.fingers?.length
            ? chord.fingers
            : this.autoAssignFingers(chord.frets);
        const lines: FingerLine[] = [];
        const mutedNums: number[] = [];
        let firstPlayable: number | null = null;

        for (let i = 0; i < chord.frets.length; i++) {
            const f = chord.frets[i], fn = fingers[i] ?? 0;
            const snum = this.G_STR_NUM[i];

            if (f === -1) { mutedNums.push(snum); continue; }
            if (firstPlayable === null) firstPlayable = snum;

            const suffix = snum === 1 ? ' (הדק ביותר)' : snum === 6 ? ' (העבה ביותר)' : '';
            const label  = `במיתר ${snum}${suffix}`;

            if (f === 0) {
                lines.push({ text: `${label}, על סריג מספר 0 (מיתר פתוח)`, isOpen: true });
            } else {
                const fingerText = fn > 0 ? ` אצבע מספר ${fn} (${this.FINGER_NAME[fn]})` : '';
                lines.push({ text: `${label}, על סריג מספר ${f}${fingerText}` });
            }
        }

        let startFrom = '';
        if (firstPlayable !== null) {
            const mutedNote = mutedNums.length
                ? ` (שימו לב לא לנגן את מיתר ${mutedNums.join(', ')})`
                : '';
            startFrom = `התחילו לפרוט ממיתר ${firstPlayable}${mutedNote}`;
        }
        return { fingerLines: lines, startFrom };
    }

    private ukuleleLines(chord: UkuleleChord): { fingerLines: FingerLine[]; startFrom: string } {
        const fingers = chord.fingers?.length
            ? chord.fingers
            : this.autoAssignFingers(chord.frets);
        const lines: FingerLine[] = [];

        for (let i = 0; i < chord.frets.length; i++) {
            const f = chord.frets[i], fn = fingers[i] ?? 0;
            const snum = this.U_STR_NUM[i];

            const suffix = snum === 1 ? ' (הדק ביותר)' : snum === 4 ? ' (העבה ביותר)' : '';
            const label  = `במיתר ${snum}${suffix}`;

            if (f === -1) {
                lines.push({ text: `${label} — מושתק`, isOpen: true });
            } else if (f === 0) {
                lines.push({ text: `${label}, על סריג מספר 0 (מיתר פתוח)`, isOpen: true });
            } else {
                const fingerText = fn > 0 ? ` אצבע מספר ${fn} (${this.FINGER_NAME[fn]})` : '';
                lines.push({ text: `${label}, על סריג מספר ${f}${fingerText}` });
            }
        }

        return { fingerLines: lines, startFrom: 'התחילו לפרוט את כל המיתרים יחד' };
    }

    // ─── Piano large ─────────────────────────────────────────────────────────

    private buildPianoLarge(name: string): void {
        const keys: number[] | undefined = PIANO_CHORDS[name];
        if (!keys) { this.pianoLargeWhites = []; this.pianoLargeBlacks = []; return; }
        const rootS = this.selectedRoot ? (this.NOTE_SEMITONE[this.selectedRoot] ?? 0) : 0;
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
        for (let n = 0; n <= end; n++)
            if (this.WHITE_IN_OCT.includes(n % 12)) whites.push({ note: n });
        for (let n = 1; n <= end; n++) {
            const oct = Math.floor(n / 12), io = n % 12;
            if (!this.WHITE_IN_OCT.includes(io) && this.BLACK_X_28[io] !== undefined)
                blacks.push({ x: oct * 196 + this.BLACK_X_28[io], note: n });
        }
        this.pianoLargeWhites = whites;
        this.pianoLargeBlacks = blacks;
        this.pianoLargeWidth  = whites.length * 28;
    }

    isPianoActive(note: number): boolean { return this.pianoLargeActive.has(note); }
    getPianoFill(note: number, isBlack: boolean): string {
        return this.isPianoActive(note) ? '#ddff53' : isBlack ? '#1a1a1a' : 'white';
    }

    // ─── Large Guitar SVG helpers ─────────────────────────────────────────────

    getGuitarChord(): GuitarChord | null {
        return this.selectedInstrument === 'guitar' && this.selectedChord
            ? GUITAR_CHORDS[this.selectedChord] ?? null : null;
    }

    gX(i: number)   { return 30 + i * 24; }
    gY(f: number)   { return 50 + f * 28; }
    gMinFret(): number {
        const c = this.getGuitarChord(); if (!c) return 1;
        const a = c.frets.filter(f => f > 0);
        return a.length ? Math.min(...a) : 1;
    }
    gBarreX(b: any) { return this.gX(Math.min(b.fromString, b.toString)) - 9; }
    gBarreW(b: any) { return Math.abs(b.fromString - b.toString) * 24 + 18; }

    // ─── Large Ukulele SVG helpers ────────────────────────────────────────────

    getUkuleleChord(): UkuleleChord | null {
        return this.selectedInstrument === 'ukulele' && this.selectedChord
            ? UKULELE_CHORDS[this.selectedChord] ?? null : null;
    }

    uX(i: number)   { return 30 + i * 32; }
    uY(f: number)   { return 50 + f * 28; }
    uMinFret(): number {
        const c = this.getUkuleleChord(); if (!c) return 1;
        const a = c.frets.filter(f => f > 0);
        return a.length ? Math.min(...a) : 1;
    }
    uBarreX(b: any) { return this.uX(Math.min(b.fromString, b.toString)) - 9; }
    uBarreW(b: any) { return Math.abs(b.fromString - b.toString) * 32 + 18; }

    // ─── Play ─────────────────────────────────────────────────────────────────

    async playDetail(): Promise<void> {
        if (!this.selectedChord) return;
        if (this.isPlayingDetail) {
            this.chordPlayer.stopAll();
            this.isPlayingDetail = false;
            clearTimeout(this.playTimer);
            return;
        }
        this.isPlayingDetail = true;
        const data = this.getDB()[this.selectedChord];
        if (!data) { this.isPlayingDetail = false; return; }
        if (this.selectedInstrument === 'guitar') {
            await this.chordPlayer.playGuitar(data.frets);
            this.playTimer = setTimeout(() => this.isPlayingDetail = false, 1500);
        } else if (this.selectedInstrument === 'ukulele') {
            await this.chordPlayer.playUkulele(data.frets);
            this.playTimer = setTimeout(() => this.isPlayingDetail = false, 1800);
        } else {
            const rootS = this.selectedRoot ? (this.NOTE_SEMITONE[this.selectedRoot] ?? 0) : 0;
            const abs = new Set<number>((data as number[]).map((n: number) => {
                const s = ((n % 12) + 12) % 12;
                return s < rootS ? s + 12 : s;
            }));
            await this.chordPlayer.playPiano(abs, null);
            this.playTimer = setTimeout(() => this.isPlayingDetail = false, 2500);
        }
    }
}
