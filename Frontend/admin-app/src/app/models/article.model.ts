export interface ContentUploaderProfile {
    type: 'artist' | 'serviceProvider' | 'user';
    profileId: number;
    name: string;
    imageUrl?: string;
    profileUrl: string;
}

export interface ArticleGalleryImage {
    id: number;
    imageUrl: string;
    caption?: string;
    displayOrder: number;
}

export interface ArticleArtist {
    artistId: number;
    artistName: string;
    artistImageUrl?: string;
}

export interface Article {
    id: number;
    title: string;
    subtitle?: string;
    content: string;
    featuredImageUrl?: string;
    publishDate: string;
    createdAt: string;
    updatedAt?: string;
    bumpedAt?: string;
    bumpCount?: number;
    authorName?: string;
    categoryIds: number[];
    categoryNames: string[];
    contentType: ArticleContentType;
    slug: string;
    canonicalUrl?: string;
    videoEmbedUrl?: string;
    audioEmbedUrl?: string;
    imageCredit?: string;
    featuredImageCredit?: string;
    shortDescription?: string;
    isFeatured: boolean;
    displayOrder: number;
    status: ArticleStatus;
    scheduledDate?: string;
    isPremium: boolean;
    metaTitle?: string;
    metaDescription?: string;
    openGraphImageUrl?: string;
    viewCount: number;
    likeCount: number;
    readTimeMinutes?: number;
    createdBy?: string;
    updatedBy?: string;
    tagIds: number[];
    tags: string[];
    galleryImages: ArticleGalleryImage[];
    taggedArtists: ArticleArtist[];
    uploaderProfile?: ContentUploaderProfile;
    submittedByUserId?: number | null;
    uploaderUserId?: number | null;
    uploaderProfileType?: 'artist' | 'serviceProvider' | 'user';
    uploaderProfileId?: number;
}

export type ArticleBanner = Pick<
    Article,
    'id' | 'title' | 'featuredImageUrl' | 'slug' | 'shortDescription' |
    'contentType' | 'isFeatured' | 'displayOrder' | 'publishDate'
>;

export interface CreateArticleDto {
    title: string;
    subtitle?: string;
    content: string;
    featuredImageUrl?: string;
    authorName?: string;
    categoryIds: number[];
    contentType: ArticleContentType;
    slug: string;
    canonicalUrl?: string;
    videoEmbedUrl?: string;
    audioEmbedUrl?: string;
    imageCredit?: string;
    featuredImageCredit?: string;
    shortDescription?: string;
    isFeatured: boolean;
    displayOrder: number;
    status: ArticleStatus;
    scheduledDate?: string;
    isPremium: boolean;
    metaTitle?: string;
    metaDescription?: string;
    openGraphImageUrl?: string;
    readTimeMinutes?: number;
    tagIds?: number[];
    galleryImages?: {
        imageUrl: string;
        caption?: string;
        displayOrder: number;
    }[];
    artistIds?: number[];
    uploaderUserId?: number | null;
    uploaderProfileType?: 'artist' | 'serviceProvider' | 'user';
    uploaderProfileId?: number;
}

export enum ArticleCategory {
    General = 1,
    News = 2,
    Reviews = 3,
    Interviews = 4,
    Features = 5,
    LiveReports = 6,
    AlbumReviews = 7,
    MusicTech = 8,
    Education = 9,
    Popular = 10,
    Clips = 11,
    Blog = 12,
    Opinion = 13,
    Charts = 14,
    BehindTheScenes = 15
}

export enum ArticleContentType {
    News = 0,
    Blog = 1
}

export enum ArticleStatus {
    Draft = 0,
    Published = 1,
    Scheduled = 2,
    Archived = 3
}
