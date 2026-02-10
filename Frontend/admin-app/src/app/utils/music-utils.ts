// music-utils.ts

const sharpScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flatScale = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

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

// Regex לזיהוי אקורד תקין
const CHORD_REGEX = /^[A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[0-9]+|M[0-9]*|\d+|b\d+|#\d+)*(?:\/[A-G][#b]?)?$/i;

// פונקציה לבדיקה האם מחרוזת היא אקורד
export function isChord(token: string = ''): boolean {
    if (!token || typeof token !== 'string') return false;
    const stripped = token.trim();
    if (!stripped) return false;
    return CHORD_REGEX.test(stripped);
}

// פונקציה לפיצול שורה למילים
function tokenize(line: string): string[] {
    return line ? line.trim().split(/[\s|]+/).filter(Boolean) : [];
}

// פונקציה לבדיקה האם שורה שלמה היא שורת אקורדים
export function isChordLine(line: string): boolean {
    const tokens = tokenize(line);
    return tokens.length > 0 && tokens.every(token => isChord(token));
}

// פונקציה לחילוץ אקורדים משורה
export function extractChords(line: string): string[] {
    return tokenize(line).filter(token => isChord(token));
}

// ממשק לשורה מפוענחת
export interface ParsedLine {
    type: 'chords' | 'lyrics' | 'empty';
    content: string;
}

// פונקציה לניתוח שורות רצופות
export function parseConsecutiveChordLines(lines: string[]): ParsedLine[] {
    return lines.map(line => {
        const tokens = line.trim().split(/\s+/).filter(tok => tok !== '|' && tok.trim() !== '');
        
        if (tokens.length === 0) {
            return { type: 'empty', content: '' };
        }
        
        const isChords = tokens.every(tok => isChord(tok));
        return { 
            type: isChords ? 'chords' : 'lyrics', 
            content: line 
        };
    });
}

// טרנספוזיציה של תו בודד
function transposeSingleNote(note: string, semitones: number, preferFlat: boolean = false): string {
    if (!note) return note;
    
    const midi = allNotes[note];
    if (midi === undefined) return note;

    const newMidi = (midi + semitones + 12) % 12;
    
    if (preferFlat) {
        return flatScale[newMidi];
    }
    return sharpScale[newMidi];
}

// ממשק לאקורד מפורק
interface ParsedChord {
    root: string;
    suffix: string;
    bass: string | null;
}

// פיענוח אקורד לחלקים
export function parseChord(chord: string): ParsedChord | null {
    if (!chord) return null;
    const chordRegex = /^([A-G][#b]?)([^/]*?)(\/[A-G][#b]?)?$/;
    const match = chord.match(chordRegex);
    
    if (!match) return null;
    
    return {
        root: match[1],
        suffix: match[2] || '',
        bass: match[3] ? match[3].substring(1) : null
    };
}

// בניית אקורד מחלקים
function buildChord(parsed: ParsedChord): string {
    let result = parsed.root + (parsed.suffix || '');
    if (parsed.bass) {
        result += '/' + parsed.bass;
    }
    return result;
}

// טרנספוזיציה של אקורד
export function transposeChord(
    symbol: string, 
    semitones: number = 0, 
    options: { preferFlat?: boolean } = {}
): string {
    if (!symbol || semitones === 0) return symbol;
    
    const { preferFlat = false } = options;
    const originalSymbol = symbol.trim();
    
    if (!isChord(originalSymbol)) return originalSymbol;

    const parsed = parseChord(originalSymbol);
    if (!parsed) return originalSymbol;
    
    const newRoot = transposeSingleNote(parsed.root, semitones, preferFlat);
    const newBass = parsed.bass ? transposeSingleNote(parsed.bass, semitones, preferFlat) : null;
    
    return buildChord({
        root: newRoot,
        suffix: parsed.suffix,
        bass: newBass
    });
}

// זיהוי העדפה לבמולים או דיאזים
export function analyzePreferFlat(lyrics: string, originalKey: string): boolean {
    // בדיקה לפי הסולם המקורי
    if (originalKey) {
        const keyRoot = originalKey.replace(/m$/, '');
        if (keyRoot.includes('b')) return true;
        if (keyRoot.includes('#')) return false;
    }

    // ניתוח לפי האקורדים בטקסט
    if (!lyrics) return false;
    
    const flatCount = (lyrics.match(/[A-G]b/g) || []).length;
    const sharpCount = (lyrics.match(/[A-G]#/g) || []).length;
    
    return flatCount > sharpCount;
}

// פשוט אקורד (הסרת סיומות מורכבות)
export function simplifyChord(symbol: string = ''): string {
    if (!symbol) return symbol;
    if (!isChord(symbol)) return symbol;

    const parsed = parseChord(symbol);
    if (!parsed) return symbol;
    
    const isMinor = parsed.suffix && (
        parsed.suffix.toLowerCase().includes('m') && 
        !parsed.suffix.toLowerCase().includes('maj')
    );
    
    return parsed.root + (isMinor ? 'm' : '');
}

// אקורד קל (פשוט או עם טרנספוזיציה)
export function easyChord(symbol: string, semitones: number = 0, preferFlat: boolean = false): string {
    if (semitones !== 0) {
        return transposeChord(symbol, semitones, { preferFlat });
    }
    return simplifyChord(symbol);
}