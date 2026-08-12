import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoConfig {
  title: string;
  description?: string;
  path?: string;
  imageUrl?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly siteName = 'אקורדישקייט';
  private readonly defaultDescription =
    'אקורדישקייט הוא מאגר אקורדים, שירים, אמנים, חדשות מוזיקה, הופעות ואינדקס בעלי מקצוע בעולם המוזיקה היהודית.';
  private readonly defaultShareImagePath = '/akordishkayt-share-default-v2.jpg';
  private readonly jsonLdId = 'akordishkeit-json-ld';

  constructor(
    private readonly titleService: Title,
    private readonly meta: Meta,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  set(config: SeoConfig): void {
    const title = this.withSiteName(config.title);
    const description = config.description || this.defaultDescription;
    const canonicalUrl = this.absoluteUrl(config.path || this.currentPath());
    const imageUrl = this.absoluteUrl(this.defaultShareImagePath);

    this.titleService.setTitle(title);
    this.setTag('name', 'description', description);
    this.setTag('name', 'robots', config.noIndex ? 'noindex, nofollow' : 'index, follow');
    this.setTag('property', 'og:locale', 'he_IL');
    this.setTag('property', 'og:site_name', this.siteName);
    this.setTag('property', 'og:title', title);
    this.setTag('property', 'og:description', description);
    this.setTag('property', 'og:type', config.type || 'website');
    this.setTag('property', 'og:url', canonicalUrl);
    this.setTag('name', 'twitter:card', 'summary_large_image');
    this.setTag('name', 'twitter:title', title);
    this.setTag('name', 'twitter:description', description);

    this.setTag('property', 'og:image', imageUrl);
    this.setTag('property', 'og:image:secure_url', imageUrl);
    this.setTag('property', 'og:image:width', '1181');
    this.setTag('property', 'og:image:height', '1181');
    this.setTag('property', 'og:image:type', 'image/jpeg');
    this.setTag('property', 'og:image:alt', this.siteName);
    this.setTag('name', 'twitter:image', imageUrl);
    this.setTag('name', 'twitter:image:alt', this.siteName);

    this.setCanonical(canonicalUrl);
    this.setJsonLd(config.structuredData || this.organizationSchema(canonicalUrl));
  }

  organizationSchema(url?: string): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: this.siteName,
      url: url || this.absoluteUrl('/'),
      logo: this.absoluteUrl('/favicon.ico')
    };
  }

  breadcrumbSchema(items: Array<{ name: string; path: string }>): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: this.absoluteUrl(item.path)
      }))
    };
  }

  absoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const origin = this.document.location.origin;
    const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${origin}${path}`.split('#')[0];
  }

  canonicalPath(configuredUrl: string | null | undefined, fallbackPath: string): string {
    const candidate = configuredUrl?.trim();
    if (!candidate) return fallbackPath;
    if (candidate.startsWith('/')) return candidate;

    try {
      const url = new URL(candidate);
      return url.protocol === 'http:' || url.protocol === 'https:' ? candidate : fallbackPath;
    } catch {
      return fallbackPath;
    }
  }

  private withSiteName(title: string): string {
    return title.includes(this.siteName) ? title : `${title} - ${this.siteName}`;
  }

  private currentPath(): string {
    return `${this.document.location.pathname}${this.document.location.search}`;
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: Record<string, unknown> | Record<string, unknown>[]): void {
    let script = this.document.getElementById(this.jsonLdId) as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.id = this.jsonLdId;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  private setTag(attr: 'name' | 'property', key: string, content: string): void {
    this.meta.updateTag({ [attr]: key, content });
  }

}
