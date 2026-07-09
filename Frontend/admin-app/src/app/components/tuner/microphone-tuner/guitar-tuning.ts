export interface TuningString {
  number: number;
  note: string;
  octave: number;
  freq: number;
  labelHe: string;
}

export const GUITAR_TUNING: TuningString[] = [
  { number: 6, note: 'E', octave: 2, freq: 82.41,  labelHe: 'E נמוך' },
  { number: 5, note: 'A', octave: 2, freq: 110.00, labelHe: 'A' },
  { number: 4, note: 'D', octave: 3, freq: 146.83, labelHe: 'D' },
  { number: 3, note: 'G', octave: 3, freq: 196.00, labelHe: 'G' },
  { number: 2, note: 'B', octave: 3, freq: 246.94, labelHe: 'B' },
  { number: 1, note: 'E', octave: 4, freq: 329.63, labelHe: 'E גבוה' },
];

export const UKULELE_TUNING: TuningString[] = [
  { number: 4, note: 'G', octave: 4, freq: 392.00, labelHe: 'G' },
  { number: 3, note: 'C', octave: 4, freq: 261.63, labelHe: 'C' },
  { number: 2, note: 'E', octave: 4, freq: 329.63, labelHe: 'E' },
  { number: 1, note: 'A', octave: 4, freq: 440.00, labelHe: 'A' },
];

export function getClosestString(frequency: number, tuning: TuningString[]): TuningString | null {
  if (frequency <= 0) return null;
  let best: TuningString | null = null;
  let bestDiff = Infinity;
  for (const s of tuning) {
    let ratio = frequency / s.freq;
    while (ratio > 1.5) ratio /= 2;
    while (ratio < 0.75) ratio *= 2;
    const diff = Math.abs(Math.log2(ratio));
    if (diff < bestDiff) { bestDiff = diff; best = s; }
  }
  return best;
}

export function getCents(frequency: number, targetFreq: number): number {
  let ratio = frequency / targetFreq;
  while (ratio > 1.5) ratio /= 2;
  while (ratio < 0.75) ratio *= 2;
  return Math.round(1200 * Math.log2(ratio));
}

export type TuningStatus = 'flat' | 'in-tune' | 'sharp';

export function getTuningStatus(cents: number): TuningStatus {
  if (Math.abs(cents) <= 5) return 'in-tune';
  return cents < 0 ? 'flat' : 'sharp';
}

export const FREQ_MIN = 70;
export const FREQ_MAX = 450;

export function isValidTunerFrequency(freq: number): boolean {
  return freq >= FREQ_MIN && freq <= FREQ_MAX;
}
