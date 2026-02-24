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

export interface AddSongRequest {
    title: string;
    artists: ArtistInput[];  // שונה מ-artistIds
    youtubeUrl: string;
    spotifyUrl?: string;
    imageUrl?: string;
    tags?: TagInput[];  // שונה מ-tagIds
    lyricsWithChords: string;
    originalKeyId: number;
    easyKeyId?: number;
    composerId?: number;
    lyricistId?: number;
    arrangerId?: number;
    genres?: GenreInput[];  // שונה מ-genreIds
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
    uploadedByUserId?: number;
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
    viewCount: number;
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

export interface MusicalKey {
    id: number;
    name: string;
    displayName: string;
    isMinor: boolean;
}
