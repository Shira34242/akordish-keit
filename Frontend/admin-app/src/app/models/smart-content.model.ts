export type SmartContentType = 'song' | 'article' | 'music-news' | 'event' | 'podcast';

export interface ImportedContentDraft {
  contentType: Exclude<SmartContentType, 'song'>;
  title: string;
  description?: string;
  imageUrl?: string;
  sourceUrl: string;
  platform?: string;
  publishedAt?: string;
  location?: string;
  artistName?: string;
}

export interface ImportContentFromUrlResponse {
  success: boolean;
  message: string;
  sourceUrl: string;
  draft?: ImportedContentDraft;
  missingFields: string[];
}

export interface StoredSmartDraft extends ImportedContentDraft {
  storedAt: number;
}
