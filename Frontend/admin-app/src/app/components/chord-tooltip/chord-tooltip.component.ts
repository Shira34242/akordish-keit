import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GUITAR_CHORDS, PIANO_CHORDS, GuitarChord } from '../../utils/chord-data';
import { simplifyChord, parseChord } from '../../utils/music-utils';

@Component({
    selector: 'app-chord-tooltip',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './chord-tooltip.component.html',
    styleUrls: ['./chord-tooltip.component.css']
})
export class ChordTooltipComponent implements OnChanges {
    @Input() chordName: string = '';
    @Input() instrument: 'guitar' | 'piano' = 'guitar';

    guitarChord: GuitarChord | null = null;
    pianoKeys: number[] | null = null;
    displayChordName: string = ''; // The chord name we're actually displaying

    // Piano: absolute note positions (computed from pianoKeys)
    activeAbsoluteNotes: Set<number> = new Set();

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
        }
    }

    updateChordData() {
        if (!this.chordName) return;

        // Try to find the chord with progressive simplification
        const chordVariations = this.getChordVariations(this.chordName);

        if (this.instrument === 'guitar') {
            this.pianoKeys = null;
            this.activeAbsoluteNotes = new Set();
            this.pianoWhiteKeys = [];
            this.pianoBlackKeys = [];
            // Try each variation until we find a match
            for (const variation of chordVariations) {
                if (GUITAR_CHORDS[variation]) {
                    this.guitarChord = GUITAR_CHORDS[variation];
                    this.displayChordName = variation;
                    return;
                }
            }
            // No match found
            this.guitarChord = null;
            this.displayChordName = this.chordName;
        } else {
            this.guitarChord = null;
            // Try each variation until we find a match
            for (const variation of chordVariations) {
                if (PIANO_CHORDS[variation]) {
                    this.pianoKeys = PIANO_CHORDS[variation];
                    this.displayChordName = variation;
                    this.computeAbsoluteNotes();
                    return;
                }
            }
            // No match found
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

        // Determine display range: start from 0 (C), end just past the highest note
        const maxNote = Math.max(...absoluteNotes);
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
     * Generate variations of the chord name to try matching
     * Returns array in order of preference (exact match -> simplified versions)
     */
    private getChordVariations(chord: string): string[] {
        const variations: string[] = [];

        // 1. Exact match
        variations.push(chord);

        // 2. Normalize common variations (min -> m, maj7 -> maj7, etc.)
        const normalized = chord
            .replace(/min(?!or)/gi, 'm')  // min -> m (but not "minor")
            .replace(/major/gi, 'maj')     // major -> maj
            .replace(/Maj/g, 'maj')        // Maj -> maj
            .replace(/M7/g, 'maj7')        // M7 -> maj7
            .replace(/M(?!aj)/g, 'maj');   // M -> maj (but not Maj)

        if (normalized !== chord) {
            variations.push(normalized);
        }

        // 3. Try with simplified extensions
        // For complex chords like Cm7b5, try Cm7, then Cm
        const parsed = parseChord(chord);
        if (parsed) {
            const root = parsed.root;
            const suffix = parsed.suffix;
            const bass = parsed.bass;

            // Try without bass note
            if (bass) {
                const withoutBass = root + suffix;
                variations.push(withoutBass);
            }

            // Try common simplifications of the suffix
            if (suffix) {
                // Remove numbers after certain patterns
                const simplifiedSuffixes = this.simplifySuffix(suffix);
                for (const simpleSuffix of simplifiedSuffixes) {
                    const simpleChord = root + simpleSuffix + (bass ? '/' + bass : '');
                    if (!variations.includes(simpleChord)) {
                        variations.push(simpleChord);
                    }
                }
            }

            // 4. Ultimate fallback: just root + m if minor, or just root
            const basicSimple = simplifyChord(chord);
            if (!variations.includes(basicSimple)) {
                variations.push(basicSimple);
            }
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

    // Helpers for Barre
    getBarreX(barre: any): number {
        const minString = Math.min(barre.fromString, barre.toString);
        return 10 + minString * 10 - 4;
    }

    getBarreWidth(barre: any): number {
        const diff = Math.abs(barre.fromString - barre.toString);
        return diff * 10 + 8;
    }
}
