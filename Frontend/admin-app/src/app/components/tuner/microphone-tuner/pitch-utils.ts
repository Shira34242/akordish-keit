const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function frequencyToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

export function midiToNoteName(midi: number): string {
  const idx = ((Math.round(midi) % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[idx] + octave;
}

export function smoothValue(prev: number, current: number, factor: number): number {
  return prev > 0 ? factor * prev + (1 - factor) * current : current;
}

export function computeRms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

const RMS_SILENCE_THRESHOLD = 0.01;

export function isSignalStrong(buf: Float32Array): boolean {
  return computeRms(buf) >= RMS_SILENCE_THRESHOLD;
}
