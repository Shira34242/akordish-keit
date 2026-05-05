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

  @HostListener('error', ['$event'])
  onError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    img.onerror = null;
    img.src = this.imgFallback;
  }
}
