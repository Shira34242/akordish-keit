import { ContentUploaderProfile } from '../models/article.model';

export interface EventCardData {
  id: number;
  name: string;
  imageUrl?: string;
  ticketUrl?: string;
  eventDate: string;
  location?: string;
  artistName?: string;
  taggedArtists?: EventCardArtist[];
  taggedArtistNames?: string[];
  eventStatus: string;
  daysUntilEvent?: number;
  isPast?: boolean;
  isApproved?: boolean;
  description?: string;
  uploaderProfile?: ContentUploaderProfile;
}

export interface EventCardArtist {
  artistId: number;
  artistName: string;
  artistImageUrl?: string;
  filterKey?: string;
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

export function hasDisplayEventTitle(event: {
  name?: string;
  artistName?: string;
  taggedArtistNames?: string[];
  location?: string;
}): boolean {
  const title = event.name?.trim();
  if (!title) return false;

  const displayArtist = getDisplayArtist(event)?.trim();
  const fallbackTitles = [
    displayArtist,
    event.artistName?.trim(),
    event.location?.trim(),
    'הופעה חדשה',
    'אירוע חדש'
  ].filter(Boolean);

  return !fallbackTitles.some(fallback => fallback === title);
}

export function isEventPast(event: { eventDate: string; isPast?: boolean }): boolean {
  if (event.isPast !== undefined) return event.isPast;
  return new Date(event.eventDate) < new Date();
}
