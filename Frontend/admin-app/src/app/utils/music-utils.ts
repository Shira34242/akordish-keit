// music-utils.ts

const sharpScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flatScale  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const allNotes: { [key: string]: number } = {
    'C': 0, 'B#': 0,
    'C#': 1, 'Db': 1,
    'D': 2,
    'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4,
    'F': 5, 'E#': 5,
    'F#': 6, 'Gb': 6,
    'G': 7,
    'G#': 8, 'Ab': 8,
    'A': 9,
    'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11
};

// ===================================================================
// LEGACY regex — kept for reference/comparison only.
// Do NOT use for new features; use parseChord() instead.
// ===================================================================
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CHORD_REGEX_LEGACY = /^[A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[0-9]+|M[0-9]*|\d+|b\d+|#\d+)*(?:\/[A-G][#b]?)?$/i;

// ===================================================================
// STAGE 1 — Structured chord parser
// ===================================================================

/** Semantic quality of the chord, derived from its suffix. */
export type ChordQuality =
    | 'major'     // C, Cmaj
    | 'minor'     // Cm
    | 'dominant'  // C7  (major triad + minor 7th)
    | 'major7'    // Cmaj7  (major triad + major 7th)
    | 'minor7'    // Cm7
    | 'dim'       // Cdim  (diminished triad)
    | 'dim7'      // Cdim7 (fully diminished 7th)
    | 'halfDim'   // Cm7b5 / Cø7 (half-diminished)
    | 'aug'       // Caug / C+
    | 'sus2'
    | 'sus4'
    | 'sus'
    | 'unknown';

/**
 * Full structured representation of a chord.
 *
 * Backward-compatible note:
 *   .root    — full root WITH accidental ("F#", "Bb", "C") — same as old interface
 *   .suffix  — normalized suffix string without root/bass — same as old interface
 *   .bass    — bass note without slash — same as old interface
 *
 * New fields: accidental, quality, extensions, modifiers, normalizedName, raw
 */
export interface ParsedChord {
    raw:            string;           // original input before any normalization
    root:           string;           // full root incl. accidental: "F#", "Bb", "C"
    accidental:     '#' | 'b' | null; // accidental part only
    quality:        ChordQuality;
    extensions:     number[];         // plain numeric extensions beyond the quality: [9], [11, 13]
    modifiers:      string[];         // alterations: ['b5', '#9', 'add9', 'maj7']
    bass:           string | null;    // bass note without slash, e.g. "E" in "C/E"
    normalizedName: string;           // canonical lookup key: "G7b9", "Cmaj7", "F#m7b5"
    suffix:         string;           // quality+ext+mod as string — backward compat for transposeChord
}

// -------------------------------------------------------------------
// normalizeChordInput
// -------------------------------------------------------------------

/**
 * Pre-process a raw chord string before structural parsing.
 *
 * Handles:
 *  - Parentheses:  G7(b9) → G7b9,  C(add9) → Cadd9,  Am(maj7) → Ammaj7
 *  - Δ / Δ7        → maj7
 *  - ° / °7        → dim / dim7
 *  - ø / ø7        → m7b5
 *  - +             → aug
 *  - o / o7        → dim / dim7  (letter "o" at start of suffix)
 *  - min           → m           (prefix)
 *  - M7 / Maj      → maj7 / maj  (suffix casing)
 */
export function normalizeChordInput(raw: string): string {
    if (!raw) return raw;
    let s = raw.trim();

    // 1. Flatten parentheses inline
    s = s.replace(/\(([^)]+)\)/g, '$1');

    // 2. Identify root to protect it during suffix transformations
    const rootMatch = s.match(/^[A-G][#b]?/);
    if (!rootMatch) return raw; // not a chord root — return as-is

    const root = rootMatch[0];
    let rest   = s.slice(root.length);

    // 3. Preserve bass note (everything from first '/')
    let bass = '';
    const slashIdx = rest.indexOf('/');
    if (slashIdx !== -1) {
        bass = rest.slice(slashIdx);
        rest = rest.slice(0, slashIdx);
    }

    // 4. Alias substitutions on suffix (longest patterns first)
    rest = rest
        .replace(/Δ7/g,            'maj7')  // Δ7 → maj7  (Δ already implies 7)
        .replace(/Δ/g,             'maj7')  // Δ  → maj7
        .replace(/°7/g,            'dim7')  // °7 → dim7
        .replace(/°/g,             'dim')   // °  → dim
        .replace(/ø7/g,            'm7b5')  // ø7 → m7b5
        .replace(/ø/g,             'm7b5')  // ø  → m7b5
        .replace(/\+/g,            'aug')   // +  → aug
        .replace(/^o7/,            'dim7')  // o7 → dim7  (letter o, only at suffix start)
        .replace(/^o(?=[^a-z]|$)/, 'dim')   // o  → dim   (isolated, at suffix start)
        .replace(/^min/,           'm')     // min… → m…
        .replace(/major/gi,        'maj')   // major → maj
        .replace(/^M7/,            'maj7')  // M7 → maj7
        .replace(/^Maj/,           'maj');  // Maj → maj

    return root + rest + bass;
}

// -------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------

/** Map ChordQuality to its canonical suffix string. */
function qualityString(q: ChordQuality): string {
    switch (q) {
        case 'major':    return '';
        case 'minor':    return 'm';
        case 'dominant': return '7';
        case 'major7':   return 'maj7';
        case 'minor7':   return 'm7';
        case 'dim':      return 'dim';
        case 'dim7':     return 'dim7';
        case 'halfDim':  return 'm7b5';
        case 'aug':      return 'aug';
        case 'sus2':     return 'sus2';
        case 'sus4':     return 'sus4';
        case 'sus':      return 'sus';
        default:         return '';
    }
}

/** Parse a normalized suffix string into quality, extensions, and modifiers. */
function parseSuffix(s: string): { quality: ChordQuality; extensions: number[]; modifiers: string[] } {
    let quality: ChordQuality = 'major';
    const extensions: number[] = [];
    const modifiers: string[]  = [];

    // Determine base quality from prefix (longer patterns checked first)
    if      (s.startsWith('maj7'))  { quality = 'major7';  s = s.slice(4); }
    // maj9 / maj11 / maj13 — large extension on a major-7 base (musically implies maj7)
    else if (s.startsWith('maj') && /^\d/.test(s[3] ?? '')) { quality = 'major7'; s = s.slice(3); }
    else if (s.startsWith('maj'))   { quality = 'major';   s = s.slice(3); }
    else if (s.startsWith('m7b5')) { quality = 'halfDim'; s = s.slice(4); }
    else if (s.startsWith('dim7')) { quality = 'dim7';    s = s.slice(4); }
    else if (s.startsWith('dim'))  { quality = 'dim';     s = s.slice(3); }
    else if (s.startsWith('aug'))  { quality = 'aug';     s = s.slice(3); }
    else if (s.startsWith('sus2')) { quality = 'sus2';    s = s.slice(4); }
    else if (s.startsWith('sus4')) { quality = 'sus4';    s = s.slice(4); }
    else if (s.startsWith('sus'))  { quality = 'sus';     s = s.slice(3); }
    else if (s.startsWith('m'))    { quality = 'minor';   s = s.slice(1); }

    // Parse remaining extensions and modifiers
    while (s.length > 0) {
        let matched = false;

        // add9 / add11 / add13 …
        const addM = s.match(/^add(\d+)/);
        if (addM) {
            modifiers.push('add' + addM[1]);
            s = s.slice(addM[0].length);
            matched = true;
            continue;
        }

        // maj7 after minor base = minor-major 7th chord
        if (s.startsWith('maj7')) { modifiers.push('maj7'); s = s.slice(4); matched = true; continue; }
        if (s.startsWith('maj'))  { modifiers.push('maj');  s = s.slice(3); matched = true; continue; }

        // b5, b9, b13 …
        const flatM = s.match(/^b(\d+)/);
        if (flatM) {
            modifiers.push('b' + flatM[1]);
            s = s.slice(flatM[0].length);
            matched = true;
            continue;
        }

        // #5, #9, #11 …
        const sharpM = s.match(/^#(\d+)/);
        if (sharpM) {
            modifiers.push('#' + sharpM[1]);
            s = s.slice(sharpM[0].length);
            matched = true;
            continue;
        }

        // trailing sus modifiers (e.g. 7sus4)
        if (s.startsWith('sus4')) { modifiers.push('sus4'); s = s.slice(4); matched = true; continue; }
        if (s.startsWith('sus2')) { modifiers.push('sus2'); s = s.slice(4); matched = true; continue; }
        if (s.startsWith('sus'))  { modifiers.push('sus');  s = s.slice(3); matched = true; continue; }

        // plain extension number: 6, 7, 9, 11, 13 …
        const numM = s.match(/^(\d+)/);
        if (numM) {
            extensions.push(parseInt(numM[1], 10));
            s = s.slice(numM[0].length);
            matched = true;
            continue;
        }

        if (!matched) { s = s.slice(1); } // skip unknown character
    }

    // Consolidate: minor + 7 in extensions → minor7; major + 7 → dominant
    const i7minor = extensions.indexOf(7);
    if (quality === 'minor' && i7minor !== -1) {
        quality = 'minor7';
        extensions.splice(i7minor, 1);
    }
    const i7major = extensions.indexOf(7);
    if (quality === 'major' && i7major !== -1) {
        quality = 'dominant';
        extensions.splice(i7major, 1);
    }

    return { quality, extensions, modifiers };
}

// -------------------------------------------------------------------
// buildNormalizedName
// -------------------------------------------------------------------

/**
 * Build a canonical chord name from its parsed components.
 * This is the key used for chord database lookups and display.
 *
 * @param root       — full root with accidental ("F#", "Bb", "C")
 * @param quality
 * @param extensions — plain numeric extensions
 * @param modifiers  — alterations and additions
 * @param bass       — bass note without slash, or null
 */
export function buildNormalizedName(
    root:       string,
    quality:    ChordQuality,
    extensions: number[],
    modifiers:  string[],
    bass:       string | null
): string {
    return (
        root
        + qualityString(quality)
        + extensions.map(String).join('')
        + modifiers.join('')
        + (bass ? '/' + bass : '')
    );
}

// -------------------------------------------------------------------
// parseChord — upgraded, backward-compatible
// -------------------------------------------------------------------

/**
 * Parse a chord string into a full ParsedChord structure.
 *
 * Backward-compatible: callers that use only .root / .suffix / .bass
 * (e.g. chord-tooltip, transposeChord) continue to work unchanged.
 *
 * New: .quality / .extensions / .modifiers / .normalizedName / .accidental / .raw
 */
export function parseChord(chord: string): ParsedChord | null {
    if (!chord) return null;
    const raw = chord.trim();
    if (!raw) return null;

    // Pre-process aliases and parentheses
    const normalized = normalizeChordInput(raw);

    // Extract root letter + accidental
    const rootFull = normalized.match(/^([A-G])([#b]?)/);
    if (!rootFull) return null;

    const rootLetter = rootFull[1];
    const accRaw     = rootFull[2];
    const accidental: '#' | 'b' | null = accRaw === '#' ? '#' : accRaw === 'b' ? 'b' : null;
    const root       = rootLetter + (accRaw ?? ''); // "F#", "Bb", "C" — backward compat

    let rest = normalized.slice(rootFull[0].length);

    // Separate bass note
    let bass: string | null = null;
    const slashIdx = rest.indexOf('/');
    if (slashIdx !== -1) {
        bass = rest.slice(slashIdx + 1) || null;
        rest = rest.slice(0, slashIdx);
    }

    // Parse the suffix
    const { quality, extensions, modifiers } = parseSuffix(rest);

    // Build normalized suffix string (quality + extensions + modifiers)
    const suffix = qualityString(quality)
                 + extensions.map(String).join('')
                 + modifiers.join('');

    const normalizedName = buildNormalizedName(root, quality, extensions, modifiers, bass);

    return {
        raw,
        root,        // "F#" — backward compat (includes accidental)
        accidental,  // "#"  — new field
        quality,
        extensions,
        modifiers,
        bass,
        normalizedName,
        suffix,      // backward compat (no root, no bass)
    };
}

// -------------------------------------------------------------------
// isChordLegacy — old regex-based check, kept for comparison
// -------------------------------------------------------------------

/** @deprecated Use isChord() — kept only for comparison/testing. */
export function isChordLegacy(token: string = ''): boolean {
    if (!token || typeof token !== 'string') return false;
    return CHORD_REGEX_LEGACY.test(token.trim());
}

// -------------------------------------------------------------------
// isChord — parser-based (replaces old regex version)
// -------------------------------------------------------------------

/**
 * Check if a string is a valid chord symbol.
 *
 * Now based on the structural parser — recognises everything the old
 * regex did, plus: Δ, °, ø, +, parentheses notation, and complex
 * extensions that the old regex missed.
 */
export function isChord(token: string = ''): boolean {
    if (!token || typeof token !== 'string') return false;
    const stripped = token.trim();
    if (!stripped) return false;
    if (!/^[A-G]/.test(stripped)) return false; // fast pre-check
    const parsed = parseChord(stripped);
    return parsed !== null && parsed.quality !== 'unknown';
}

// -------------------------------------------------------------------
// Unchanged helpers (tokenize, isChordLine, extractChords, ParsedLine)
// -------------------------------------------------------------------

function tokenize(line: string): string[] {
    return line ? line.trim().split(/[\s|]+/).filter(Boolean) : [];
}

export function isChordLine(line: string): boolean {
    const tokens = tokenize(line);
    return tokens.length > 0 && tokens.every(token => isChord(token));
}

export function extractChords(line: string): string[] {
    return tokenize(line).filter(token => isChord(token));
}

export interface ParsedLine {
    type: 'chords' | 'lyrics' | 'empty';
    content: string;
}

export function parseConsecutiveChordLines(lines: string[]): ParsedLine[] {
    return lines.map(line => {
        const tokens = line.trim().split(/\s+/).filter(tok => tok !== '|' && tok.trim() !== '');
        if (tokens.length === 0) return { type: 'empty', content: '' };
        const isChords = tokens.every(tok => isChord(tok));
        return { type: isChords ? 'chords' : 'lyrics', content: line };
    });
}

// -------------------------------------------------------------------
// Transposition (unchanged logic, normalization added at entry point)
// -------------------------------------------------------------------

function transposeSingleNote(note: string, semitones: number, preferFlat = false): string {
    if (!note) return note;
    const midi = allNotes[note];
    if (midi === undefined) return note;
    const newMidi = (midi + semitones + 12) % 12;
    return preferFlat ? flatScale[newMidi] : sharpScale[newMidi];
}

function buildChord(args: { root: string; suffix: string; bass: string | null }): string {
    return args.root + (args.suffix || '') + (args.bass ? '/' + args.bass : '');
}

/**
 * Transpose a chord symbol by the given number of semitones.
 *
 * Stage-1 addition: normalizeChordInput() is called first, so symbols
 * like CΔ7, C°, Cø7, C+, G7(b9) are handled transparently.
 * The transpose logic itself is unchanged.
 */
export function transposeChord(
    symbol:   string,
    semitones = 0,
    options:  { preferFlat?: boolean } = {}
): string {
    if (!symbol || semitones === 0) return symbol;

    const { preferFlat = false } = options;
    const originalSymbol = symbol.trim();

    // Normalize before processing (new in stage 1)
    const normalizedSymbol = normalizeChordInput(originalSymbol);

    const parsed = parseChord(normalizedSymbol);
    if (!parsed || parsed.quality === 'unknown') return originalSymbol;

    const newRoot = transposeSingleNote(parsed.root, semitones, preferFlat);
    const newBass = parsed.bass ? transposeSingleNote(parsed.bass, semitones, preferFlat) : null;

    return buildChord({ root: newRoot, suffix: parsed.suffix, bass: newBass });
}

// -------------------------------------------------------------------
// analyzePreferFlat — unchanged
// -------------------------------------------------------------------

export function analyzePreferFlat(lyrics: string, originalKey: string): boolean {
    if (originalKey) {
        const keyRoot = originalKey.replace(/m$/, '');
        if (keyRoot.includes('b')) return true;
        if (keyRoot.includes('#')) return false;
    }
    if (!lyrics) return false;
    const flatCount  = (lyrics.match(/[A-G]b/g) || []).length;
    const sharpCount = (lyrics.match(/[A-G]#/g) || []).length;
    return flatCount > sharpCount;
}

// -------------------------------------------------------------------
// simplifyChord — updated to use new ParsedChord fields
// -------------------------------------------------------------------

/**
 * Simplify a chord to its beginner-friendly form.
 *
 * Rules:
 *  - minor, minor7, dim, dim7, halfDim (m7b5)  → root + m   (keep minor quality)
 *  - dominant (7)                                → root + 7   (strip modifiers/extensions)
 *  - major + numeric extensions ≥ 9 (G9, G13)  → root + 7   (implied dominant)
 *  - major7, aug, sus2, sus4, sus               → root only
 *  - major + add9/add11 modifiers               → root only
 *  - plain major, plain minor                   → unchanged
 *  - Slash chords: simplify root part, keep bass note
 *
 * Examples:
 *  Cmaj7 → C,  Cadd9 → C,  Gsus4 → G,  Caug → C
 *  Bm7b5 → Bm, Cdim → Cm,  F#m7 → F#m
 *  G7b9 → G7,  G13 → G7,   G9 → G7
 *  Cmaj7/B → C/B,  Bm7b5/F → Bm/F
 */
export function simplifyChord(symbol = ''): string {
    if (!symbol) return symbol;
    const parsed = parseChord(symbol);
    if (!parsed) return symbol;

    const { root, quality, extensions, bass } = parsed;

    let simplifiedSuffix: string;

    switch (quality) {
        case 'minor':
            simplifiedSuffix = 'm';
            break;
        case 'dominant':
            // Strip all extensions/modifiers — keep just the 7th
            simplifiedSuffix = '7';
            break;
        case 'minor7':
        case 'dim':
        case 'dim7':
        case 'halfDim':
            // Reduce to plain minor
            simplifiedSuffix = 'm';
            break;
        case 'major7':
        case 'aug':
        case 'sus2':
        case 'sus4':
        case 'sus':
            // Reduce to root
            simplifiedSuffix = '';
            break;
        case 'major':
        default:
            // Major with large numeric extensions (9, 11, 13) → implied dominant → 7
            simplifiedSuffix = extensions.some(e => e >= 9) ? '7' : '';
            break;
    }

    return root + simplifiedSuffix + (bass ? '/' + bass : '');
}

// -------------------------------------------------------------------
// easyChord — unchanged
// -------------------------------------------------------------------

export function easyChord(symbol: string, semitones = 0, preferFlat = false): string {
    if (semitones !== 0) return transposeChord(symbol, semitones, { preferFlat });
    return simplifyChord(symbol);
}

// ===================================================================
// STAGE 1: Test suite
// Call runChordTests() in the browser console to verify the parser.
// ===================================================================

interface ChordTestCase {
    input:              string;
    expectedNormalized: string;
    expectedQuality:    ChordQuality;
}

const CHORD_TEST_CASES: ChordTestCase[] = [
    // Basic qualities
    { input: 'C',          expectedNormalized: 'C',       expectedQuality: 'major'    },
    { input: 'Cm',         expectedNormalized: 'Cm',      expectedQuality: 'minor'    },
    { input: 'C7',         expectedNormalized: 'C7',      expectedQuality: 'dominant' },
    { input: 'Cmaj7',      expectedNormalized: 'Cmaj7',   expectedQuality: 'major7'   },
    { input: 'Cm7',        expectedNormalized: 'Cm7',     expectedQuality: 'minor7'   },
    { input: 'Cdim',       expectedNormalized: 'Cdim',    expectedQuality: 'dim'      },
    { input: 'Caug',       expectedNormalized: 'Caug',    expectedQuality: 'aug'      },
    { input: 'Csus2',      expectedNormalized: 'Csus2',   expectedQuality: 'sus2'     },
    { input: 'Csus4',      expectedNormalized: 'Csus4',   expectedQuality: 'sus4'     },
    // Parentheses notation
    { input: 'G7(b9)',     expectedNormalized: 'G7b9',    expectedQuality: 'dominant' },
    { input: 'C(add9)',    expectedNormalized: 'Cadd9',   expectedQuality: 'major'    },
    { input: 'Am(maj7)',   expectedNormalized: 'Ammaj7',  expectedQuality: 'minor'    },
    // Special-character aliases
    { input: 'CΔ7',        expectedNormalized: 'Cmaj7',   expectedQuality: 'major7'   },
    { input: 'CΔ',         expectedNormalized: 'Cmaj7',   expectedQuality: 'major7'   },
    { input: 'C°',         expectedNormalized: 'Cdim',    expectedQuality: 'dim'      },
    { input: 'C°7',        expectedNormalized: 'Cdim7',   expectedQuality: 'dim7'     },
    { input: 'Cø7',        expectedNormalized: 'Cm7b5',   expectedQuality: 'halfDim'  },
    { input: 'C+',         expectedNormalized: 'Caug',    expectedQuality: 'aug'      },
    // Half-diminished
    { input: 'Cm7b5',      expectedNormalized: 'Cm7b5',   expectedQuality: 'halfDim'  },
    { input: 'F#m7b5',     expectedNormalized: 'F#m7b5',  expectedQuality: 'halfDim'  },
    // add chords
    { input: 'Cadd9',      expectedNormalized: 'Cadd9',   expectedQuality: 'major'    },
    // Slash chords
    { input: 'C/E',        expectedNormalized: 'C/E',     expectedQuality: 'major'    },
    // Flat-root chords
    { input: 'Bb7',        expectedNormalized: 'Bb7',     expectedQuality: 'dominant' },
    // Sharp-root chords
    { input: 'F#m',        expectedNormalized: 'F#m',     expectedQuality: 'minor'    },
    // maj9 / maj11 / maj13 — must be major7 quality (not major)
    { input: 'Cmaj9',      expectedNormalized: 'Cmaj79',  expectedQuality: 'major7'   },
    { input: 'Cmaj11',     expectedNormalized: 'Cmaj711', expectedQuality: 'major7'   },
    { input: 'Cmaj13',     expectedNormalized: 'Cmaj713', expectedQuality: 'major7'   },
    // plain 9 / 11 / 13 stay major (implied dominant handled in simplifyChord)
    { input: 'G9',         expectedNormalized: 'G9',      expectedQuality: 'major'    },
    { input: 'G13',        expectedNormalized: 'G13',     expectedQuality: 'major'    },
    // minor 9 stays minor
    { input: 'Am9',        expectedNormalized: 'Am9',     expectedQuality: 'minor'    },
];

/**
 * Run all chord parser tests. Results appear in the browser console.
 *
 * Usage (browser dev-tools):
 *   import { runChordTests } from 'app/utils/music-utils';
 *   runChordTests();
 */
export function runChordTests(): void {
    console.group('[music-utils stage-1] Chord Parser Tests');
    let passed = 0;
    let failed = 0;

    for (const tc of CHORD_TEST_CASES) {
        const parsed      = parseChord(tc.input);
        const normOk      = parsed?.normalizedName === tc.expectedNormalized;
        const qualityOk   = parsed?.quality       === tc.expectedQuality;
        const ok          = normOk && qualityOk;

        if (ok) {
            console.log(`✅ "${tc.input}" → "${parsed?.normalizedName}" (${parsed?.quality})`);
            passed++;
        } else {
            console.warn(`❌ "${tc.input}"`, {
                expected: { normalized: tc.expectedNormalized, quality: tc.expectedQuality },
                got:      { normalized: parsed?.normalizedName ?? null, quality: parsed?.quality ?? null },
            });
            failed++;
        }
    }

    console.log(`\n${passed}/${CHORD_TEST_CASES.length} passed${failed > 0 ? `, ${failed} failed` : ' — all green ✓'}`);
    console.groupEnd();

    runSimplifyTests();
}

interface SimplifyTestCase { input: string; expected: string; }

const SIMPLIFY_TEST_CASES: SimplifyTestCase[] = [
    // Basic — unchanged
    { input: 'C',         expected: 'C'    },
    { input: 'Am',        expected: 'Am'   },
    { input: 'G7',        expected: 'G7'   },
    // Major extensions → root
    { input: 'Cmaj7',     expected: 'C'    },
    { input: 'Gmaj9',     expected: 'G'    },
    { input: 'Fmaj13',    expected: 'F'    },
    // Minor extensions → minor
    { input: 'Am7',       expected: 'Am'   },
    { input: 'Bm7',       expected: 'Bm'   },
    { input: 'F#m9',      expected: 'F#m'  },
    // add chords → root
    { input: 'Cadd9',     expected: 'C'    },
    { input: 'Amadd9',    expected: 'Am'   },
    // Suspended → root (plain sus) or 7 (7sus)
    { input: 'Csus4',     expected: 'C'    },
    { input: 'Gsus2',     expected: 'G'    },
    { input: 'G7sus4',    expected: 'G7'   },
    // Diminished / half-dim → minor
    { input: 'Cdim',      expected: 'Cm'   },
    { input: 'Cdim7',     expected: 'Cm'   },
    { input: 'Bm7b5',     expected: 'Bm'   },
    // Augmented → root
    { input: 'Caug',      expected: 'C'    },
    // Dominant alterations → 7
    { input: 'G7b9',      expected: 'G7'   },
    { input: 'E7#9',      expected: 'E7'   },
    // Plain extensions on major (implied dominant) → 7
    { input: 'G9',        expected: 'G7'   },
    { input: 'G13',       expected: 'G7'   },
    // Slash chords — simplify root, keep bass
    { input: 'G/B',       expected: 'G/B'  },
    { input: 'Cmaj7/B',   expected: 'C/B'  },
    { input: 'Bm7b5/F#',  expected: 'Bm/F#'},
    // Alias inputs
    { input: 'CΔ7',       expected: 'C'    },
    { input: 'C°',        expected: 'Cm'   },
    { input: 'Cø7',       expected: 'Cm'   },
    { input: 'C+',        expected: 'C'    },
];

export function runSimplifyTests(): void {
    console.group('[music-utils] simplifyChord Tests');
    let passed = 0; let failed = 0;
    for (const tc of SIMPLIFY_TEST_CASES) {
        const got = simplifyChord(tc.input);
        const ok  = got === tc.expected;
        if (ok) { console.log(`✅ simplify("${tc.input}") → "${got}"`); passed++; }
        else    { console.warn(`❌ simplify("${tc.input}"): expected "${tc.expected}", got "${got}"`); failed++; }
    }
    console.log(`\n${passed}/${SIMPLIFY_TEST_CASES.length} passed${failed > 0 ? `, ${failed} failed` : ' — all green ✓'}`);
    console.groupEnd();
}
