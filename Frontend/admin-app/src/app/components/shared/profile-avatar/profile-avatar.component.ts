import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

type AvatarSize = 'fill' | 'sm' | 'md' | 'lg' | 'xl';
type AvatarShape = 'circle' | 'rounded';

@Component({
  selector: 'app-profile-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-avatar.component.html',
  styleUrls: ['./profile-avatar.component.css']
})
export class ProfileAvatarComponent implements OnChanges {
  @Input() name: string | null | undefined;
  @Input() imageUrl: string | null | undefined;
  @Input() srcset: string | null | undefined;
  @Input() sizes: string | null | undefined;
  @Input() identity: string | number | null | undefined;
  @Input() alt: string | null | undefined;
  @Input() size: AvatarSize = 'fill';
  @Input() shape: AvatarShape = 'circle';
  @Input() loading: 'eager' | 'lazy' = 'lazy';

  imageFailed = false;
  backgroundColor = '#ddff53';

  private readonly palette = [
    '#ddff53',
    '#f2f2f2',
    '#e8f4ff',
    '#e9f7ef',
    '#fff2cc',
    '#f4edff',
    '#ffe8e0',
    '#e7f7f4'
  ];

  ngOnChanges(): void {
    this.imageFailed = false;
    this.backgroundColor = this.pickColor();
  }

  get hasImage(): boolean {
    return !!this.imageUrl?.trim() && !this.imageFailed;
  }

  get initial(): string {
    const value = (this.name || '').trim();
    if (!value) return '?';

    const chars = Array.from(value);
    return (chars[0] || '?').toUpperCase();
  }

  get resolvedAlt(): string {
    return this.alt || this.name || 'Profile';
  }

  handleImageError(): void {
    this.imageFailed = true;
  }

  private pickColor(): string {
    const source = String(this.identity ?? this.name ?? '');
    let hash = 0;

    for (const char of Array.from(source)) {
      hash = ((hash << 5) - hash) + char.codePointAt(0)!;
      hash |= 0;
    }

    return this.palette[Math.abs(hash) % this.palette.length];
  }
}
