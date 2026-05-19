import { Article, ArticleContentType } from '../models/article.model';

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
