import { Article, ArticleContentType } from '../models/article.model';
import { titleSlug } from './slug';

export function normalizeArticleContentType(
  contentType: Article['contentType'] | string | number | null | undefined
): ArticleContentType {
  if (contentType === ArticleContentType.News || contentType === '0') {
    return ArticleContentType.News;
  }

  if (contentType === ArticleContentType.Blog || contentType === '1') {
    return ArticleContentType.Blog;
  }

  const value = String(contentType ?? '').toLowerCase();
  if (value === 'news' || value === 'article') {
    return ArticleContentType.News;
  }

  return ArticleContentType.Blog;
}

export function getArticleRoute(article: Pick<Article, 'contentType'>): '/news' | '/blog' {
  return normalizeArticleContentType(article.contentType) === ArticleContentType.News ? '/news' : '/blog';
}

export function getArticleSlug(article: Pick<Article, 'title' | 'slug'>): string {
  return titleSlug(article);
}

export function getArticleLink(article: Pick<Article, 'id' | 'title' | 'slug' | 'contentType'>): string[] {
  const slug = getArticleSlug(article);
  const route = getArticleRoute(article);
  return slug ? [route, String(article.id), slug] : [route, 'id', String(article.id)];
}

export function getArticlePath(article: Pick<Article, 'id' | 'title' | 'slug' | 'contentType'>): string {
  return getArticleLink(article).join('/');
}
