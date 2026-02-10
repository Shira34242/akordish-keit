// =============== Enums ===============

export enum AdCampaignStatus {
  Draft = 'Draft',
  Active = 'Active',
  Paused = 'Paused',
  Completed = 'Completed',
  Archived = 'Archived'
}

export enum AdSpotAvailability {
  Available = 'Available',
  Occupied = 'Occupied',
  Scheduled = 'Scheduled'
}

// =============== Client Models ===============

export interface Client {
  id: number;
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  totalCampaigns: number;
  activeCampaigns: number;
  totalBudget: number;
}

export interface CreateClientRequest {
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  logoUrl?: string;
}

export interface UpdateClientRequest {
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  logoUrl?: string;
  isActive: boolean;
}

// =============== AdSpot Models ===============

export interface AdSpot {
  id: number;
  name: string;
  technicalId: string;
  dimensions: string;
  isActive: boolean;
  rotationIntervalMs: number;
  description?: string;
  createdAt: Date;
  totalCampaigns: number;
  activeCampaigns: number;
  totalRevenue: number;
  availability: AdSpotAvailability;
  nextAvailableDate?: Date;
}

export interface CreateAdSpotRequest {
  name: string;
  technicalId: string;
  dimensions: string;
  rotationIntervalMs: number;
  description?: string;
}

export interface UpdateAdSpotRequest {
  name: string;
  technicalId: string;
  dimensions: string;
  isActive: boolean;
  rotationIntervalMs: number;
  description?: string;
}

// =============== AdCampaign Models ===============

export interface AdCampaign {
  id: number;
  name: string;
  adSpotId: number;
  adSpotName: string;
  clientId: number;
  clientName: string;
  knownUrl?: string;
  mediaUrl?: string;
  mobileMediaUrl?: string;
  priority: number;
  status: AdCampaignStatus;
  startDate: Date;
  endDate: Date;
  budget: number;
  viewCount: number;
  clickCount: number;
  createdAt: Date;
  updatedAt?: Date;
  daysRemaining: number;
  clickThroughRate: number;
}

export interface CreateAdCampaignRequest {
  name: string;
  adSpotId: number;
  clientId: number;
  knownUrl?: string;
  mediaUrl?: string;
  mobileMediaUrl?: string;
  priority: number;
  status: AdCampaignStatus | string;
  startDate: Date;
  endDate: Date;
  budget: number;
}

export interface UpdateAdCampaignRequest {
  name: string;
  adSpotId: number;
  clientId: number;
  knownUrl?: string;
  mediaUrl?: string;
  mobileMediaUrl?: string;
  priority: number;
  status: AdCampaignStatus;
  startDate: Date;
  endDate: Date;
  budget: number;
}

// =============== Statistics ===============

export interface AdCampaignStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalRevenue: number;
  totalClicks: number;
  totalViews: number;
  averageClickThroughRate: number;
}
