import { extractChords, isChord, isChordLine, parseChord, simplifyChord, transposeChord } from './music-utils';

describe('music-utils bidi controls', () => {
    const controls = [
        '\u061c',
        '\u200e',
        '\u200f',
        '\u202a',
        '\u202b',
        '\u202c',
        '\u202d',
        '\u202e',
        '\u2066',
        '\u2067',
        '\u2068',
        '\u2069',
    ];
    const roots = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const suffixes = [
        '',
        'm',
        '7',
        'maj7',
        '7+',
        'm7',
        'dim',
        'dim7',
        'aug',
        '+',
        'sus2',
        'sus4',
        'add9',
        '9',
        '11',
        '13',
        '7b9',
        '7#9',
        'm7b5',
        '/E',
        'maj7/B',
    ];

    it('recognizes every supported chord family with bidi controls around and inside it', () => {
        for (const root of roots) {
            for (const suffix of suffixes) {
                const chord = root + suffix;
                expect(isChord(chord)).withContext(`baseline: ${chord}`).toBeTrue();

                for (const control of controls) {
                    expect(isChord(control + chord)).withContext(`leading control: ${chord}`).toBeTrue();
                    expect(isChord(chord + control)).withContext(`trailing control: ${chord}`).toBeTrue();
                    expect(isChord(root + control + suffix)).withContext(`inner control: ${chord}`).toBeTrue();
                }
            }
        }
    });

    it('recognizes and extracts complete copied chord lines with bidi controls', () => {
        for (const control of controls) {
            const line = `${control}C7+${control}    F#m7b5${control}    Bbmaj7/D`;

            expect(isChordLine(line)).withContext(`control U+${control.codePointAt(0)?.toString(16)}`).toBeTrue();
            expect(extractChords(line)).toEqual(['C7+', 'F#m7b5', 'Bbmaj7/D']);
        }
    });

    it('keeps parsing, transposition and simplification consistent after copied bidi controls', () => {
        expect(parseChord('\u200eC7+\u200f')?.normalizedName).toBe('Cmaj7');
        expect(transposeChord('\u200eF#m7b5\u200f', 2)).toBe('G#m7b5');
        expect(simplifyChord('\u202aBbmaj7/D\u202c')).toBe('Bb');
    });
});
