import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

export type CloudflareImagePreset =
  | 'thumb'
  | 'card'
  | 'profile'
  | 'content'
  | 'hero'
  | 'lightbox';

const PRESET_WIDTHS: Record<CloudflareImagePreset, number> = {
  thumb: 360,
  card: 600,
  profile: 320,
  content: 1000,
  hero: 1600,
  lightbox: 2000
};

const PRESET_QUALITY: Record<CloudflareImagePreset, number> = {
  thumb: 80,
  card: 82,
  profile: 82,
  content: 85,
  hero: 85,
  lightbox: 88
};

const TRANSFORMABLE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i;
const UNTOUCHED_PREFIXES = ['data:', 'blob:', 'mailto:', 'tel:'];

export function cloudflareImageUrl(
  imageUrl: string | null | undefined,
  preset: CloudflareImagePreset | number = 'card',
  quality?: number
): string {
  const original = (imageUrl || '').trim();
  if (!original) return original;

  if (!environment.imageTransformationsEnabled) {
    return unwrapCloudflareImageUrl(original);
  }

  if (isUntouchedUrl(original) || original.includes('/cdn-cgi/image/')) {
    return original;
  }

  const source = normalizeSourceUrl(original);
  if (!source || !isTransformableImage(source)) {
    return original;
  }

  const width = typeof preset === 'number' ? preset : PRESET_WIDTHS[preset];
  const imageQuality = quality ?? (typeof preset === 'number' ? 82 : PRESET_QUALITY[preset]);
  const zone = getCloudflareZone();

  return `${zone}/cdn-cgi/image/width=${width},quality=${imageQuality},format=auto/${encodeCloudflareSource(source)}`;
}

export function cloudflareBackgroundImage(
  imageUrl: string | null | undefined,
  preset: CloudflareImagePreset | number = 'card',
  quality?: number
): string | null {
  const optimizedUrl = cloudflareImageUrl(imageUrl, preset, quality);
  return optimizedUrl ? `url("${optimizedUrl.replace(/"/g, '\\"')}")` : null;
}

export function cloudflareImageSrcset(
  imageUrl: string | null | undefined,
  widths: number[] = [360, 600, 1000, 1600],
  quality = 82
): string {
  const original = (imageUrl || '').trim();
  if (!original) return '';

  const uniqueWidths = Array.from(new Set(widths))
    .filter(width => Number.isFinite(width) && width > 0)
    .sort((a, b) => a - b);

  if (uniqueWidths.length === 0) return '';

  return uniqueWidths
    .map(width => `${cloudflareImageUrl(original, width, quality)} ${width}w`)
    .join(', ');
}

function normalizeSourceUrl(url: string): string | null {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) return url;
  if (url.startsWith('uploads/')) return `/${url}`;
  return null;
}

function encodeCloudflareSource(url: string): string {
  return /^https?:\/\//i.test(url) ? encodeURIComponent(url) : encodeURI(url);
}

function isTransformableImage(url: string): boolean {
  try {
    const path = /^https?:\/\//i.test(url) ? new URL(url).pathname : url;
    return TRANSFORMABLE_EXTENSIONS.test(path);
  } catch {
    return TRANSFORMABLE_EXTENSIONS.test(url);
  }
}

function isUntouchedUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return UNTOUCHED_PREFIXES.some(prefix => lowerUrl.startsWith(prefix));
}

function getCloudflareZone(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.origin)) {
      return 'https://akordishkayt.com';
    }

    return window.location.origin;
  }

  return environment.apiBaseUrl.replace(/\/$/, '');
}

function unwrapCloudflareImageUrl(url: string): string {
  const marker = '/cdn-cgi/image/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return url;

  const sourceStart = url.indexOf('/http', markerIndex + marker.length);
  if (sourceStart < 0) return url;

  return url.slice(sourceStart + 1);
}

@Pipe({
  name: 'cfImage',
  standalone: true
})
export class CloudflareImagePipe implements PipeTransform {
  transform(
    imageUrl: string | null | undefined,
    preset: CloudflareImagePreset | number = 'card',
    quality?: number
  ): string {
    return cloudflareImageUrl(imageUrl, preset, quality);
  }
}

@Pipe({
  name: 'cfSrcset',
  standalone: true
})
export class CloudflareImageSrcsetPipe implements PipeTransform {
  transform(
    imageUrl: string | null | undefined,
    widths: number[] = [360, 600, 1000, 1600],
    quality = 82
  ): string {
    return cloudflareImageSrcset(imageUrl, widths, quality);
  }
}
