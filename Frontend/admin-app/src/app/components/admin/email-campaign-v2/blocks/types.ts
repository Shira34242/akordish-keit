import type { Observable } from 'rxjs';

export interface ContentItem {
  id: number;
  title: string;
  imageUrl: string;
  publicUrl: string;
  altText: string;
  categoryName?: string;
  shortDescription?: string;
  publishDate?: string;
  artistNames?: string;
  location?: string;
  eventDate?: string;
  podcastName?: string;
  cityName?: string;
  createdAt?: string;
  viewCount?: number;
}

export interface ArticleSelectionResult {
  items: ContentItem[];
  layout: 'two-column';
  showDescription: boolean;
  showCategory: boolean;
  borderRadius: number;
  spacing: number;
  cardBackground: string;
}

export interface ContentSelectionResult {
  items: ContentItem[];
}

export interface ContentSelectorConfig {
  type: string;
  title: string;
  searchPlaceholder: string;
  maxItems: number;
  displayFields?: ContentDisplayField[];
  sourceOptions?: SourceOption[];
  searchFn: (search: string, page: number, pageSize: number) => Observable<{ items: ContentItem[]; totalCount: number; hasMore: boolean }>;
}

export interface SourceOption {
  label: string;
  searchFn: (search: string, page: number, pageSize: number) => Observable<{ items: ContentItem[]; totalCount: number; hasMore: boolean }>;
}

export type ContentDisplayField = 'artistNames' | 'location' | 'date' | 'podcastName' | 'cityName';

export interface ContentTypeConfig extends ContentSelectorConfig {
  displayFields?: ContentDisplayField[];
}
