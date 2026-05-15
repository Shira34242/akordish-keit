export interface UserWithProfile {
    userId?: number | null;
    displayName: string;
    imageUrl?: string;
    profileType: 'artist' | 'serviceProvider' | 'user';
    profileId: number;
    profileUrl: string;
}

export interface ArtistInput {
    id?: number;  // undefined/null = אמן חדש
    name: string;
}

export interface GenreInput {
    id?: number;  // undefined/null = ז'אנר חדש
    name: string;
}

export interface TagInput {
    id?: number;  // undefined/null = תגית חדשה
    name: string;
}

export interface PersonInput {
    id?: number;  // undefined/null = אדם חדש
    name: string;
}

export interface AddSongRequest {
    title: string;
    artists: ArtistInput[];  // שונה מ-artistIds
    youtubeUrl: string;
    spotifyUrl?: string;
    imageUrl?: string;
    sheetMusicUrl?: string;
    tags?: TagInput[];  // שונה מ-tagIds
    lyricsWithChords: string;
    originalKeyId: number;
    easyKeyId?: number;
    composer?: PersonInput;  // שונה מ-composerId
    lyricist?: PersonInput;  // שונה מ-lyricistId
    arranger?: PersonInput;  // שונה מ-arrangerId
    genres?: GenreInput[];  // שונה מ-genreIds
    isApproved?: boolean;
    uploaderUserId?: number | null;
    uploaderProfileType?: 'artist' | 'serviceProvider' | 'user';
    uploaderProfileId?: number;
}

export interface SongDto {
    id: number;
    title: string;
    artists: ArtistBasicDto[];
    lyricsWithChords: string;
    originalKeyId: number;
    originalKeyName: string;
    easyKeyId?: number;
    easyKeyName?: string;
    youtubeUrl: string;
    spotifyUrl?: string;
    imageUrl?: string;
    sheetMusicUrl?: string;
    composer?: PersonBasicDto;
    lyricist?: PersonBasicDto;
    arranger?: PersonBasicDto;
    genres: GenreDto[];
    tags: TagDto[];
    isApproved: boolean;
    viewCount: number;
    playCount: number;
    language?: string;
    durationSeconds?: number;
    createdAt: Date;
    updatedAt?: Date;
    bumpedAt?: Date;
    bumpCount?: number;
    uploadedByUserId?: number;
    uploaderUserId?: number | null;
    uploaderProfileType?: 'artist' | 'serviceProvider' | 'user';
    uploaderProfileId?: number;
    uploaderProfile?: import('./article.model').ContentUploaderProfile;
    averageRating?: number;
    ratingCount?: number;
}

export interface ArtistBasicDto {
    id: number;
    name: string;
    englishName?: string;
    imageUrl?: string;
}

export interface PersonBasicDto {
    id: number;
    name: string;
    englishName?: string;
}

export interface GenreDto {
    id: number;
    name: string;
}

export interface TagDto {
    id: number;
    name: string;
}

export interface AutocompleteResult {
    id?: number;
    value: string;
    displayText: string;
    secondaryText?: string;
    imageUrl?: string;
    type: 'artist' | 'tag' | 'person' | 'genre';
}

export interface DuplicateCheckResponse {
    isPotentialDuplicate: boolean;
    similarSongs: SongBasicDto[];
    message: string;
}

export interface SongBasicDto {
    id: number;
    title: string;
    artistNames: string;
    imageUrl?: string;
    isApproved?: boolean;
    viewCount: number;
    createdAt?: string;
}

export interface YouTubeMetadata {
    success: boolean;
    title?: string;
    channelTitle?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    description?: string;
    publishedAt?: Date;
    errorMessage?: string;
}

export interface YouTubeSearchResult {
    videoId: string;
    youtubeUrl: string;
    title?: string;
    channelTitle?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    description?: string;
    publishedAt?: Date;
    suggestedArtistName?: string;
}

export interface MusicalKey {
    id: number;
    name: string;
    displayName: string;
    isMinor: boolean;
}

export interface DetectKeyResponse {
    originalKeyId: number | null;
    easyKeyId: number | null;
}

export interface ImportedSongDraft {
    title: string;
    artists: ArtistInput[];
    youtubeUrl: string;
    imageUrl?: string;
    lyricsWithChords: string;
    originalKeyId: number;
    easyKeyId?: number | null;
    tags?: TagInput[];
}

export interface ImportSongFromUrlResponse {
    success: boolean;
    message: string;
    sourceUrl: string;
    songId?: number;
    draft: ImportedSongDraft;
    missingFields: string[];
}
