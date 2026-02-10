export interface MusicServiceProviderDto {
  id: number;
  userId?: number;
  userName?: string;
  userEmail?: string;
  displayName: string;
  profileImageUrl?: string;
  shortBio?: string;
  fullDescription?: string;
  isTeacher: boolean;
  cityId?: number;
  cityName?: string;
  location?: string;
  yearsOfExperience?: number;
  workingHours?: string;
  whatsAppNumber?: string;
  phoneNumber?: string;
  email?: string;
  websiteUrl?: string;
  videoUrl?: string;
  isFeatured: boolean;
  status: ProfileStatus;
  statusName: string;
  tier: number;                // ProfileTier: 0=Free, 1=Subscribed
  subscriptionId?: number;     // קישור למנוי
  isPrimaryProfile: boolean;   // האם פרופיל ראשי (כלול במחיר) או תוסף
  createdAt: string;
  updatedAt?: string;
  categories: ServiceProviderCategoryDto[];
  galleryImages: GalleryImageDto[];
}

export interface MusicServiceProviderListDto {
  id: number;
  userId?: number;
  displayName: string;
  userName?: string;
  profileImageUrl?: string;
  cityId?: number;
  cityName?: string;
  location?: string;
  yearsOfExperience?: number;
  isTeacher: boolean;
  isFeatured: boolean;
  status: ProfileStatus;
  statusName: string;
  tier: number;                // ProfileTier: 0=Free, 1=Subscribed
  subscriptionId?: number;
  isPrimaryProfile: boolean;
  createdAt: string;
  categoriesCount: number;
  categoryName?: string;
}

export interface CreateMusicServiceProviderDto {
  userId?: number;
  displayName: string;
  profileImageUrl?: string;
  shortBio?: string;
  fullDescription?: string;
  isTeacher: boolean;
  cityId?: number;
  location?: string;
  yearsOfExperience?: number;
  workingHours?: string;
  whatsAppNumber?: string;
  phoneNumber?: string;
  email?: string;
  websiteUrl?: string;
  videoUrl?: string;
  isFeatured: boolean;
  status: ProfileStatus;
  categories?: CreateServiceProviderCategoryDto[];
  galleryImages?: CreateGalleryImageDto[];
}

export interface UpdateMusicServiceProviderDto {
  displayName: string;
  profileImageUrl?: string;
  shortBio?: string;
  fullDescription?: string;
  cityId?: number;
  location?: string;
  yearsOfExperience?: number;
  workingHours?: string;
  whatsAppNumber?: string;
  phoneNumber?: string;
  email?: string;
  websiteUrl?: string;
  videoUrl?: string;
  isFeatured: boolean;
  status: ProfileStatus;
  categories?: CreateServiceProviderCategoryDto[];
  galleryImages?: CreateGalleryImageDto[];
}

export interface ServiceProviderCategoryDto {
  id: number;
  categoryId: number;
  categoryName: string;
  subCategory?: string;
}

export interface CreateServiceProviderCategoryDto {
  categoryId: number;
  subCategory?: string;
}

export interface GalleryImageDto {
  id: number;
  imageUrl: string;
  caption?: string;
  order: number;
}

export interface CreateGalleryImageDto {
  imageUrl: string;
  caption?: string;
  order: number;
}

export enum ProfileStatus {
  Pending = 0,
  Active = 1,
  Suspended = 2
}
