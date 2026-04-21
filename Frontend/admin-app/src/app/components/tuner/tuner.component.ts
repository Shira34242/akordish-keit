import {
    Component, OnInit, AfterViewInit, OnDestroy,
    HostListener, ViewChild, ElementRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface StringInfo {
    number: number;
    note: string;
    freq: number;
    thicknessPx: number;
}

const GUITAR_STRINGS: StringInfo[] = [
    { number: 6, note: 'E2', freq: 82.41,  thicknessPx: 6 },
    { number: 5, note: 'A2', freq: 110.00, thicknessPx: 5 },
    { number: 4, note: 'D3', freq: 146.83, thicknessPx: 4 },
    { number: 3, note: 'G3', freq: 196.00, thicknessPx: 3 },
    { number: 2, note: 'B3', freq: 246.94, thicknessPx: 2 },
    { number: 1, note: 'E4', freq: 329.63, thicknessPx: 1.5 },
];

const UKULELE_STRINGS: StringInfo[] = [
    { number: 4, note: 'G4', freq: 392.00, thicknessPx: 4 },
    { number: 3, note: 'C4', freq: 261.63, thicknessPx: 3 },
    { number: 2, note: 'E4', freq: 329.63, thicknessPx: 2 },
    { number: 1, note: 'A4', freq: 440.00, thicknessPx: 1.5 },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

@Component({
    selector: 'app-tuner',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './tuner.component.html',
    styleUrls: ['./tuner.component.css']
})
export class TunerComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;

    // ── Instrument & strings ─────────────────────────────────────────────────
    instrument: 'guitar' | 'ukulele' = 'guitar';
    activeStringIndex: number | null = null;

    // ── Hero sizing ──────────────────────────────────────────────────────────
    heroContentHeight = 0;

    // ── Microphone state ─────────────────────────────────────────────────────
    micActive    = false;
    micLoading   = false;
    micError: string | null = null;
    micListening = false;    // true when sound is above silence threshold

    detectedNote:  string | null = null;   // e.g. "E2"
    detectedCents  = 0;                    // deviation from nearest target (–50…+50)
    isInTune       = false;

    // ── Internal audio ───────────────────────────────────────────────────────
    private audioCtx:       AudioContext | null = null;
    private currentGainNode: GainNode | null = null;
    private activeTimeout:  any = null;

    // ── Microphone processing ─────────────────────────────────────────────────
    private micStream:  MediaStream | null = null;
    private micSource:  MediaStreamAudioSourceNode | null = null;
    private micAnalyser: AnalyserNode | null = null;
    private micBuffer:  Float32Array | null = null;
    private micRafId:   number | null = null;
    private frameCount  = 0;
    private smoothedFreq = 0;
    private readonly SMOOTH = 0.82;

    // ── Hero collapse ─────────────────────────────────────────────────────────
    private fullHeroHeight = 0;
    private rafPending = false;

    // ── Computed getters ─────────────────────────────────────────────────────

    get currentStrings(): StringInfo[] {
        return this.instrument === 'guitar' ? GUITAR_STRINGS : UKULELE_STRINGS;
    }

    get heroTitle(): string {
        return this.instrument === 'guitar' ? 'כיוון גיטרה' : 'כיוון יוקלילי';
    }

    get activeStringInfo(): StringInfo | null {
        if (this.activeStringIndex === null) return null;
        return this.currentStrings[this.activeStringIndex] ?? null;
    }

    /** Needle position for cents meter: 0 % (–50 cts) → 50 % (0) → 100 % (+50 cts) */
    get needleLeftPct(): number {
        return Math.max(1, Math.min(99, 50 + this.detectedCents));
    }

    /** Width of the fill bar from center to needle */
    get meterFillWidth(): string {
        return Math.abs(this.needleLeftPct - 50) + '%';
    }

    /** Left edge of the fill bar */
    get meterFillLeft(): string {
        return (this.detectedCents < 0 ? this.needleLeftPct : 50) + '%';
    }

    /** Human-readable cents label */
    get centsLabel(): string {
        if (!this.micListening || !this.detectedNote) return '';
        if (this.isInTune) return 'מכוון ✓';
        const sign = this.detectedCents > 0 ? '+' : '';
        return sign + this.detectedCents + ' cents';
    }

    get inTuneClass(): boolean {
        return this.isInTune && this.micListening && !!this.detectedNote;
    }

    constructor(private zone: NgZone) {}

    ngOnInit(): void {}

    ngAfterViewInit(): void {
        setTimeout(() => this.initHeroHeight(), 50);
    }

    ngOnDestroy(): void {
        this.stopPlayback();
        this.stopMic();
        this.audioCtx?.close();
    }

    // ── Hero ──────────────────────────────────────────────────────────────────

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
        this.fullHeroHeight = Math.round(window.innerHeight * 0.55);
        bg.style.height = this.fullHeroHeight + 'px';
        // heroContentHeight fills from page-body top to hero bottom
        // header is sticky ~56px; hero starts at 8px in viewport → offset = 56 - 8 = 48px
        this.heroContentHeight = this.fullHeroHeight - 48;
        this.shrinkHero();
    }

    private shrinkHero(): void {
        const bg = this.heroBg?.nativeElement;
        if (!bg || this.fullHeroHeight === 0) return;
        const minH = 56;
        const newH = Math.max(minH, this.fullHeroHeight - window.scrollY);
        bg.style.height = newH + 'px';
        const overlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
        if (overlay) {
            const range = this.fullHeroHeight - minH;
            const pct = range > 0 ? Math.min(1, (this.fullHeroHeight - newH) / range) : 0;
            overlay.style.opacity = String(pct);
        }
    }

    // ── Instrument & string selection ─────────────────────────────────────────

    setInstrument(inst: 'guitar' | 'ukulele'): void {
        this.stopPlayback();
        this.instrument = inst;
        // reset mic comparison target
        this.detectedNote  = null;
        this.detectedCents = 0;
        this.isInTune      = false;
    }

    playString(index: number): void {
        const str = this.currentStrings[index];
        if (!str) return;
        this.stopPlayback();
        this.activeStringIndex = index;
        this.synthesize(str.freq, 3.5);
        this.activeTimeout = setTimeout(() => { this.activeStringIndex = null; }, 3500);
    }

    // ── Playback synthesis ───────────────────────────────────────────────────

    private getCtx(): AudioContext {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        return this.audioCtx;
    }

    private synthesize(freq: number, duration: number): void {
        const ctx = this.getCtx();
        const now = ctx.currentTime;

        const master = ctx.createGain();
        master.gain.setValueAtTime(0, now);
        master.gain.linearRampToValueAtTime(0.7, now + 0.008);
        master.gain.exponentialRampToValueAtTime(0.001, now + duration);
        master.connect(ctx.destination);
        this.currentGainNode = master;

        const harmonics: [number, number][] = [
            [1, 0.65], [2, 0.22], [3, 0.09], [4, 0.04], [5, 0.02], [6, 0.01],
        ];
        for (const [mult, amp] of harmonics) {
            const osc = ctx.createOscillator();
            const gn  = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq * mult;
            gn.gain.value = amp;
            osc.connect(gn);
            gn.connect(master);
            osc.start(now);
            osc.stop(now + duration + 0.1);
        }
    }

    private stopPlayback(): void {
        clearTimeout(this.activeTimeout);
        this.activeTimeout = null;
        this.activeStringIndex = null;
        if (this.currentGainNode && this.audioCtx) {
            try {
                const now = this.audioCtx.currentTime;
                this.currentGainNode.gain.cancelScheduledValues(now);
                this.currentGainNode.gain.setTargetAtTime(0, now, 0.03);
            } catch {}
            this.currentGainNode = null;
        }
    }

    // ── Microphone ────────────────────────────────────────────────────────────

    async toggleMic(): Promise<void> {
        if (this.micActive || this.micLoading) {
            this.stopMic();
        } else {
            await this.startMic();
        }
    }

    private async startMic(): Promise<void> {
        this.micLoading = true;
        this.micError   = null;
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const ctx = this.getCtx();
            this.micSource   = ctx.createMediaStreamSource(this.micStream);
            this.micAnalyser = ctx.createAnalyser();
            this.micAnalyser.fftSize = 2048;
            this.micAnalyser.smoothingTimeConstant = 0;
            this.micSource.connect(this.micAnalyser);
            this.micBuffer  = new Float32Array(this.micAnalyser.fftSize);
            this.micActive  = true;
            this.micLoading = false;
            this.frameCount = 0;
            this.smoothedFreq = 0;
            this.zone.runOutsideAngular(() => { this.rafLoop(); });
        } catch (err: any) {
            this.micLoading = false;
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                this.micError = 'הגישה למיקרופון נדחתה. אפשרו גישה בהגדרות הדפדפן ונסו שוב.';
            } else {
                this.micError = 'לא ניתן לגשת למיקרופון. בדקו שהמכשיר מחובר ונסו שוב.';
            }
        }
    }

    stopMic(): void {
        this.micActive   = false;
        this.micLoading  = false;
        this.micListening = false;
        this.detectedNote  = null;
        this.detectedCents = 0;
        this.isInTune      = false;
        this.smoothedFreq  = 0;

        if (this.micRafId !== null) {
            cancelAnimationFrame(this.micRafId);
            this.micRafId = null;
        }
        this.micStream?.getTracks().forEach(t => t.stop());
        this.micSource?.disconnect();
        this.micSource   = null;
        this.micStream   = null;
        this.micAnalyser = null;
        this.micBuffer   = null;
    }

    // ── Pitch detection loop ─────────────────────────────────────────────────

    private rafLoop(): void {
        if (!this.micActive || !this.micAnalyser || !this.micBuffer) return;

        this.micRafId = requestAnimationFrame(() => this.rafLoop());

        // Process every 3rd frame (~20 Hz) for performance
        this.frameCount++;
        if (this.frameCount % 3 !== 0) return;

        this.micAnalyser.getFloatTimeDomainData(this.micBuffer as Float32Array<ArrayBuffer>);
        const freq = this.autoCorrelate(this.micBuffer, this.getCtx().sampleRate);

        if (freq > 0) {
            this.smoothedFreq = this.smoothedFreq > 0
                ? this.SMOOTH * this.smoothedFreq + (1 - this.SMOOTH) * freq
                : freq;

            const noteData = this.freqToNoteData(this.smoothedFreq);
            const cents    = this.computeTargetCents(this.smoothedFreq);
            const inTune   = Math.abs(cents) <= 5;

            this.zone.run(() => {
                this.micListening  = true;
                this.detectedNote  = noteData.note;
                this.detectedCents = cents;
                this.isInTune      = inTune;
            });
        } else {
            this.smoothedFreq = 0;
            this.zone.run(() => {
                this.micListening  = false;
                this.detectedNote  = null;
                this.isInTune      = false;
            });
        }
    }

    // ── Autocorrelation pitch detection ──────────────────────────────────────
    // Range: 60 Hz – 1100 Hz (covers all guitar and ukulele strings)

    private autoCorrelate(buf: Float32Array, sampleRate: number): number {
        const SIZE = buf.length;

        // RMS silence check
        let rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
        if (Math.sqrt(rms / SIZE) < 0.015) return -1;

        const minT = Math.floor(sampleRate / 1100);
        const maxT = Math.min(Math.ceil(sampleRate / 60), SIZE - 1);
        const N    = SIZE - maxT;
        if (N <= 0) return -1;

        // Compute normalised autocorrelation for each lag
        const corrs = new Float32Array(maxT + 1);
        for (let T = minT; T <= maxT; T++) {
            let c = 0;
            for (let i = 0; i < N; i++) c += buf[i] * buf[i + T];
            corrs[T] = c / N;
        }

        // Find first local maximum (skip initial monotone rise)
        let d = minT;
        while (d < maxT - 1 && corrs[d] <= corrs[d + 1]) d++;

        let bestCorr = corrs[d], bestT = d;
        for (let T = d; T <= maxT; T++) {
            if (corrs[T] > bestCorr) { bestCorr = corrs[T]; bestT = T; }
        }

        // Require minimum signal strength
        if (bestCorr < 0.005) return -1;

        // Sub-sample refinement via parabolic interpolation
        let T0 = bestT;
        if (T0 > minT && T0 < maxT) {
            const y1 = corrs[T0 - 1], y2 = corrs[T0], y3 = corrs[T0 + 1];
            const a  = (y1 + y3 - 2 * y2) / 2;
            const b  = (y3 - y1) / 2;
            if (a < 0) T0 -= b / (2 * a);
        }

        return sampleRate / T0;
    }

    // ── Note / cents helpers ─────────────────────────────────────────────────

    private freqToNoteData(freq: number): { note: string } {
        const semitones = 12 * Math.log2(freq / 440);
        const midiNote  = Math.round(semitones) + 69;
        const noteIdx   = ((midiNote % 12) + 12) % 12;
        const octave    = Math.floor(midiNote / 12) - 1;
        return { note: NOTE_NAMES[noteIdx] + octave };
    }

    /**
     * Returns cents deviation:
     * – If a string is selected → compare to that string's frequency (octave-agnostic)
     * – Otherwise → compare to the nearest chromatic semitone
     */
    private computeTargetCents(freq: number): number {
        if (this.activeStringIndex !== null) {
            const target = this.currentStrings[this.activeStringIndex].freq;
            return this.centsFromTarget(freq, target);
        }
        // nearest chromatic note
        const semitones = 12 * Math.log2(freq / 440);
        return Math.round((semitones - Math.round(semitones)) * 100);
    }

    /** Cents deviation normalised across octaves (handles harmonics gracefully) */
    private centsFromTarget(detected: number, target: number): number {
        let ratio = detected / target;
        while (ratio > 1.5) ratio /= 2;
        while (ratio < 0.75) ratio *= 2;
        return Math.round(1200 * Math.log2(ratio));
    }
}
