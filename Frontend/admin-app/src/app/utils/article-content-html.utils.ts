import { cloudflareImageSrcset, cloudflareImageUrl } from '../pipes/cloudflare-image.pipe';

const ARTICLE_IMAGE_SIZES = '(max-width: 768px) 100vw, 720px';

export function prepareArticleContentHtml(content: string | null | undefined): string {
  const html = content || '';
  if (!html.trim() || typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');

  doc.body.querySelectorAll('img').forEach(image => {
    const originalSrc = image.getAttribute('src') || '';
    const optimizedSrc = cloudflareImageUrl(originalSrc, 'content');

    if (optimizedSrc && optimizedSrc !== originalSrc) {
      image.setAttribute('srcset', cloudflareImageSrcset(originalSrc, [480, 720, 1000, 1400], 85));
      image.setAttribute('sizes', ARTICLE_IMAGE_SIZES);
      image.setAttribute('data-original-src', originalSrc);
    }

    image.setAttribute('loading', 'lazy');
    image.setAttribute('decoding', 'async');
  });

  doc.body.querySelectorAll<HTMLAnchorElement>('a.content-mention').forEach(anchor => {
    anchor.removeAttribute('target');
  });

  return doc.body.innerHTML;
}

export function attachArticleContentImageFallbacks(root: HTMLElement): void {
  root.querySelectorAll<HTMLImageElement>('img[data-original-src]').forEach(image => {
    if (image.dataset['fallbackBound'] === 'true') return;

    image.dataset['fallbackBound'] = 'true';
    image.addEventListener('error', () => {
      const originalSrc = image.dataset['originalSrc'];
      if (!originalSrc || image.src.endsWith(originalSrc)) return;

      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = originalSrc;
    });
  });
}

export function attachArticleContentMentionRouting(root: HTMLElement, navigate: (url: string) => void): void {
  root.querySelectorAll<HTMLAnchorElement>('a.content-mention[href]').forEach(anchor => {
    if (anchor.dataset['mentionRoutingBound'] === 'true') return;

    anchor.dataset['mentionRoutingBound'] = 'true';
    anchor.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const internalUrl = getInternalArticleLink(anchor.getAttribute('href'));
      if (!internalUrl) return;

      event.preventDefault();
      navigate(internalUrl);
    });
  });
}

function getInternalArticleLink(href: string | null): string | null {
  const value = href?.trim();
  if (!value || value === '#') return null;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value.startsWith('/') ? value : null;
  }
}
