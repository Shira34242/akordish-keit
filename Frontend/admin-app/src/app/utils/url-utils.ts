export function normalizeWebsiteUrl(url: string | undefined | null): string | undefined {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return undefined;

  if (/^(https?|ftp):\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
}
