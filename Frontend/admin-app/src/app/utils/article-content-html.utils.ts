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
