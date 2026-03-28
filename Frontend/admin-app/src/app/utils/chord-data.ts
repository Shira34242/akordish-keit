export interface GuitarChord {
    frets: number[]; // 6 strings, from low E to high E. -1 for mute, 0 for open.
    fingers?: number[]; // 0 for open/mute, 1-4 for fingers
    barres?: { fret: number, fromString: number, toString: number }[];
    baseFret?: number; // Starting fret for display (for higher positions)
}

// Comprehensive Guitar Chord Database
export const GUITAR_CHORDS: { [key: string]: GuitarChord } = {
    // ============ C CHORDS ============
    'C': { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
    'Cm': { frets: [-1, 3, 5, 5, 4, 3], barres: [{ fret: 3, fromString: 5, toString: 1 }] },
    'C7': { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
    'Cmaj7': { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
    'Cm7': { frets: [-1, 3, 1, 3, 1, 3], barres: [{ fret: 3, fromString: 5, toString: 1 }] },
    'Cdim': { frets: [-1, 3, 4, 2, 4, 2], fingers: [0, 2, 4, 1, 3, 1] },
    'Caug': { frets: [-1, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
    'Csus2': { frets: [-1, 3, 0, 0, 1, 3], fingers: [0, 2, 0, 0, 1, 3] },
    'Csus4': { frets: [-1, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 2] },
    'C6': { frets: [-1, 3, 2, 2, 1, 0], fingers: [0, 4, 2, 3, 1, 0] },
    'Cm6': { frets: [-1, 3, 1, 2, 1, 3], fingers: [0, 3, 1, 2, 1, 4] },
    'C9': { frets: [-1, 3, 2, 3, 3, 3], fingers: [0, 2, 1, 3, 3, 3] },
    'Cadd9': { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
    'Cm7b5': { frets: [-1, 3, 4, 5, 4, 6] },
    'Cdim7': { frets: [-1, 3, 4, 5, 4, 5] },

    // ============ C# / Db CHORDS ============
    'C#': { frets: [-1, 4, 6, 6, 6, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'Db': { frets: [-1, 4, 6, 6, 6, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'C#m': { frets: [-1, 4, 6, 6, 5, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'Dbm': { frets: [-1, 4, 6, 6, 5, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'C#7': { frets: [-1, 4, 3, 4, 2, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'Db7': { frets: [-1, 4, 3, 4, 2, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'C#maj7': { frets: [-1, 4, 6, 5, 6, 4] },
    'Dbmaj7': { frets: [-1, 4, 6, 5, 6, 4] },
    'C#m7': { frets: [-1, 4, 6, 4, 5, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'Dbm7': { frets: [-1, 4, 6, 4, 5, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'C#dim7': { frets: [-1, 4, 5, 6, 5, 6] },
    'Dbdim7': { frets: [-1, 4, 5, 6, 5, 6] },

    // ============ D CHORDS ============
    'D': { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
    'Dm': { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
    'D7': { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
    'Dmaj7': { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1] },
    'Dm7': { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
    'Ddim': { frets: [-1, -1, 0, 1, 0, 1], fingers: [0, 0, 0, 1, 0, 2] },
    'Daug': { frets: [-1, -1, 0, 3, 3, 2], fingers: [0, 0, 0, 2, 3, 1] },
    'Dsus2': { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
    'Dsus4': { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
    'D6': { frets: [-1, -1, 0, 2, 0, 2], fingers: [0, 0, 0, 1, 0, 2] },
    'D9': { frets: [-1, -1, 0, 2, 1, 0], fingers: [0, 0, 0, 2, 1, 0] },
    'Dadd9': { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
    'Dm7b5': { frets: [-1, -1, 0, 1, 1, 1], barres: [{ fret: 1, fromString: 3, toString: 1 }] },
    'Ddim7': { frets: [-1, -1, 0, 1, 0, 1] },

    // ============ D# / Eb CHORDS ============
    'D#': { frets: [-1, -1, 1, 3, 4, 3], fingers: [0, 0, 1, 2, 4, 3] },
    'Eb': { frets: [-1, -1, 1, 3, 4, 3], fingers: [0, 0, 1, 2, 4, 3] },
    'D#m': { frets: [-1, -1, 1, 3, 4, 2], fingers: [0, 0, 1, 3, 4, 2] },
    'Ebm': { frets: [-1, -1, 1, 3, 4, 2], fingers: [0, 0, 1, 3, 4, 2] },
    'D#7': { frets: [-1, -1, 1, 3, 2, 3], fingers: [0, 0, 1, 3, 2, 4] },
    'Eb7': { frets: [-1, -1, 1, 3, 2, 3], fingers: [0, 0, 1, 3, 2, 4] },
    'D#maj7': { frets: [-1, -1, 1, 3, 3, 3] },
    'Ebmaj7': { frets: [-1, -1, 1, 3, 3, 3] },
    'D#m7': { frets: [-1, -1, 1, 3, 2, 2] },
    'Ebm7': { frets: [-1, -1, 1, 3, 2, 2] },
    'D#m7b5': { frets: [-1, -1, 1, 2, 2, 2], barres: [{ fret: 2, fromString: 3, toString: 1 }] },
    'Ebm7b5': { frets: [-1, -1, 1, 2, 2, 2], barres: [{ fret: 2, fromString: 3, toString: 1 }] },
    'D#dim7': { frets: [-1, -1, 1, 2, 1, 2] },
    'Ebdim7': { frets: [-1, -1, 1, 2, 1, 2] },

    // ============ E CHORDS ============
    'E': { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
    'Em': { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
    'E7': { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
    'Emaj7': { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
    'Em7': { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
    'Edim': { frets: [0, 1, 2, 0, 2, 0], fingers: [0, 1, 3, 0, 4, 0] },
    'Eaug': { frets: [0, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
    'Esus2': { frets: [0, 2, 2, 4, 5, 2], fingers: [0, 1, 1, 2, 3, 1] },
    'Esus4': { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 1, 1, 1, 0, 0] },
    'E6': { frets: [0, 2, 2, 1, 2, 0], fingers: [0, 2, 3, 1, 4, 0] },
    'E9': { frets: [0, 2, 0, 1, 0, 2], fingers: [0, 2, 0, 1, 0, 3] },
    'Em7b5': { frets: [-1, -1, 2, 3, 3, 3], barres: [{ fret: 3, fromString: 3, toString: 1 }] },
    'Edim7': { frets: [-1, -1, 2, 3, 2, 3] },

    // ============ F CHORDS ============
    'F': { frets: [1, 3, 3, 2, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'Fm': { frets: [1, 3, 3, 1, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'F7': { frets: [1, 3, 1, 2, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'Fmaj7': { frets: [1, 3, 2, 2, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'Fm7': { frets: [1, 3, 1, 1, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'Fdim': { frets: [1, 2, 3, 1, 3, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'Faug': { frets: [1, 4, 3, 2, 2, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'Fsus2': { frets: [1, 3, 3, 0, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'Fsus4': { frets: [1, 3, 3, 3, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'F6': { frets: [1, 3, 3, 2, 3, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }] },
    'Fm7b5': { frets: [-1, -1, 3, 4, 4, 4], barres: [{ fret: 4, fromString: 3, toString: 1 }] },
    'Fdim7': { frets: [-1, -1, 3, 4, 3, 4] },

    // ============ F# / Gb CHORDS ============
    'F#': { frets: [2, 4, 4, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'Gb': { frets: [2, 4, 4, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'F#m': { frets: [2, 4, 4, 2, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'Gbm': { frets: [2, 4, 4, 2, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'F#7': { frets: [2, 4, 2, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'Gb7': { frets: [2, 4, 2, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'F#m7': { frets: [2, 4, 2, 2, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'F#maj7': { frets: [2, 4, 3, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'Gbmaj7': { frets: [2, 4, 3, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'F#m7b5': { frets: [-1, -1, 4, 5, 5, 5], barres: [{ fret: 5, fromString: 3, toString: 1 }] },
    'Gbm7b5': { frets: [-1, -1, 4, 5, 5, 5], barres: [{ fret: 5, fromString: 3, toString: 1 }] },
    'F#dim7': { frets: [-1, -1, 4, 5, 4, 5] },
    'Gbdim7': { frets: [-1, -1, 4, 5, 4, 5] },

    // ============ G CHORDS ============
    'G': { frets: [3, 2, 0, 0, 0, 3], fingers: [3, 2, 0, 0, 0, 4] },
    'Gm': { frets: [3, 5, 5, 3, 3, 3], barres: [{ fret: 3, fromString: 6, toString: 1 }] },
    'G7': { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
    'Gmaj7': { frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 4] },
    'Gm7': { frets: [3, 5, 3, 3, 3, 3], barres: [{ fret: 3, fromString: 6, toString: 1 }] },
    'Gdim': { frets: [3, 4, 5, 3, 5, 3], barres: [{ fret: 3, fromString: 6, toString: 1 }] },
    'Gaug': { frets: [3, 2, 1, 0, 0, 3], fingers: [4, 3, 2, 0, 0, 4] },
    'Gsus2': { frets: [3, 0, 0, 0, 3, 3], fingers: [2, 0, 0, 0, 3, 4] },
    'Gsus4': { frets: [3, 3, 0, 0, 1, 3], fingers: [3, 4, 0, 0, 1, 3] },
    'G6': { frets: [3, 2, 0, 0, 0, 0], fingers: [3, 2, 0, 0, 0, 0] },
    'Gm7b5': { frets: [-1, -1, 5, 6, 6, 6], barres: [{ fret: 6, fromString: 3, toString: 1 }] },
    'Gdim7': { frets: [-1, -1, 5, 6, 5, 6] },

    // ============ G# / Ab CHORDS ============
    'G#': { frets: [4, 6, 6, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'Ab': { frets: [4, 6, 6, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'G#m': { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'Abm': { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'G#7': { frets: [4, 6, 4, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'Ab7': { frets: [4, 6, 4, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'G#maj7': { frets: [4, 6, 5, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'Abmaj7': { frets: [4, 6, 5, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'G#m7': { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'Abm7': { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },

    // ============ A CHORDS ============
    'A': { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
    'Am': { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
    'A7': { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
    'Amaj7': { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 3, 1, 4, 0] },
    'Am7': { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
    'Adim': { frets: [-1, 0, 1, 2, 1, 2], fingers: [0, 0, 1, 3, 2, 4] },
    'Aaug': { frets: [-1, 0, 3, 2, 2, 1], fingers: [0, 0, 4, 2, 3, 1] },
    'Asus2': { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
    'Asus4': { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
    'A6': { frets: [-1, 0, 2, 2, 2, 2], fingers: [0, 0, 1, 1, 1, 1] },
    'A9': { frets: [-1, 0, 2, 4, 2, 3], fingers: [0, 0, 1, 3, 2, 4] },
    'Am7b5': { frets: [-1, 0, 1, 2, 1, 3] },
    'Adim7': { frets: [-1, 0, 1, 2, 1, 2] },

    // ============ A# / Bb CHORDS ============
    'A#': { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'Bb': { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'A#m': { frets: [-1, 1, 3, 3, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'Bbm': { frets: [-1, 1, 3, 3, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'A#7': { frets: [-1, 1, 3, 1, 3, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'Bb7': { frets: [-1, 1, 3, 1, 3, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'A#m7': { frets: [-1, 1, 3, 1, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'Bbm7': { frets: [-1, 1, 3, 1, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'A#m7b5': { frets: [-1, 1, 2, 3, 2, 4] },
    'Bbm7b5': { frets: [-1, 1, 2, 3, 2, 4] },
    'A#dim7': { frets: [-1, 1, 2, 3, 2, 3] },
    'Bbdim7': { frets: [-1, 1, 2, 3, 2, 3] },

    // ============ B CHORDS ============
    'B': { frets: [-1, 2, 4, 4, 4, 2], barres: [{ fret: 2, fromString: 5, toString: 1 }] },
    'Bm': { frets: [-1, 2, 4, 4, 3, 2], barres: [{ fret: 2, fromString: 5, toString: 1 }] },
    'B7': { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
    'Bmaj7': { frets: [-1, 2, 4, 3, 4, 2], barres: [{ fret: 2, fromString: 5, toString: 1 }] },
    'Bm7': { frets: [-1, 2, 4, 2, 3, 2], barres: [{ fret: 2, fromString: 5, toString: 1 }] },
    'Bdim': { frets: [-1, 2, 3, 4, 3, 4], fingers: [0, 1, 2, 4, 2, 3] },
    'Baug': { frets: [-1, 2, 1, 0, 0, 3], fingers: [0, 2, 1, 0, 0, 4] },
    'Bsus2': { frets: [-1, 2, 4, 4, 2, 2], barres: [{ fret: 2, fromString: 5, toString: 1 }] },
    'Bsus4': { frets: [-1, 2, 4, 4, 5, 2], barres: [{ fret: 2, fromString: 5, toString: 1 }] },
    'Bm7b5': { frets: [-1, 2, 3, 4, 3, 5] },
    'Bdim7': { frets: [-1, 2, 3, 4, 3, 4] },

    // ============ SLASH CHORDS (common inversions) ============
    'C/E':  { frets: [0, 3, 2, 0, 1, 0] },                          // E on low string
    'D/F#': { frets: [2, 0, 0, 2, 3, 2] },                          // F# on low string
    'F/A':  { frets: [-1, 0, 3, 2, 1, 1] },                         // A on A string (open)
    'G/B':  { frets: [-1, 2, 0, 0, 0, 3] },                         // B on A string
    'A/C#': { frets: [-1, 4, 2, 2, 2, 0] },                         // C# on A string fret 4
    'E/G#': { frets: [4, -1, 2, 1, 0, 0] },                         // G# on low string fret 4
};

// Comprehensive Piano Chord Database
// Each chord is represented as an array of MIDI note numbers (0-11 for C-B)
export const PIANO_CHORDS: { [key: string]: number[] } = {
    // ============ C CHORDS ============
    'C': [0, 4, 7],           // C E G
    'Cm': [0, 3, 7],          // C Eb G
    'C7': [0, 4, 7, 10],      // C E G Bb
    'Cmaj7': [0, 4, 7, 11],   // C E G B
    'Cm7': [0, 3, 7, 10],     // C Eb G Bb
    'Cdim': [0, 3, 6],        // C Eb Gb
    'Caug': [0, 4, 8],        // C E G#
    'Csus2': [0, 2, 7],       // C D G
    'Csus4': [0, 5, 7],       // C F G
    'C6': [0, 4, 7, 9],       // C E G A
    'Cm6': [0, 3, 7, 9],      // C Eb G A
    'C9': [0, 4, 7, 10, 2],   // C E G Bb D
    'Cadd9': [0, 4, 7, 2],    // C E G D
    'Cm7b5': [0, 3, 6, 10],  // C Eb Gb Bb
    'Cdim7': [0, 3, 6, 9],   // C Eb Gb A

    // ============ C# / Db CHORDS ============
    'C#': [1, 5, 8],
    'Db': [1, 5, 8],
    'C#m': [1, 4, 8],
    'Dbm': [1, 4, 8],
    'C#7': [1, 5, 8, 11],
    'Db7': [1, 5, 8, 11],
    'C#maj7': [1, 5, 8, 0],
    'Dbmaj7': [1, 5, 8, 0],
    'C#m7': [1, 4, 8, 11],
    'Dbm7': [1, 4, 8, 11],
    'C#m7b5': [1, 4, 7, 11], // C# E G B
    'Dbm7b5': [1, 4, 7, 11],
    'C#dim7': [1, 4, 7, 10], // C# E G Bb
    'Dbdim7': [1, 4, 7, 10],

    // ============ D CHORDS ============
    'D': [2, 6, 9],
    'Dm': [2, 5, 9],
    'D7': [2, 6, 9, 0],
    'Dmaj7': [2, 6, 9, 1],
    'Dm7': [2, 5, 9, 0],
    'Ddim': [2, 5, 8],
    'Daug': [2, 6, 10],
    'Dsus2': [2, 4, 9],
    'Dsus4': [2, 7, 9],
    'D6': [2, 6, 9, 11],
    'D9': [2, 6, 9, 0, 4],
    'Dadd9': [2, 6, 9, 4],
    'Dm7b5': [2, 5, 8, 0],   // D F Ab C
    'Ddim7': [2, 5, 8, 11],  // D F Ab B(Cb)

    // ============ D# / Eb CHORDS ============
    'D#': [3, 7, 10],
    'Eb': [3, 7, 10],
    'D#m': [3, 6, 10],
    'Ebm': [3, 6, 10],
    'D#7': [3, 7, 10, 1],
    'Eb7': [3, 7, 10, 1],
    'D#maj7': [3, 7, 10, 2],
    'Ebmaj7': [3, 7, 10, 2],
    'D#m7': [3, 6, 10, 1],   // D# F# A# C#
    'Ebm7': [3, 6, 10, 1],
    'D#m7b5': [3, 6, 9, 1],  // D# F# A C#
    'Ebm7b5': [3, 6, 9, 1],
    'D#dim7': [3, 6, 9, 0],  // D# F# A C
    'Ebdim7': [3, 6, 9, 0],

    // ============ E CHORDS ============
    'E': [4, 8, 11],
    'Em': [4, 7, 11],
    'E7': [4, 8, 11, 2],
    'Emaj7': [4, 8, 11, 3],
    'Em7': [4, 7, 11, 2],
    'Edim': [4, 7, 10],
    'Eaug': [4, 8, 0],
    'Esus2': [4, 6, 11],
    'Esus4': [4, 9, 11],
    'E6': [4, 8, 11, 1],
    'Eadd9': [4, 8, 11, 6],  // E G# B F#
    'Em7b5': [4, 7, 10, 2],  // E G Bb D
    'Edim7': [4, 7, 10, 1],  // E G Bb C#

    // ============ F CHORDS ============
    'F': [5, 9, 0],
    'Fm': [5, 8, 0],
    'F7': [5, 9, 0, 3],
    'Fmaj7': [5, 9, 0, 4],
    'Fm7': [5, 8, 0, 3],
    'Fdim': [5, 8, 11],
    'Faug': [5, 9, 1],
    'Fsus2': [5, 7, 0],
    'Fsus4': [5, 10, 0],
    'F6': [5, 9, 0, 2],
    'Fm7b5': [5, 8, 11, 3],  // F Ab B(Cb) Eb
    'Fdim7': [5, 8, 11, 2],  // F Ab B(Cb) D

    // ============ F# / Gb CHORDS ============
    'F#': [6, 10, 1],
    'Gb': [6, 10, 1],
    'F#m': [6, 9, 1],
    'Gbm': [6, 9, 1],
    'F#7': [6, 10, 1, 4],
    'Gb7': [6, 10, 1, 4],
    'F#maj7': [6, 10, 1, 5],
    'Gbmaj7': [6, 10, 1, 5],
    'F#m7': [6, 9, 1, 4],
    'Gbm7': [6, 9, 1, 4],
    'F#m7b5': [6, 9, 0, 4],  // F# A C E
    'Gbm7b5': [6, 9, 0, 4],
    'F#dim7': [6, 9, 0, 3],  // F# A C Eb
    'Gbdim7': [6, 9, 0, 3],

    // ============ G CHORDS ============
    'G': [7, 11, 2],
    'Gm': [7, 10, 2],
    'G7': [7, 11, 2, 5],
    'Gmaj7': [7, 11, 2, 6],
    'Gm7': [7, 10, 2, 5],
    'Gdim': [7, 10, 1],
    'Gaug': [7, 11, 3],
    'Gsus2': [7, 9, 2],
    'Gsus4': [7, 0, 2],
    'G6': [7, 11, 2, 4],
    'Gadd9': [7, 11, 2, 9],  // G B D A
    'Gm7b5': [7, 10, 1, 5],  // G Bb Db F
    'Gdim7': [7, 10, 1, 4],  // G Bb Db E

    // ============ G# / Ab CHORDS ============
    'G#': [8, 0, 3],
    'Ab': [8, 0, 3],
    'G#m': [8, 11, 3],
    'Abm': [8, 11, 3],
    'G#7': [8, 0, 3, 6],
    'Ab7': [8, 0, 3, 6],
    'G#maj7': [8, 0, 3, 7],
    'Abmaj7': [8, 0, 3, 7],
    'G#m7': [8, 11, 3, 6],   // G# B D# F#
    'Abm7': [8, 11, 3, 6],
    'G#m7b5': [8, 11, 2, 6], // G# B D F#
    'Abm7b5': [8, 11, 2, 6],
    'G#dim7': [8, 11, 2, 5], // G# B D F
    'Abdim7': [8, 11, 2, 5],

    // ============ A CHORDS ============
    'A': [9, 1, 4],
    'Am': [9, 0, 4],
    'A7': [9, 1, 4, 7],
    'Amaj7': [9, 1, 4, 8],
    'Am7': [9, 0, 4, 7],
    'Adim': [9, 0, 3],
    'Aaug': [9, 1, 5],
    'Asus2': [9, 11, 4],
    'Asus4': [9, 2, 4],
    'A6': [9, 1, 4, 6],
    'A9': [9, 1, 4, 7, 11],
    'Aadd9': [9, 1, 4, 11],  // A C# E B
    'Am7b5': [9, 0, 3, 7],   // A C Eb G
    'Adim7': [9, 0, 3, 6],   // A C Eb Gb

    // ============ A# / Bb CHORDS ============
    'A#': [10, 2, 5],
    'Bb': [10, 2, 5],
    'A#m': [10, 1, 5],
    'Bbm': [10, 1, 5],
    'A#7': [10, 2, 5, 8],
    'Bb7': [10, 2, 5, 8],
    'A#maj7': [10, 2, 5, 9],
    'Bbmaj7': [10, 2, 5, 9],
    'A#m7': [10, 1, 5, 8],
    'Bbm7': [10, 1, 5, 8],
    'A#m7b5': [10, 1, 4, 8], // A# C# E G#
    'Bbm7b5': [10, 1, 4, 8],
    'A#dim7': [10, 1, 4, 7], // A# C# E G
    'Bbdim7': [10, 1, 4, 7],

    // ============ B CHORDS ============
    'B': [11, 3, 6],
    'Bm': [11, 2, 6],
    'B7': [11, 3, 6, 9],
    'Bmaj7': [11, 3, 6, 10],
    'Bm7': [11, 2, 6, 9],
    'Bdim': [11, 2, 5],
    'Baug': [11, 3, 7],
    'Bsus2': [11, 1, 6],
    'Bsus4': [11, 4, 6],
    'Bm7b5': [11, 2, 5, 9],  // B D F A
    'Bdim7': [11, 2, 5, 8],  // B D F Ab

    // ============ SLASH CHORDS (common inversions) ============
    'C/E':  [4, 0, 7],   // E G C
    'D/F#': [6, 2, 9],   // F# A D
    'F/A':  [9, 5, 0],   // A C F
    'G/B':  [11, 7, 2],  // B D G
    'A/C#': [1, 9, 4],   // C# E A
    'E/G#': [8, 4, 11],  // G# B E
};
