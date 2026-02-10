export interface Playlist {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  isPublic: boolean;
  isAdopted: boolean;
  songCount: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PlaylistDetail {
  id: number;
  userId: number;
  name: string;
  description?: string;
  imageUrl?: string;
  isPublic: boolean;
  isAdopted: boolean;
  songs: PlaylistSong[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface PlaylistSong {
  id: number;              // PlaylistSong.Id
  songId: number;
  songTitle: string;
  songImageUrl: string;
  artistName: string;
  order: number;
  addedAt: Date;
}

export interface CreatePlaylistDto {
  name: string;
  description?: string;
  imageUrl?: string;
  isPublic?: boolean;  // ברירת מחדל: true בצד השרת
}

export interface UpdatePlaylistDto {
  name?: string;
  description?: string;
  imageUrl?: string;
  isPublic?: boolean;
}

export interface AddSongToPlaylistDto {
  songId: number;
}

export interface ReorderPlaylistDto {
  songIds: number[];
}
