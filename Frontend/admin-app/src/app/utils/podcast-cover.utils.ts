import { Podcast, PodcastDetail, PodcastEpisode } from '../models/podcast.model';

type PodcastWithOptionalEpisodes = (Podcast | PodcastDetail) & {
  episodes?: PodcastEpisode[];
};

export function getPodcastCoverUrl(podcast: PodcastWithOptionalEpisodes | null | undefined): string | null {
  if (!podcast) return null;

  const imageUrl = (podcast.imageUrl || '').trim();
  if (imageUrl && !isKnownBrokenExternalImage(imageUrl)) return imageUrl;

  return podcast.latestEpisode?.thumbnailUrl
    || podcast.episodes?.find(episode => !!episode.thumbnailUrl)?.thumbnailUrl
    || null;
}

function isKnownBrokenExternalImage(url: string): boolean {
  return /(^|\.)emess\.co\.il\//i.test(url);
}
