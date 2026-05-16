export function toSlug(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u0590-\u05ff]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function songSlug(song: {
  title?: string;
  artistName?: string;
  artists?: Array<{ name: string }>;
}): string {
  const title = song?.title || '';
  const artist =
    song?.artistName ||
    (song?.artists?.length ? song.artists[0].name : '');
  return toSlug(artist ? `${title}-${artist}` : title);
}

export function songRoute(id: number, song?: {
  title?: string;
  artistName?: string;
  artists?: Array<{ name: string }>;
}): (string | number)[] {
  const slug = song ? songSlug(song) : '';
  return slug ? ['/song', id, slug] : ['/song', id];
}
