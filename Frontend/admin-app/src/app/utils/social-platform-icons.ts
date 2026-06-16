import { SocialPlatform } from '../models/music-service-provider.model';

export function normalizeSocialPlatform(platform: unknown): SocialPlatform {
  if (typeof platform === 'number' && SocialPlatform[platform]) {
    return platform as SocialPlatform;
  }

  if (typeof platform === 'string') {
    const trimmed = platform.trim();
    const numericValue = Number(trimmed);

    if (Number.isFinite(numericValue) && SocialPlatform[numericValue]) {
      return numericValue as SocialPlatform;
    }

    const enumValue = (SocialPlatform as Record<string, number | string>)[trimmed];
    if (typeof enumValue === 'number') {
      return enumValue as SocialPlatform;
    }

    const lower = trimmed.toLowerCase();
    const matchedKey = Object.keys(SocialPlatform).find(key => key.toLowerCase() === lower);
    const matchedValue = matchedKey ? (SocialPlatform as Record<string, number | string>)[matchedKey] : undefined;
    if (typeof matchedValue === 'number') {
      return matchedValue as SocialPlatform;
    }
  }

  return SocialPlatform.Website;
}

export function normalizeExternalLinkUrl(url: string | undefined | null): string {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return '';

  if (/^(https?:|mailto:|tel:|sms:|whatsapp:|waze:)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
}

export function getSocialPlatformIconSvg(platform: SocialPlatform): string {
  const normalizedPlatform = normalizeSocialPlatform(platform);
  const icons: Record<number, string> = {
    [SocialPlatform.Facebook]: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
    [SocialPlatform.Instagram]: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" ry="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.35"/></svg>`,
    [SocialPlatform.YouTube]: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.5 6.4a3 3 0 0 0-2.1-2.1C18.6 3.8 12 3.8 12 3.8s-6.6 0-8.4.5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 1 12a31 31 0 0 0 .5 5.6 3 3 0 0 0 2.1 2.1c1.8.5 8.4.5 8.4.5s6.6 0 8.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23 12a31 31 0 0 0-.5-5.6ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>`,
    [SocialPlatform.TikTok]: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.6 7a5.4 5.4 0 0 1-3.9-1.8v9.5a5.7 5.7 0 1 1-5.7-5.7c.4 0 .8 0 1.2.1v3.2a2.5 2.5 0 1 0 1.7 2.4V2h3.1a5.4 5.4 0 0 0 3.6 4.2V7Z"/></svg>`,
    [SocialPlatform.Twitter]: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.2 2.3h3.3l-7.2 8.2 8.5 11.2h-6.7L11 14.9l-6 6.8H1.7l7.7-8.8L1.3 2.3h6.8l4.7 6.2 5.4-6.2Zm-1.2 17.5h1.8L7 4.1H5.1l11.9 15.7Z"/></svg>`,
    [SocialPlatform.Spotify]: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5A10.5 10.5 0 1 0 12 22.5 10.5 10.5 0 0 0 12 1.5Zm4.8 15.2a.8.8 0 0 1-1.1.3c-2.6-1.6-5.8-1.9-9.6-1a.8.8 0 1 1-.4-1.6c4.2-1 7.8-.6 10.8 1.2.4.2.5.7.3 1.1Zm1.3-2.9a1 1 0 0 1-1.4.3c-2.9-1.8-7.3-2.3-10.7-1.2a1 1 0 1 1-.6-1.9c4-1.2 8.9-.7 12.3 1.4.5.3.7.9.4 1.4Zm.1-3.1C14.8 8.7 9 8.5 5.7 9.5a1.2 1.2 0 0 1-.7-2.3c3.9-1.2 10.4-1 14.4 1.4a1.2 1.2 0 0 1-1.2 2.1Z"/></svg>`,
    [SocialPlatform.Website]: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 12h19M12 2.5c2.4 2.5 3.6 5.7 3.6 9.5S14.4 19 12 21.5C9.6 19 8.4 15.8 8.4 12S9.6 5 12 2.5Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    [SocialPlatform.Zing]: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-8.2 9H20v5H4l8.2-9H4V5Z"/></svg>`
  };

  return icons[normalizedPlatform] ?? icons[SocialPlatform.Website];
}
