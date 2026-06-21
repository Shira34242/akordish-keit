import { ContentUploaderProfile } from './article.model';

export interface AgencyPodcastBanner {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  bannerImageUrl?: string;
  shortDescription?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandTextColor?: string;
}

export interface Podcast {
  id: number;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  episodeCount: number;
  latestEpisode?: PodcastEpisode;
  agencyBanner?: AgencyPodcastBanner;
}

export interface PodcastDetail extends Podcast {
  episodes: PodcastEpisode[];
}

export type PodcastHomeCard = Pick<Podcast, 'id' | 'name' | 'slug' | 'imageUrl'>;

export interface PodcastEpisodeBanner {
  id: number;
  podcastName: string;
  podcastSlug: string;
  title: string;
  slug: string;
  thumbnailUrl?: string;
}

export interface PodcastEpisodeArtist {
  artistId: number;
  artistName: string;
  artistImageUrl?: string;
}

export interface PodcastEpisode {
  id: number;
  podcastId: number;
  podcastName: string;
  podcastSlug: string;
  title: string;
  slug: string;
  description?: string;
  episodeNumber: number;
  sourceUrl: string;
  embedUrl: string;
  thumbnailUrl?: string;
  platform: string;
  viewCount: number;
  publishedAt: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  taggedArtists?: PodcastEpisodeArtist[];

  // Uploader profile
  uploaderUserId?: number | null;
  uploaderProfileType?: 'artist' | 'serviceProvider' | 'user';
  uploaderProfileId?: number;
  uploaderProfile?: ContentUploaderProfile;
}

export interface PodcastEpisodeDetail extends PodcastEpisode {
  previousEpisode?: PodcastEpisode;
  nextEpisode?: PodcastEpisode;
  seriesEpisodes: PodcastEpisode[];
}

export interface CreatePodcastDto {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdatePodcastDto extends CreatePodcastDto {}

export interface CreatePodcastEpisodeDto {
  podcastId: number;
  title: string;
  slug?: string;
  description?: string;
  episodeNumber?: number;
  sourceUrl: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  platform?: string;
  publishedAt?: string;
  displayOrder?: number;
  isActive?: boolean;
  artistIds?: number[];

  // Uploader profile
  uploaderUserId?: number | null;
  uploaderProfileType?: 'artist' | 'serviceProvider' | 'user';
  uploaderProfileId?: number;
}

export interface UpdatePodcastEpisodeDto extends CreatePodcastEpisodeDto {}

export interface SubmitPodcastDto {
  name: string;
  sourceUrl: string;
}

export interface SubmitPodcastEpisodeDto {
  podcastId: number;
  title: string;
  sourceUrl: string;
}
