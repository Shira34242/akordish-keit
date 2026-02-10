import { Article } from './article.model';

/**
 * מודל לתוכן מרכזי (4 כתבות בראש דף חדשות המוזיקה)
 */
export interface FeaturedContent {
  id: number;
  articleId: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  article: Article;
}

/**
 * DTO ליצירת תוכן מרכזי
 */
export interface CreateFeaturedContentDto {
  articleId: number;
  displayOrder: number;
  isActive?: boolean;
}

/**
 * DTO לעדכון תוכן מרכזי
 */
export interface UpdateFeaturedContentDto {
  articleId: number;
  displayOrder: number;
  isActive?: boolean;
}

/**
 * DTO לעדכון מהיר של כל 4 הכתבות בבת אחת
 */
export interface UpdateFeaturedContentBulkDto {
  items: FeaturedContentItemDto[];
}

export interface FeaturedContentItemDto {
  articleId: number;
  displayOrder: number;
}
