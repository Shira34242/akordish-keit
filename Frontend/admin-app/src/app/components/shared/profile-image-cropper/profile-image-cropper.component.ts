import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile-image-cropper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-image-cropper.component.html',
  styleUrls: ['./profile-image-cropper.component.scss']
})
export class ProfileImageCropperComponent implements OnInit, OnDestroy {
  @Input() sourceFile?: File | null;
  @Input() sourceUrl?: string | null;
  @Input() fileName = 'profile-image';
  @Output() cropped = new EventEmitter<File>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('imageEl') imageEl?: ElementRef<HTMLImageElement>;

  readonly viewportSize = 280;
  readonly outputSize = 720;

  imageSrc = '';
  loadError = '';
  naturalWidth = 0;
  naturalHeight = 0;
  minScale = 1;
  scale = 1;
  offsetX = 0;
  offsetY = 0;

  private objectUrl?: string;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartOffsetX = 0;
  private dragStartOffsetY = 0;

  ngOnInit(): void {
    this.prepareSource();
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  get imageWidth(): number {
    return this.naturalWidth * this.scale;
  }

  get imageHeight(): number {
    return this.naturalHeight * this.scale;
  }

  get imageTransform(): string {
    return `translate(calc(-50% + ${this.offsetX}px), calc(-50% + ${this.offsetY}px))`;
  }

  onImageLoad(image: HTMLImageElement): void {
    this.loadError = '';
    this.naturalWidth = image.naturalWidth;
    this.naturalHeight = image.naturalHeight;

    if (!this.naturalWidth || !this.naturalHeight) {
      this.loadError = 'לא הצלחנו לקרוא את התמונה.';
      return;
    }

    this.minScale = Math.max(
      this.viewportSize / this.naturalWidth,
      this.viewportSize / this.naturalHeight
    );
    this.scale = this.minScale;
    this.offsetX = 0;
    this.offsetY = 0;
    this.constrainOffsets();
  }

  onImageError(): void {
    this.loadError = 'לא הצלחנו לפתוח את התמונה לעריכה. אפשר להעלות אותה מחדש ולמקד אותה.';
  }

  onPointerDown(event: PointerEvent): void {
    if (this.loadError) return;

    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartOffsetX = this.offsetX;
    this.dragStartOffsetY = this.offsetY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;

    this.offsetX = this.dragStartOffsetX + event.clientX - this.dragStartX;
    this.offsetY = this.dragStartOffsetY + event.clientY - this.dragStartY;
    this.constrainOffsets();
  }

  onPointerUp(event: PointerEvent): void {
    this.dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  onScaleChange(): void {
    this.scale = Math.max(this.minScale, this.scale);
    this.constrainOffsets();
  }

  zoomIn(): void {
    this.scale = Math.min(this.minScale * 3, this.scale + this.minScale * 0.12);
    this.constrainOffsets();
  }

  zoomOut(): void {
    this.scale = Math.max(this.minScale, this.scale - this.minScale * 0.12);
    this.constrainOffsets();
  }

  save(): void {
    const image = this.imageEl?.nativeElement;
    if (!image || this.loadError) return;

    const canvas = document.createElement('canvas');
    canvas.width = this.outputSize;
    canvas.height = this.outputSize;
    const context = canvas.getContext('2d');

    if (!context) {
      this.loadError = 'לא הצלחנו להכין את התמונה לשמירה.';
      return;
    }

    const left = (this.viewportSize - this.imageWidth) / 2 + this.offsetX;
    const top = (this.viewportSize - this.imageHeight) / 2 + this.offsetY;
    const sourceX = Math.max(0, -left / this.scale);
    const sourceY = Math.max(0, -top / this.scale);
    const sourceSize = Math.min(
      this.viewportSize / this.scale,
      this.naturalWidth - sourceX,
      this.naturalHeight - sourceY
    );

    try {
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        this.outputSize,
        this.outputSize
      );

      canvas.toBlob(blob => {
        if (!blob) {
          this.loadError = 'לא הצלחנו לשמור את המיקוד.';
          return;
        }

        this.cropped.emit(new File([blob], this.getOutputFileName(), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    } catch {
      this.loadError = 'לא ניתן לערוך את התמונה הקיימת. אפשר להעלות אותה מחדש ולמקד אותה.';
    }
  }

  close(): void {
    this.cancel.emit();
  }

  private prepareSource(): void {
    this.revokeObjectUrl();
    this.loadError = '';

    if (this.sourceFile) {
      this.objectUrl = URL.createObjectURL(this.sourceFile);
      this.imageSrc = this.objectUrl;
      this.fileName = this.sourceFile.name || this.fileName;
      return;
    }

    if (this.sourceUrl) {
      this.imageSrc = this.sourceUrl;
      return;
    }

    this.loadError = 'לא נבחרה תמונה לעריכה.';
  }

  private constrainOffsets(): void {
    const maxX = Math.max(0, (this.imageWidth - this.viewportSize) / 2);
    const maxY = Math.max(0, (this.imageHeight - this.viewportSize) / 2);
    this.offsetX = Math.min(maxX, Math.max(-maxX, this.offsetX));
    this.offsetY = Math.min(maxY, Math.max(-maxY, this.offsetY));
  }

  private getOutputFileName(): string {
    const base = this.fileName.replace(/\.[^.]+$/, '') || 'profile-image';
    return `${base}-focused.jpg`;
  }

  private revokeObjectUrl(): void {
    if (!this.objectUrl) return;
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
}
