import { Article } from './article.model';

export enum NewsSectionType {
  ByCategory = 0,
  ByContentType = 1
}

export interface NewsPageSection {
  id: number;
  title: string;
  sectionType: NewsSectionType;
  categoryId?: number;
  categoryIds: number[];
  contentTypeId?: number;
  displayOrder: number;
  isActive: boolean;
  articleCount?: number;
  articles: Article[];
}

export interface CreateNewsPageSectionDto {
  title?: string;
  sectionType: NewsSectionType;
  categoryId?: number;
  categoryIds: number[];
  contentTypeId?: number;
  displayOrder: number;
  isActive: boolean;
}

export interface UpdateNewsPageSectionDto extends CreateNewsPageSectionDto {}
