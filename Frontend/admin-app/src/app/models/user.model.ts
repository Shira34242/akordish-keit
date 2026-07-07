export interface UserWithProfileDto {
  userId?: number | null;
  displayName: string;
  imageUrl?: string;
  profileType: 'artist' | 'serviceProvider' | 'user' | 'agency';
  profileId: number;
  profileUrl: string;
  isTeacher: boolean;
  status: 'Active' | 'Pending' | 'Suspended' | 'Hidden' | 'Inactive' | 'None';
  categories: string[];
}

export interface SetPageVisibilityDto {
  profileType: 'artist' | 'serviceProvider';
  profileId: number;
  isActive: boolean;
}

export enum UserContentTag {
  None               = 0,
  Beginner           = 1,
  Contributor        = 2,
  LeadingContributor = 3
}

export interface UserListDto {
  id: number;
  username: string;
  email: string;
  profileImageUrl?: string;
  phone?: string;
  role: UserRole;
  roleName: string;
  level: number;
  points: number;
  isActive: boolean;
  emailConfirmed: boolean;
  createdAt: string;
  lastLoginAt?: string;
  preferredInstrumentId?: number | null;
  preferredInstrumentName?: string | null;
  contentTag: UserContentTag;
  uploadCount: number;
}

export interface AdminUserDetailDto extends UserListDto {
  googleId?: string | null;
  address?: string | null;
  birthDate?: string | null;
  cityId?: number | null;
  otherInstrumentName?: string | null;
  instrumentLevel?: number | null;
  instrumentLevelName?: string | null;
  marketingConsent: boolean;
  marketingConsentAt?: string | null;
  marketingConsentRevokedAt?: string | null;
  updatedAt?: string | null;
  visitCount: number;
  lastProfileReminderAt?: string | null;
  profileReminderDismissCount: number;
  lastUploadDate?: string | null;
  chordBookExportCount: number;
  instruments: AdminUserInstrumentDto[];
  pages: AdminUserPageDto[];
  agencies: AdminUserAgencyDto[];
  contentSummary: AdminUserContentSummaryDto;
}

export interface AdminUserInstrumentDto {
  id: number;
  name: string;
  englishName?: string | null;
  isPrimary: boolean;
}

export interface AdminUserPageDto {
  profileType: 'artist' | 'serviceProvider';
  profileId: number;
  displayName: string;
  imageUrl?: string | null;
  profileUrl: string;
  isTeacher: boolean;
  status: string;
  isPrimary: boolean;
  categories: string[];
}

export interface AdminUserAgencyDto {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  profileType: string;
  profileId: number;
  contactMode: string;
  showBadge: boolean;
  isFeaturedByAgency: boolean;
}

export interface AdminUserContentSummaryDto {
  songs: number;
  articles: number;
  events: number;
  playlists: number;
  favorites: number;
  ratings: number;
  knownChords: number;
  notifications: number;
}

export interface AdminUpdateUserDto {
  username: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  isActive: boolean;
}

export enum UserRole {
  Regular = 0,
  Teacher = 1,
  Artist = 2,
  Manager = 3,
  Admin = 4
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}
