import {
  Component, Input, OnDestroy, NgZone, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { TunerEngine, PitchResult } from './tuner-engine';
import {
  GUITAR_TUNING, UKULELE_TUNING, TuningString,
  getClosestString, getCents, getTuningStatus,
  isValidTunerFrequency
} from './guitar-tuning';
import { smoothValue, isSignalStrong, midiToNoteName, frequencyToMidi } from './pitch-utils';

@Component({
  selector: 'app-microphone-tuner',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './microphone-tuner.component.html',
  styleUrls: ['./microphone-tuner.component.css']
})
export class MicrophoneTunerComponent implements OnDestroy, OnChanges {

  @Input() instrument: 'guitar' | 'ukulele' = 'guitar';

  micActive   = false;
  micLoading  = false;
  micStopped  = false;
  micError: string | null = null;
  micListening = false;

  detectedNote: string | null = null;
  detectedCents = 0;
  isInTune = false;
  detectedFreq = 0;
  closestString: TuningString | null = null;

  private engine: TunerEngine | null = null;
  private smoothedFreq = 0;
  private readonly SMOOTH_FACTOR = 0.82;
  private readonly CLARITY_THRESHOLD = 0.7;

  private silenceTimeout: any = null;
  private silenceHolding = false;
  private readonly SILENCE_HOLD_MS = 2000;

  constructor(private zone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['instrument']) {
      this.stopMic();
    }
  }

  ngOnDestroy(): void {
    this.stopMic();
  }

  get currentTuning(): TuningString[] {
    return this.instrument === 'guitar' ? GUITAR_TUNING : UKULELE_TUNING;
  }

  get needlePct(): number {
    return Math.max(2, Math.min(98, 50 + this.detectedCents * 0.96));
  }

  get meterFillLeft(): string {
    return (this.detectedCents < 0 ? this.needlePct : 50) + '%';
  }

  get meterFillWidth(): string {
    return Math.abs(this.needlePct - 50) + '%';
  }

  get showMeter(): boolean {
    return this.micActive || (this.micStopped && this.detectedNote !== null);
  }

  get statusLabel(): string {
    if (!this.micListening && !this.micStopped) return 'tuner_mic.listening';
    if (this.micStopped) return 'tuner_mic.stopped';
    if (this.isInTune) return 'tuner_mic.in_tune';
    if (this.detectedCents < 0) return 'tuner_mic.too_low';
    return 'tuner_mic.too_high';
  }

  async toggleMic(): Promise<void> {
    if (this.micActive || this.micLoading) {
      this.stopMic();
    } else {
      await this.startMic();
    }
  }

  private async startMic(): Promise<void> {
    this.micLoading = true;
    this.micError = null;
    clearTimeout(this.silenceTimeout);
    this.silenceTimeout = null;
    this.silenceHolding = false;
    this.micStopped = false;
    try {
      this.engine = new TunerEngine();
      this.engine.onData(r => this.handlePitchData(r));
      await this.engine.start();
      this.micActive = true;
      this.micLoading = false;
    } catch (err: any) {
      this.micLoading = false;
      this.micStopped = false;
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        this.micError = 'tuner_mic.denied';
      } else {
        this.micError = 'tuner_mic.error';
      }
    }
  }

  private stopMic(): void {
    this.micActive = false;
    this.micLoading = false;
    this.micListening = false;
    this.micStopped = true;
    this.smoothedFreq = 0;
    clearTimeout(this.silenceTimeout);
    this.silenceTimeout = null;
    this.silenceHolding = false;
    this.engine?.stop();
    this.engine = null;
  }

  private handlePitchData(result: PitchResult): void {
    this.zone.run(() => {
      const { frequency, clarity } = result;

      if (clarity < this.CLARITY_THRESHOLD || !isValidTunerFrequency(frequency)) {
        this.handleSilence();
        return;
      }

      this.silenceHolding = false;
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;

      this.smoothedFreq = smoothValue(this.smoothedFreq, frequency, this.SMOOTH_FACTOR);
      this.detectedFreq = Math.round(this.smoothedFreq * 100) / 100;

      const closest = getClosestString(this.smoothedFreq, this.currentTuning);
      this.closestString = closest;

      const noteName = midiToNoteName(frequencyToMidi(this.smoothedFreq));
      this.detectedNote = noteName;

      if (closest) {
        this.detectedCents = getCents(this.smoothedFreq, closest.freq);
      } else {
        this.detectedCents = 0;
      }

      this.isInTune = getTuningStatus(this.detectedCents) === 'in-tune';
      this.micListening = true;
    });
  }

  private handleSilence(): void {
    if (this.silenceHolding) return;
    this.silenceHolding = true;
    this.silenceTimeout = setTimeout(() => {
      this.zone.run(() => {
        this.micListening = false;
        this.detectedNote = null;
        this.isInTune = false;
        this.detectedFreq = 0;
      });
      this.silenceHolding = false;
      this.silenceTimeout = null;
    }, this.SILENCE_HOLD_MS);
  }
}
