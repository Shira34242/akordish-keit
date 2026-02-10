/**
 * מודלים עבור אומנים במערכת
 */

// ========================================
// Artist - מודל מלא של אומן
// ========================================
export interface Artist {
  id: number;
  name: string;
  englishName?: string;
  shortBio?: string;              // תיאור קצר (1-3 שורות)
  biography?: string;              // ביוגרפיה ארוכה
  imageUrl?: string;               // תמונת פרופיל
  bannerImageUrl?: string;         // תמונת באנר רגילה (לכולם)
  bannerGifUrl?: string;           // GIF/וידאו לבאנר (משלם בלבד)
  websiteUrl?: string;             // אתר אישי
  isVerified: boolean;             // אומן מאומת
  isPremium: boolean;              // חשבון משלם (deprecated - use tier)
  tier: number;                    // ProfileTier: 0=Free, 1=Subscribed
  subscriptionId?: number;         // קישור למנוי שמממן פרופיל זה
  status: ArtistStatus;            // סטטוס: Pending/Active/Hidden
  userId?: number;                 // קישור למשתמש (אם רשום)

  // מדיה
  galleryImages: ArtistGalleryImage[];  // גלריית תמונות (עד 10, משלם)
  videos: ArtistVideo[];                // וידאו מוטמע (משלם)
  socialLinks: SocialLink[];            // רשתות חברתיות

  // סטטיסטיקות
  songCount: number;               // כמות שירים
  articleCount: number;            // כמות כתבות
  upcomingEventCount: number;      // כמות הופעות קרובות

  createdAt: Date;
}

// ========================================
// ArtistListDto - לרשימות (קל יותר)
// ========================================
export interface ArtistListDto {
  id: number;
  name: string;
  shortBio?: string;
  imageUrl?: string;
  isVerified: boolean;
  isPremium: boolean;        // deprecated - use tier
  tier: number;              // ProfileTier: 0=Free, 1=Subscribed
  subscriptionId?: number;
  songCount: number;
  status: ArtistStatus;      // נדרש עבור Admin
  createdAt: Date;           // נדרש עבור Admin
}

// ========================================
// ArtistGalleryImage - תמונה בגלריה
// ========================================
export interface ArtistGalleryImage {
  id: number;
  imageUrl: string;
  caption?: string;                // כיתוב לתמונה
  displayOrder: number;            // סדר תצוגה
}

// ========================================
// ArtistVideo - וידאו מוטמע
// ========================================
export interface ArtistVideo {
  id: number;
  videoUrl: string;                // YouTube/Vimeo embed URL
  title?: string;
  displayOrder: number;
}

// ========================================
// SocialLink - קישור לרשת חברתית
// ========================================
export interface SocialLink {
  id?: number;
  platform: SocialPlatform;        // סוג הרשת
  url: string;                     // קישור
}

// ========================================
// Enums
// ========================================

/**
 * סטטוס אומן
 */
export enum ArtistStatus {
  Pending = 0,    // ממתין לאישור
  Active = 1,     // פעיל
  Hidden = 2      // מוסתר/מושעה
}

/**
 * פלטפורמות רשתות חברתיות
 */
export enum SocialPlatform {
  Facebook = 1,
  Instagram = 2,
  YouTube = 3,
  Twitter = 4,
  TikTok = 5,
  Spotify = 6,
  Website = 7
}

// ========================================
// DTOs לעדכונים
// ========================================

/**
 * DTO לעדכון פרטי אומן
 */
export interface UpdateArtistDto {
  name?: string;                   // נדרש ליצירה, אופציונלי לעדכון
  englishName?: string;
  shortBio?: string;
  biography?: string;
  imageUrl?: string;
  bannerImageUrl?: string;
  bannerGifUrl?: string;           // רק למשלם
  websiteUrl?: string;
  status?: ArtistStatus;           // ניהול סטטוס (Admin)
  isPremium?: boolean;             // חשבון משלם (Admin)
  socialLinks?: SocialLink[];      // קישורי רשתות חברתיות
  galleryImages?: AddGalleryImageDto[];  // תמונות גלריה
  videos?: AddVideoDto[];          // סרטונים
}

/**
 * DTO להוספת תמונה לגלריה
 */
export interface AddGalleryImageDto {
  imageUrl: string;
  caption?: string;
  displayOrder: number;
}

/**
 * DTO להוספת וידאו
 */
export interface AddVideoDto {
  videoUrl: string;                // YouTube/Vimeo URL
  title?: string;
  displayOrder: number;
}

/**
 * DTO להוספת/עדכון קישור לרשת חברתית
 */
export interface UpdateSocialLinksDto {
  socialLinks: SocialLink[];
}

/**
 * DTO לבוסט אומן
 */
export interface BoostArtistResponse {
  success: boolean;
  message: string;
  boostEndDate?: Date;
}

/**
 * DTO לשדרוג לחשבון משלם
 */
export interface UpgradeToPremiumResponse {
  success: boolean;
  message: string;
  paymentUrl?: string;             // קישור לתשלום
}
