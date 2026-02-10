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

    // ============ C# / Db CHORDS ============
    'C#': { frets: [-1, 4, 6, 6, 6, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'Db': { frets: [-1, 4, 6, 6, 6, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'C#m': { frets: [-1, 4, 6, 6, 5, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'Dbm': { frets: [-1, 4, 6, 6, 5, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'C#7': { frets: [-1, 4, 3, 4, 2, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },
    'Db7': { frets: [-1, 4, 3, 4, 2, 4], barres: [{ fret: 4, fromString: 5, toString: 1 }] },

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

    // ============ D# / Eb CHORDS ============
    'D#': { frets: [-1, -1, 1, 3, 4, 3], fingers: [0, 0, 1, 2, 4, 3] },
    'Eb': { frets: [-1, -1, 1, 3, 4, 3], fingers: [0, 0, 1, 2, 4, 3] },
    'D#m': { frets: [-1, -1, 1, 3, 4, 2], fingers: [0, 0, 1, 3, 4, 2] },
    'Ebm': { frets: [-1, -1, 1, 3, 4, 2], fingers: [0, 0, 1, 3, 4, 2] },
    'D#7': { frets: [-1, -1, 1, 3, 2, 3], fingers: [0, 0, 1, 3, 2, 4] },
    'Eb7': { frets: [-1, -1, 1, 3, 2, 3], fingers: [0, 0, 1, 3, 2, 4] },

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

    // ============ F# / Gb CHORDS ============
    'F#': { frets: [2, 4, 4, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'Gb': { frets: [2, 4, 4, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'F#m': { frets: [2, 4, 4, 2, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'Gbm': { frets: [2, 4, 4, 2, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'F#7': { frets: [2, 4, 2, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'Gb7': { frets: [2, 4, 2, 3, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },
    'F#m7': { frets: [2, 4, 2, 2, 2, 2], barres: [{ fret: 2, fromString: 6, toString: 1 }] },

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

    // ============ G# / Ab CHORDS ============
    'G#': { frets: [4, 6, 6, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'Ab': { frets: [4, 6, 6, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'G#m': { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'Abm': { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'G#7': { frets: [4, 6, 4, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },
    'Ab7': { frets: [4, 6, 4, 5, 4, 4], barres: [{ fret: 4, fromString: 6, toString: 1 }] },

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

    // ============ A# / Bb CHORDS ============
    'A#': { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'Bb': { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'A#m': { frets: [-1, 1, 3, 3, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'Bbm': { frets: [-1, 1, 3, 3, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'A#7': { frets: [-1, 1, 3, 1, 3, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'Bb7': { frets: [-1, 1, 3, 1, 3, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'A#m7': { frets: [-1, 1, 3, 1, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },
    'Bbm7': { frets: [-1, 1, 3, 1, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }] },

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

    // ============ D# / Eb CHORDS ============
    'D#': [3, 7, 10],
    'Eb': [3, 7, 10],
    'D#m': [3, 6, 10],
    'Ebm': [3, 6, 10],
    'D#7': [3, 7, 10, 1],
    'Eb7': [3, 7, 10, 1],
    'D#maj7': [3, 7, 10, 2],
    'Ebmaj7': [3, 7, 10, 2],

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

    // ============ G# / Ab CHORDS ============
    'G#': [8, 0, 3],
    'Ab': [8, 0, 3],
    'G#m': [8, 11, 3],
    'Abm': [8, 11, 3],
    'G#7': [8, 0, 3, 6],
    'Ab7': [8, 0, 3, 6],
    'G#maj7': [8, 0, 3, 7],
    'Abmaj7': [8, 0, 3, 7],

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
};
