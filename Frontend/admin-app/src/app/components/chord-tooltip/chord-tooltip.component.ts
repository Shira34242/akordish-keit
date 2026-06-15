import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GUITAR_CHORDS, PIANO_CHORDS, UKULELE_CHORDS, GuitarChord, UkuleleChord } from '../../utils/chord-data';
import { simplifyChord, parseChord, enharmonicRoot } from '../../utils/music-utils';
import { ChordPlayerService } from '../../services/chord-player.service';
import { UserKnownChordService, KnownChordInstrument } from '../../services/user-known-chord.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-chord-tooltip',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './chord-tooltip.component.html',
    styleUrls: ['./chord-tooltip.component.css']
})
export class ChordTooltipComponent implements OnChanges, OnDestroy {
    @Input() chordName: string = '';
    @Input() instrument: 'guitar' | 'piano' | 'ukulele' = 'guitar';
    @Input() isPinned: boolean = false;
    @Output() closePinned = new EventEmitter<void>();
    @Output() tooltipHoverChange = new EventEmitter<boolean>();

    isPlaying = false;
    private playTimer: any = null;

    isKnownChord = false;
    isSavingKnownChord = false;
    private knownSub?: Subscription;

    constructor(
        private chordPlayer: ChordPlayerService,
        private knownChordService: UserKnownChordService,
        private authService: AuthService,
        private router: Router
    ) {
        this.knownSub = this.knownChordService.known$.subscribe(() => {
            this.syncKnownState();
        });
    }

    ngOnDestroy(): void {
        this.knownSub?.unsubscribe();
    }

    async playChord(event: Event): Promise<void> {
        event.stopPropagation();
        if (this.isPlaying) {
            this.chordPlayer.stopAll();
            this.isPlaying = false;
            clearTimeout(this.playTimer);
            return;
        }

        this.isPlaying = true;
        clearTimeout(this.playTimer);

        if (this.instrument === 'guitar' && this.guitarChord) {
            await this.chordPlayer.playGuitar(this.guitarChord.frets);
            this.playTimer = setTimeout(() => (this.isPlaying = false), 1500);
        } else if (this.instrument === 'ukulele' && this.ukuleleChord) {
            await this.chordPlayer.playUkulele(this.ukuleleChord.frets);
            this.playTimer = setTimeout(() => (this.isPlaying = false), 1800);
        } else if (this.instrument === 'piano' && this.pianoKeys) {
            await this.chordPlayer.playPiano(this.activeAbsoluteNotes, this.bassAbsoluteNote);
            this.playTimer = setTimeout(() => (this.isPlaying = false), 2500);
        } else {
            this.isPlaying = false;
        }
    }

    guitarChord: GuitarChord | null = null;
    ukuleleChord: UkuleleChord | null = null;
    pianoKeys: number[] | null = null;
    displayChordName: string = ''; // The chord name we're actually displaying

    // Slash chord fallback: bass note that's not part of the root diagram
    parsedBass: string | null = null;
    bassAbsoluteNote: number | null = null;

    // Piano: absolute note positions (computed from pianoKeys)
    activeAbsoluteNotes: Set<number> = new Set();

    // Note name → semitone (0–11) lookup for bass detection
    private readonly noteToSemitone: Record<string, number> = {
        'C': 0, 'B#': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'Fb': 4, 'F': 5, 'E#': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11
    };

    // Dynamic piano display keys (computed per chord)
    pianoWhiteKeys: { note: number }[] = [];
    pianoBlackKeys: { x: number; note: number }[] = [];
    pianoDisplayWidth: number = 200;

    // White note indices within an octave (C=0, D=2, E=4, F=5, G=7, A=9, B=11)
    private whiteNotesInOctave = [0, 2, 4, 5, 7, 9, 11];

    // Black note indices within an octave
    private blackNotesInOctave = [1, 3, 6, 8, 10];

    // X offset of each black key relative to its octave start (in white-key units)
    private blackKeyOffsets: { [note: number]: number } = {
        1: 14,   // C#
        3: 34,   // D#
        6: 74,   // F#
        8: 94,   // G#
        10: 114, // A#
    };

