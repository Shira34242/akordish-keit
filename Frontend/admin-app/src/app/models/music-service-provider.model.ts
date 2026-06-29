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
  parkingType: ServiceProviderParkingType;
  hasAccessibleEntrance: boolean;
  isAnash: boolean;
  whatsAppNumber?: string;
  phoneNumber?: string;
  email?: string;
  websiteUrl?: string;
  bannerImageUrl?: string;
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
  socialLinks: SocialLinkDto[];
  customerTestimonials: ServiceProviderTestimonialDto[];
  branches: ServiceProviderBranchDto[];
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
  bumpedAt?: string;
  bumpCount?: number;
  categoriesCount: number;
  categoryName?: string;
  branchCityIds: number[];
}

export interface CreateMusicServiceProviderDto {
  userId?: number;
  agencyId?: number;
  displayName: string;
  profileImageUrl?: string;
  shortBio?: string;
  fullDescription?: string;
  isTeacher: boolean;
  cityId?: number;
  location?: string;
  yearsOfExperience?: number;
  workingHours?: string;
  parkingType?: ServiceProviderParkingType;
  hasAccessibleEntrance?: boolean;
  isAnash?: boolean;
  whatsAppNumber?: string;
  phoneNumber?: string;
  email?: string;
  websiteUrl?: string;
  bannerImageUrl?: string;
  videoUrl?: string;
  isFeatured: boolean;
  status: ProfileStatus;
  categories?: CreateServiceProviderCategoryDto[];
  galleryImages?: CreateGalleryImageDto[];
  socialLinks?: SocialLinkDto[];
  customerTestimonials?: CreateServiceProviderTestimonialDto[];
  branches?: CreateServiceProviderBranchDto[];
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
  parkingType?: ServiceProviderParkingType;
  hasAccessibleEntrance?: boolean;
  isAnash?: boolean;
  whatsAppNumber?: string;
  phoneNumber?: string;
  email?: string;
  websiteUrl?: string;
  bannerImageUrl?: string;
  videoUrl?: string;
  isFeatured: boolean;
  status: ProfileStatus;
  categories?: CreateServiceProviderCategoryDto[];
  galleryImages?: CreateGalleryImageDto[];
  socialLinks?: SocialLinkDto[];
  customerTestimonials?: CreateServiceProviderTestimonialDto[];
  branches?: CreateServiceProviderBranchDto[];
}

export interface ServiceProviderBranchDto {
  id: number;
  name: string;
  cityId?: number;
  imageUrl?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  openingHours?: string;
  order: number;
}

export interface CreateServiceProviderBranchDto {
  name: string;
  cityId?: number;
  imageUrl?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  openingHours?: string;
  order: number;
}

export interface SocialLinkDto {
  id?: number;
  platform: SocialPlatform;
  url: string;
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

export interface ServiceProviderTestimonialDto {
  id: number;
  clientName?: string;
  text: string;
  order: number;
}

export interface CreateServiceProviderTestimonialDto {
  clientName?: string;
  text: string;
  order: number;
}

export enum ProfileStatus {
  Pending = 0,
  Active = 1,
  Suspended = 2
}

export enum ServiceProviderParkingType {
  None = 0,
  ParkingAvailable = 1,
  FreeParking = 2
}

export enum SocialPlatform {
  Instagram = 1,
  Facebook = 2,
  YouTube = 3,
  TikTok = 4,
  Website = 5,
  Twitter = 6,
  Spotify = 7,
  Zing = 8
}
