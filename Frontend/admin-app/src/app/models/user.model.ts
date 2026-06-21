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
