export interface AdminPermission {
  key: string;
  label: string;
  group: string;
}

export interface AdminRole {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  isSystem: boolean;
  usersCount: number;
  permissions: string[];
}

export interface SaveAdminRole {
  name: string;
  description?: string | null;
  isActive: boolean;
  permissions: string[];
}
