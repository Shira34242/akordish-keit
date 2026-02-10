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
