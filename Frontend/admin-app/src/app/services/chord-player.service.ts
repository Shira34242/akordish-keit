import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ChordPlayerService {
    private tone: typeof import('tone') | null = null;
    private guitarSynth: any = null;
    private pianoSynth: any = null;

    // Standard guitar tuning MIDI: E2=40 A2=45 D3=50 G3=55 B3=59 e4=64
    private readonly OPEN_STRINGS = [40, 45, 50, 55, 59, 64];

    private async ensureLoaded(): Promise<void> {
        if (this.tone) return;
        const Tone = await import('tone');
        this.tone = Tone;

        this.guitarSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sawtooth' as const },
            envelope: { attack: 0.01, decay: 0.5, sustain: 0.0, release: 0.8 },
        });
        this.guitarSynth.volume.value = -8;
        this.guitarSynth.toDestination();

        this.pianoSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' as const },
            envelope: { attack: 0.02, decay: 0.6, sustain: 0.3, release: 1.5 },
        });
        this.pianoSynth.volume.value = -8;
        this.pianoSynth.toDestination();
    }

    /** נגן strum גיטרה — מחרוזת נמוכה לגבוהה עם 50ms הפרש */
    async playGuitar(frets: number[]): Promise<void> {
        await this.ensureLoaded();
        await this.tone!.start();
        this.guitarSynth.releaseAll();

        const notes: string[] = [];
        for (let i = 0; i < 6; i++) {
            if (frets[i] === -1) continue; // muted
            notes.push(this.midiToNote(this.OPEN_STRINGS[i] + frets[i]));
        }

        const now = this.tone!.now();
        notes.forEach((note, idx) => {
            this.guitarSynth.triggerAttackRelease(note, '8n', now + idx * 0.05);
        });
    }

    /** נגן אקורד פסנתר — bass ראשון אם קיים, אחר כך שאר הצלילים */
    async playPiano(absoluteNotes: Set<number>, bassAbsoluteNote: number | null): Promise<void> {
        await this.ensureLoaded();
        await this.tone!.start();
        this.pianoSynth.releaseAll();

        const sorted = [...absoluteNotes].sort((a, b) => a - b);
        // absoluteNotes מתחיל מ-0 = C, ממפים ל-MIDI C4=60
        const allMidi = sorted.map(n => 60 + n);

        const now = this.tone!.now();

        if (bassAbsoluteNote !== null) {
            const bassMidi = 60 + bassAbsoluteNote;
            this.pianoSynth.triggerAttackRelease(this.midiToNote(bassMidi), '4n', now);
            const rest = allMidi.filter(m => m !== bassMidi);
            if (rest.length > 0) {
                this.pianoSynth.triggerAttackRelease(
                    rest.map(m => this.midiToNote(m)),
                    '2n',
                    now + 0.2
                );
            }
        } else {
            this.pianoSynth.triggerAttackRelease(
                allMidi.map(m => this.midiToNote(m)),
                '2n',
                now
            );
        }
    }

    stopAll(): void {
        this.guitarSynth?.releaseAll();
        this.pianoSynth?.releaseAll();
    }

    private midiToNote(midi: number): string {
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        return `${names[midi % 12]}${octave}`;
    }
}
