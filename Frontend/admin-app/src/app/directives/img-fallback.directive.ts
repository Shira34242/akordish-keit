import { Directive, HostListener, Input } from '@angular/core';

/**
 * ImgFallbackDirective
 * מוסיף fallback לתמונות שנכשלות בטעינה.
 * שימוש: <img [src]="..." imgFallback>
 * אפשר לדרוס: <img [src]="..." imgFallback="/other.png">
 */
@Directive({
  selector: 'img[imgFallback]',
  standalone: true
})
export class ImgFallbackDirective {
  @Input() imgFallback = '/default-user.svg';
  @Input() imgFallbackOriginal: string | null | undefined;

  private triedOriginal = false;

  @HostListener('error', ['$event'])
  onError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;

    const original = (this.imgFallbackOriginal || '').trim();
    if (!this.triedOriginal && original && img.src !== original) {
      this.triedOriginal = true;
      img.src = original;
      return;
    }

    img.src = this.imgFallback;
  }
}
