/**
 * מודלים עבור אומנים במערכת
 */

// ========================================
// Artist - מודל מלא של אומן
// ========================================
export type BannerMediaType = 'image' | 'gif' | 'video';

export interface Artist {
  id: number;
  name: string;
  englishName?: string;
  shortBio?: string;              // תיאור קצר (1-3 שורות)
  biography?: string;              // ביוגרפיה ארוכה
  imageUrl?: string;               // תמונת פרופיל
  bannerImageUrl?: string;         // תמונת באנר רגילה (אם bannerMediaType = 'image')
  bannerGifUrl?: string;           // GIF/וידאו לבאנר (אם bannerMediaType = 'gif'/'video')
  bannerMediaType?: BannerMediaType | null;  // איזה מבין הבאנרים פעיל (אחד בלבד)
  bannerBlur?: number;             // 0-20, עוצמת טשטוש על הבאנר
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

  // באנר הופעה (legacy)
  performanceImageUrl?: string;
  performanceTicketUrl?: string;
  performanceIsActive: boolean;

  // אירוע מקושר לבאנר ההופעה (חדש)
  performanceEventId?: number | null;
  performanceEvent?: PerformanceEventDetails | null;

  // סטטיסטיקות
  songCount: number;               // כמות שירים
  articleCount: number;            // כמות כתבות
  upcomingEventCount: number;      // כמות הופעות קרובות

  hits: ArtistHit[];
  albums: ArtistAlbum[];
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
  bumpedAt?: Date;
  bumpCount?: number;
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

export interface ArtistHit {
  id: number;
  title: string;
  imageUrl?: string;
  youTubeUrl?: string;
  youtubeUrl?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ArtistAlbum {
  id: number;
  title: string;
  coverImageUrl: string;
  releaseYear?: number;
  externalUrl: string;
  displayOrder: number;
  isActive: boolean;
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
  Hidden = 2,     // מוסתר/מושעה
  Draft = 3       // טיוטה שעדיין לא הושלמה
}

/**
 * פלטפורמות רשתות חברתיות
 */
export enum SocialPlatform {
  Instagram = 1,
  Facebook = 2,
  YouTube = 3,
  TikTok = 4,
  Website = 5,
  Twitter = 6,
  Spotify = 7,
  Zing = 8,
  Jewzik = 9,
  TwentyFourSix = 10,
  AppleMusic = 11
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
  bannerMediaType?: BannerMediaType | null;
  bannerBlur?: number;             // 0-20
  websiteUrl?: string;
  status?: ArtistStatus;           // ניהול סטטוס (Admin)
  isPremium?: boolean;             // חשבון משלם (Admin)
  performanceImageUrl?: string;
  performanceTicketUrl?: string;
  performanceIsActive?: boolean;
  /** null מנתק את האירוע. הגדרת אובייקט יוצרת/מעדכנת אירוע. */
  performanceEvent?: PerformanceEventInput | null;
  hits?: AddArtistHitDto[];
  albums?: AddArtistAlbumDto[];
  socialLinks?: SocialLink[];      // קישורי רשתות חברתיות
  galleryImages?: AddGalleryImageDto[];  // תמונות גלריה
  videos?: AddVideoDto[];          // סרטונים
}

/**
 * פרטי אירוע מקושר לבאנר אמן (לקריאה — מהשרת)
 */
export interface PerformanceEventDetails {
  id: number;
  name: string;
  description?: string;
  imageUrl: string;
  bannerImageUrl?: string | null;
  ticketUrl: string;
  eventDate: string;
  location?: string;
  price?: number | null;
  isActive: boolean;
}

/**
 * פרטי אירוע מקושר לבאנר אמן (לכתיבה — אל השרת)
 */
export interface PerformanceEventInput {
  /** אם קיים — מעדכנים אירוע קיים. אם לא — יוצרים חדש. */
  eventId?: number;
  name: string;
  description?: string;
  imageUrl: string;
  bannerImageUrl?: string;
  ticketUrl: string;
  eventDate: string;        // ISO string
  location?: string;
  price?: number | null;
  isActive: boolean;
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

export interface AddArtistHitDto {
  title: string;
  imageUrl?: string;
  youTubeUrl: string;
  displayOrder: number;
  isActive: boolean;
}

export interface AddArtistAlbumDto {
  title: string;
  coverImageUrl: string;
  releaseYear?: number;
  externalUrl: string;
  displayOrder: number;
  isActive: boolean;
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
