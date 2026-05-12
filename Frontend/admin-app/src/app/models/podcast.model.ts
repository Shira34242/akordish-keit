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
}

export interface PodcastDetail extends Podcast {
  episodes: PodcastEpisode[];
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
  publishedAt: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
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
}

export interface UpdatePodcastEpisodeDto extends CreatePodcastEpisodeDto {}
