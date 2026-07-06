import { Article } from './article.model';
import { Podcast } from './podcast.model';
import { SongDto } from './song.model';
import { SocialPlatform } from './artist.model';

export enum AgencyContactMode {
  Direct = 0,
  Agency = 1,
  Both = 2
}

export type AgencyContactModeValue = AgencyContactMode | keyof typeof AgencyContactMode | number | string | null | undefined;

export function normalizeAgencyContactMode(mode: AgencyContactModeValue): AgencyContactMode {
  if (mode === AgencyContactMode.Agency || mode === 'Agency' || mode === '1') return AgencyContactMode.Agency;
  if (mode === AgencyContactMode.Both || mode === 'Both' || mode === '2') return AgencyContactMode.Both;
  return AgencyContactMode.Direct;
}

export interface AgencyGalleryImageDto {
  id: number;
  agencyId: number;
  mediaType: 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
  caption?: string;
  displayOrder: number;
}

export interface AgencySocialLinkDto {
  id: number;
  agencyId: number;
  platform: SocialPlatform;
  url: string;
}

export interface AgencyListDto {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  bannerImageUrl?: string;
  bannerBlur: number;
  shortDescription?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandTextColor?: string;
  isActive: boolean;
  showInIndexBanner: boolean;
  displayOrder: number;
  profilesCount: number;
  contentsCount: number;
  createdAt: string;
}

export interface AgencyDto extends AgencyListDto {
  fullDescription?: string;
  phoneNumber?: string;
  whatsAppNumber?: string;
  email?: string;
  websiteUrl?: string;
  profiles: AgencyProfileDto[];
  contents: AgencyContentDto[];
  galleryImages: AgencyGalleryImageDto[];
  socialLinks: AgencySocialLinkDto[];
}

export interface AgencyPublicDto extends AgencyDto {
  artists: AgencyProfileCardDto[];
  serviceProviders: AgencyProfileCardDto[];
  teachers: AgencyProfileCardDto[];
  directArticles: Article[];
  directSongs: SongDto[];
  directPodcasts: Podcast[];
  memberArticles: Article[];
  memberSongs: SongDto[];
}

export interface AgencyProfileDto {
  id: number;
  agencyId: number;
  profileType: 'artist' | 'serviceProvider';
  profileId: number;
  contactMode: AgencyContactMode;
  showBadge: boolean;
  isFeaturedByAgency: boolean;
  displayOrder: number;
  profileName?: string;
  profileImageUrl?: string;
  isTeacher: boolean;
  profileUrl?: string;
}

export interface AgencyContentDto {
  id: number;
  agencyId: number;
  contentType: 'article' | 'song' | 'podcast';
  contentId: number;
  isFeatured: boolean;
  displayOrder: number;
  title?: string;
}

export interface AgencyProfileCardDto {
  id: number;
  profileType: 'artist' | 'serviceProvider';
  name: string;
  imageUrl?: string;
  subtitle?: string;
  profileUrl: string;
  isTeacher: boolean;
  contactMode: AgencyContactMode;
}

export interface AgencyBadgeDto {
  agencyId: number;
  agencyName: string;
  agencySlug: string;
  logoUrl?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandTextColor?: string;
  contactMode: AgencyContactMode;
  showBadge: boolean;
  phoneNumber?: string;
  whatsAppNumber?: string;
  email?: string;
  websiteUrl?: string;
}

export interface CreateAgencyDto {
  name: string;
  slug?: string;
  logoUrl?: string;
  bannerImageUrl?: string;
  bannerBlur: number;
  shortDescription?: string;
  fullDescription?: string;
  phoneNumber?: string;
  whatsAppNumber?: string;
  email?: string;
  websiteUrl?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandTextColor?: string;
  isActive: boolean;
  showInIndexBanner: boolean;
  displayOrder: number;
}

export type UpdateAgencyDto = CreateAgencyDto;

export interface UpsertAgencyProfileDto {
  profileType: 'artist' | 'serviceProvider' | 'teacher';
  profileId: number;
  contactMode: AgencyContactMode;
  showBadge: boolean;
  isFeaturedByAgency: boolean;
  displayOrder: number;
}

export interface UpsertAgencyContentDto {
  contentType: 'article' | 'song' | 'podcast';
  contentId: number;
  isFeatured: boolean;
  displayOrder: number;
}
