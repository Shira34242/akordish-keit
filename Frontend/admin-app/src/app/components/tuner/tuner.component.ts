import {
    Component, OnInit, AfterViewInit, OnDestroy,
    HostListener, ViewChild, ElementRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { MicrophoneTunerComponent } from './microphone-tuner/microphone-tuner.component';

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

@Component({
    selector: 'app-tuner',
    standalone: true,
    imports: [CommonModule, RouterModule, TranslatePipe, MicrophoneTunerComponent],
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

    // ── Internal audio ───────────────────────────────────────────────────────
    private audioCtx:       AudioContext | null = null;
    private currentGainNode: GainNode | null = null;
    private activeTimeout:  any = null;

    // ── Hero collapse ─────────────────────────────────────────────────────────
    private fullHeroHeight = 0;
    private rafPending = false;

    // ── Computed getters ─────────────────────────────────────────────────────

    get currentStrings(): StringInfo[] {
        return this.instrument === 'guitar' ? GUITAR_STRINGS : UKULELE_STRINGS;
    }

    private readonly langService = inject(LanguageService);

    get heroTitle(): string {
        return this.instrument === 'guitar'
            ? this.langService.translate('tuner.hero_guitar')
            : this.langService.translate('tuner.hero_ukulele');
    }

    get activeStringInfo(): StringInfo | null {
        if (this.activeStringIndex === null) return null;
        return this.currentStrings[this.activeStringIndex] ?? null;
    }

    ngOnInit(): void {}

    ngAfterViewInit(): void {
        setTimeout(() => this.initHeroHeight(), 50);
    }

    ngOnDestroy(): void {
        this.stopPlayback();
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
}
