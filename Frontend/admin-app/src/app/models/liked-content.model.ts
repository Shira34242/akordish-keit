export interface LikedContent {
  id: number;
  contentType: 'Article' | 'BlogPost';
  contentId: number;
  likedAt: Date;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  slug?: string;
}

export interface AddLikedContentDto {
  contentType: 'Article' | 'BlogPost';
  contentId: number;
}

export interface ContentReactionCount {
  reaction: string;
  count: number;
}

export interface ContentReactionSummary {
  isLiked: boolean;
  userReaction: string | null;
  totalCount: number;
  reactions: ContentReactionCount[];
}
