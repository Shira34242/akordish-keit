export interface EventCardData {
  id: number;
  name: string;
  imageUrl?: string;
  ticketUrl?: string;
  eventDate: string;
  location?: string;
  artistName?: string;
  taggedArtistNames?: string[];
  eventStatus: string;
  daysUntilEvent?: number;
  isPast?: boolean;
  description?: string;
}

export function getDisplayArtist(event: {
  artistName?: string;
  taggedArtistNames?: string[];
}): string | null {
  if (event.taggedArtistNames?.length) {
    return event.taggedArtistNames.join(', ');
  }
  if (event.artistName) {
    return event.artistName;
  }
  return null;
}

export function isEventPast(event: { eventDate: string; isPast?: boolean }): boolean {
  if (event.isPast !== undefined) return event.isPast;
  return new Date(event.eventDate) < new Date();
}