    // Guitar SVG config
    numFrets = 5;
    numStrings = 6;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['chordName'] || changes['instrument']) {
            this.updateChordData();
            this.loadKnownState();
        }
    }

    toggleKnownChord(event: Event): void {
        event.stopPropagation();

        if (!this.authService.isLoggedIn) {
            this.authService.requestLogin(this.router.url);
            return;
        }

        if (!this.chordName || this.isSavingKnownChord) return;

        this.isSavingKnownChord = true;
        this.knownChordService.toggle(this.instrument, this.chordName).subscribe({
            next: () => {
                this.syncKnownState();
                this.isSavingKnownChord = false;
            },
            error: () => {
                this.isSavingKnownChord = false;
            }
        });
    }

    private loadKnownState(): void {
        if (!this.authService.isLoggedIn) {
            this.isKnownChord = false;
            return;
        }

        this.knownChordService.ensureLoaded(this.instrument as KnownChordInstrument).subscribe(() => {
            this.syncKnownState();
        });
    }

    private syncKnownState(): void {
        if (!this.authService.isLoggedIn || !this.chordName) {
            this.isKnownChord = false;
            return;
        }

        this.isKnownChord = this.knownChordService.isKnown(this.instrument, this.chordName);
    }

    updateChordData() {
        if (!this.chordName) return;

        // Parse original chord once — used to detect slash-chord fallback
        const originalParsed = parseChord(this.chordName);
        const originalBass = originalParsed?.bass ?? null;
        this.parsedBass = originalBass;

        const chordVariations = this.getChordVariations(this.chordName);

        if (this.instrument === 'guitar') {
            this.pianoKeys = null;
            this.ukuleleChord = null;
            this.activeAbsoluteNotes = new Set();
            this.pianoWhiteKeys = [];
            this.pianoBlackKeys = [];
            this.bassAbsoluteNote = null;
            for (const variation of chordVariations) {
                if (GUITAR_CHORDS[variation]) {
                    this.guitarChord = GUITAR_CHORDS[variation];
                    this.displayChordName = variation;
                    return;
                }
            }
            this.guitarChord = null;
            this.displayChordName = this.chordName;
        } else if (this.instrument === 'ukulele') {
            this.guitarChord = null;
            this.pianoKeys = null;
            this.activeAbsoluteNotes = new Set();
            this.pianoWhiteKeys = [];
            this.pianoBlackKeys = [];
            this.bassAbsoluteNote = null;
            for (const variation of chordVariations) {
                if (UKULELE_CHORDS[variation]) {
                    this.ukuleleChord = UKULELE_CHORDS[variation];
                    this.displayChordName = variation;
                    return;
                }
            }
            this.ukuleleChord = null;
            this.displayChordName = this.chordName;
        } else {
            this.guitarChord = null;
            this.ukuleleChord = null;
            this.bassAbsoluteNote = null;
            for (const variation of chordVariations) {
                if (PIANO_CHORDS[variation]) {
                    this.pianoKeys = PIANO_CHORDS[variation];
                    this.displayChordName = variation;
                    this.computeAbsoluteNotes();
                    return;
                }
            }
            this.pianoKeys = null;
            this.activeAbsoluteNotes = new Set();
            this.pianoWhiteKeys = [];
            this.pianoBlackKeys = [];
            this.displayChordName = this.chordName;
        }
    }

    /**
     * Compute absolute note positions and build display keys.
     * Shows a compact keyboard starting from C, spanning just enough
     * to display all chord tones (typically ~1.2 octaves).
     */
    private computeAbsoluteNotes(): void {
        if (!this.pianoKeys || this.pianoKeys.length === 0) {
            this.activeAbsoluteNotes = new Set();
            this.pianoWhiteKeys = [];
            this.pianoBlackKeys = [];
            return;
        }

        const notes = this.pianoKeys.map(n => ((n % 12) + 12) % 12);
        const root = notes[0];

        // Compute absolute positions (root position voicing)
        const absoluteNotes: number[] = [];
        for (const note of notes) {
            let absolute = note;
            if (absolute < root) {
                absolute += 12;
            }
            absoluteNotes.push(absolute);
        }
        this.activeAbsoluteNotes = new Set(absoluteNotes);

        this.bassAbsoluteNote = null;
        if (this.parsedBass) {
            const bassSemitone = this.noteToSemitone[this.parsedBass] ?? -1;
            if (bassSemitone >= 0) {
                this.bassAbsoluteNote = bassSemitone;
                this.activeAbsoluteNotes.add(bassSemitone);
            }
        }

        // Determine display range: start from 0 (C), end just past the highest note
        const maxNote = Math.max(...this.activeAbsoluteNotes);
        // Find the next white note after maxNote to end cleanly
        const endNote = this.getNextWhiteNoteAfter(maxNote);

        // Build white keys from 0 to endNote
        this.pianoWhiteKeys = [];
        let whiteKeyIndex = 0;
        for (let n = 0; n <= endNote; n++) {
            if (this.whiteNotesInOctave.includes(n % 12)) {
                this.pianoWhiteKeys.push({ note: n });
                whiteKeyIndex++;
            }
        }

        // Build black keys
        this.pianoBlackKeys = [];
        // For each white key position, check if there's a black key after it
        for (let i = 0; i < this.pianoWhiteKeys.length; i++) {
            const whiteNote = this.pianoWhiteKeys[i].note;
            const blackNote = whiteNote + 1;
            if (blackNote <= endNote && this.blackNotesInOctave.includes(blackNote % 12)) {
                const octaveStart = Math.floor(blackNote / 12);
                const noteInOctave = blackNote % 12;
                const octaveXOffset = octaveStart * 140; // 7 white keys * 20px
                this.pianoBlackKeys.push({
                    x: octaveXOffset + this.blackKeyOffsets[noteInOctave],
                    note: blackNote
                });
            }
        }

        // Set display width based on number of white keys
        this.pianoDisplayWidth = this.pianoWhiteKeys.length * 20;

    }

    /**
     * Find the next white note at or after the given note number.
     */
    private getNextWhiteNoteAfter(note: number): number {
        let n = note + 1;
        while (!this.whiteNotesInOctave.includes(n % 12)) {
            n++;
        }
        return n;
    }

    /**
     * Generate variations of the chord name to try matching against the DB.
     * Returns array in order of preference: exact → normalized → simplified extensions → root only.
     */
    private getChordVariations(chord: string): string[] {
        const variations: string[] = [];

        // 1. Exact match (as received, e.g. "Am7b5", "CΔ7", "G7(b9)")
        variations.push(chord);

        // 2. Normalized name via parser — handles Δ, °, ø, +, parentheses, min→m, M7→maj7 …
        //    e.g. "CΔ7" → "Cmaj7",  "G7(b9)" → "G7b9",  "Cmin7" → "Cm7"
        const parsed = parseChord(chord);
        if (parsed?.normalizedName && !variations.includes(parsed.normalizedName)) {
            variations.push(parsed.normalizedName);
        }

        // 3. Try progressive simplifications (strip extensions one by one)
        if (parsed) {
            const { root, suffix, bass } = parsed;

            // Without bass note (e.g. "Am7/C" → "Am7")
            if (bass) {
                const withoutBass = root + suffix;
                if (!variations.includes(withoutBass)) variations.push(withoutBass);
            }

            // Enharmonic equivalent (e.g. G#m7 → Abm7, Fm/Ab → Fm/G#)
            const altRoot = enharmonicRoot(root);
            if (altRoot) {
                const enharmonicName = altRoot + suffix + (bass ? '/' + bass : '');
                if (!variations.includes(enharmonicName)) variations.push(enharmonicName);
                if (bass) {
                    const altBass = enharmonicRoot(bass);
                    if (altBass) {
                        const bothAlt = altRoot + suffix + '/' + altBass;
                        if (!variations.includes(bothAlt)) variations.push(bothAlt);
                        const origWithAltBass = root + suffix + '/' + altBass;
                        if (!variations.includes(origWithAltBass)) variations.push(origWithAltBass);
                    }
                }
            } else if (bass) {
                const altBass = enharmonicRoot(bass);
                if (altBass) {
                    const origWithAltBass = root + suffix + '/' + altBass;
                    if (!variations.includes(origWithAltBass)) variations.push(origWithAltBass);
                }
            }

            // Simplified suffixes (e.g. "m7b5" → ["m7b5","m7","m",""])
            if (suffix) {
                for (const simpleSuffix of this.simplifySuffix(suffix)) {
                    const candidate = root + simpleSuffix + (bass ? '/' + bass : '');
                    if (!variations.includes(candidate)) variations.push(candidate);
                }
            }

            // 4. Ultimate fallback: root + m (if minor quality) or just root
            const basicSimple = simplifyChord(chord);
            if (!variations.includes(basicSimple)) variations.push(basicSimple);
        }

        return variations;
    }

    /**
     * Simplify chord suffix progressively
     * E.g., "m7b5" -> ["m7b5", "m7", "m"]
     */
    private simplifySuffix(suffix: string): string[] {
        const results: string[] = [suffix];

        // Common patterns to try removing
        const patterns = [
            /b5$/,      // remove b5
            /\#5$/,     // remove #5
            /b9$/,      // remove b9
            /\#9$/,     // remove #9
            /11$/,      // remove 11
            /13$/,      // remove 13
            /9$/,       // remove 9
            /add9$/,    // remove add9
            /6$/,       // remove 6
        ];

        let current = suffix;
        for (const pattern of patterns) {
            if (pattern.test(current)) {
                current = current.replace(pattern, '');
                if (current && !results.includes(current)) {
                    results.push(current);
                }
            }
        }

        // If it's a 7th chord variant, try just the base quality
        if (/7/.test(suffix)) {
            const without7 = suffix.replace(/7.*$/, '');
            if (without7 && !results.includes(without7)) {
                results.push(without7);
            }
        }

        // If it has 'm' or 'min', make sure we try just 'm'
        if (/m|min/.test(suffix) && !results.includes('m')) {
            results.push('m');
        }

        // Empty suffix (major)
        if (!results.includes('')) {
            results.push('');
        }

        return results;
    }

    // Returns the lowest active fret (> 0) in the chord — used for position label
    getMinActiveFret(): number {
        if (!this.guitarChord) return 1;
        const active = this.guitarChord.frets.filter(f => f > 0);
        return active.length > 0 ? Math.min(...active) : 1;
    }

    // Helpers for Guitar SVG
    getStringX(stringIndex: number): number {
        return 10 + stringIndex * 10;
    }

    getFretY(fretIndex: number): number {
        return 10 + fretIndex * 12;
    }

    isMuted(stringIndex: number): boolean {
        return this.guitarChord ? this.guitarChord.frets[stringIndex] === -1 : false;
    }

    isOpen(stringIndex: number): boolean {
        return this.guitarChord ? this.guitarChord.frets[stringIndex] === 0 : false;
    }

    getFingerY(stringIndex: number): number {
        if (!this.guitarChord) return 0;
        const fret = this.guitarChord.frets[stringIndex];
        return this.getFretY(fret) - 6;
    }

    // Helper for Piano SVG
    isKeyActiveAbsolute(note: number): boolean {
        return this.activeAbsoluteNotes.has(note);
    }

    getPianoKeyFill(note: number, isBlack: boolean): string {
        if (!this.isKeyActiveAbsolute(note)) return isBlack ? 'black' : 'white';
        return '#ddff53'; // all active notes (including bass) get accent yellow
    }

    getPianoBassDotFill(note: number, isBlack: boolean): string {
        return this.getPianoKeyFill(note, isBlack) === 'black' ? '#ddff53' : '#000000';
    }

    /**
     * Returns the string index (0=low E … 5=high e) that produces the bass note,
     * or null if the bass note is not found in the current guitar voicing.
     */
    getBassStringIndex(): number | null {
        if (!this.guitarChord || !this.parsedBass) return null;
        const bassSemitone = this.noteToSemitone[this.parsedBass] ?? -1;
        if (bassSemitone < 0) return null;
        const openStrings = [4, 9, 2, 7, 11, 4]; // E A D G B e
        for (let i = 0; i < 6; i++) {
            if (this.guitarChord.frets[i] < 0) continue; // muted
            if ((openStrings[i] + this.guitarChord.frets[i]) % 12 === bassSemitone) return i;
        }
        return null;
    }

    getUkuBassStringIndex(): number | null {
        if (!this.ukuleleChord || !this.parsedBass) return null;
        const bassSemitone = this.noteToSemitone[this.parsedBass] ?? -1;
        if (bassSemitone < 0) return null;
        const openStrings = [7, 0, 4, 9]; // G C E A
        for (let i = 0; i < 4; i++) {
            if (this.ukuleleChord.frets[i] < 0) continue;
            if ((openStrings[i] + this.ukuleleChord.frets[i]) % 12 === bassSemitone) return i;
        }
        return null;
    }

    // Helpers for Barre (guitar)
    getBarreX(barre: any): number {
        const firstStringIndex = Math.min(6 - barre.fromString, 6 - barre.toString);
        return this.getStringX(firstStringIndex) - 4;
    }

    getBarreWidth(barre: any): number {
        const stringSpan = Math.abs(barre.fromString - barre.toString);
        return stringSpan * 10 + 8;
    }

    isGuitarStringCoveredByBarre(stringIndex: number, fret: number): boolean {
        if (!this.guitarChord?.barres) return false;
        const guitarStringNumber = 6 - stringIndex;

        return this.guitarChord.barres.some(barre => {
            const firstString = Math.min(barre.fromString, barre.toString);
            const lastString = Math.max(barre.fromString, barre.toString);
            return barre.fret === fret
                && guitarStringNumber >= firstString
                && guitarStringNumber <= lastString;
        });
    }

    // Helpers for Ukulele SVG (4 strings, spacing 14px, start x=10)
    getUkuStringX(i: number): number { return 10 + i * 14; }
    getUkuFretY(fret: number): number { return 10 + fret * 12; }

    getUkuBarreX(barre: any): number {
        const minS = Math.min(barre.fromString, barre.toString);
        return 10 + minS * 14 - 4;
    }

    getUkuBarreWidth(barre: any): number {
        const diff = Math.abs(barre.fromString - barre.toString);
        return diff * 14 + 8;
    }

    getUkuMinActiveFret(): number {
        if (!this.ukuleleChord) return 1;
        const active = this.ukuleleChord.frets.filter(f => f > 0);
        return active.length > 0 ? Math.min(...active) : 1;
    }
}
