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
