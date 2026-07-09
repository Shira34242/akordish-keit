import { PitchDetector } from 'pitchy';

export interface PitchResult {
  frequency: number;
  clarity: number;
}

export class TunerEngine {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private detector: any = null;
  private rafId: number | null = null;
  private buffer: Float32Array | null = null;
  private callback: ((r: PitchResult) => void) | null = null;
  private running = false;
  sampleRate = 0;

  private readonly FFT_SIZE = 2048;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false
    });
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    this.sampleRate = this.audioCtx.sampleRate;

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = this.FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0;
    this.source.connect(this.analyser);

    this.buffer = new Float32Array(this.FFT_SIZE);
    this.detector = PitchDetector.forFloat32Array(this.FFT_SIZE);
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stream?.getTracks().forEach(t => t.stop());
    this.source?.disconnect();
    this.audioCtx?.close();
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.audioCtx = null;
    this.buffer = null;
    this.detector = null;
  }

  onData(cb: (r: PitchResult) => void): void {
    this.callback = cb;
  }

  private loop(): void {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(() => this.loop());
    if (!this.analyser || !this.buffer || !this.detector || !this.callback) return;

    this.analyser.getFloatTimeDomainData(this.buffer as Float32Array<ArrayBuffer>);
    const [freq, clarity] = this.detector.findPitch(this.buffer, this.sampleRate);
    this.callback({ frequency: freq, clarity });
  }
}
