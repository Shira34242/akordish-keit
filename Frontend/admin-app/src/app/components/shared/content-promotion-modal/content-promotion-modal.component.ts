import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ContentPromotionPlacement,
  ContentPromotionService,
  ContentPromotionTargetType
} from '../../../services/content-promotion.service';

@Component({
  selector: 'app-content-promotion-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-promotion-modal.component.html',
  styleUrls: ['./content-promotion-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentPromotionModalComponent {
  @Input() targetType!: ContentPromotionTargetType;
  @Input() ids: number[] = [];
  @Input() title = 'קידום תוכן';
  @Output() close = new EventEmitter<void>();
  @Output() promoted = new EventEmitter<void>();

  readonly Placement = ContentPromotionPlacement;
  loading = false;
  placement: ContentPromotionPlacement = ContentPromotionPlacement.Index;
  priority = 100;
  durationDays = 30;
  showOnHome = false;
  note = '';

  durationOptions = [
    { label: 'שבוע', value: 7 },
    { label: 'שבועיים', value: 14 },
    { label: 'חודש', value: 30 },
    { label: 'שלושה חודשים', value: 90 },
    { label: 'ללא תאריך סיום', value: 0 }
  ];

  placementOptions = [
    { label: 'סדר כללי', value: ContentPromotionPlacement.General },
    { label: 'דף הבית', value: ContentPromotionPlacement.Home },
    { label: 'אינדקס / רשימה', value: ContentPromotionPlacement.Index },
    { label: 'מומלצים', value: ContentPromotionPlacement.Featured }
  ];

  constructor(
    private promotionService: ContentPromotionService,
    private cdr: ChangeDetectorRef
  ) {}

  get itemLabel(): string {
    switch (this.targetType) {
      case ContentPromotionTargetType.Article: return 'כתבות';
      case ContentPromotionTargetType.Artist: return 'אמנים';
      case ContentPromotionTargetType.ServiceProvider: return 'בעלי מקצוע';
      case ContentPromotionTargetType.Teacher: return 'מורים';
      case ContentPromotionTargetType.Song: return 'שירים';
      case ContentPromotionTargetType.Podcast: return 'סדרות';
      case ContentPromotionTargetType.PodcastEpisode: return 'פרקים';
      default: return 'פריטים';
    }
  }

  save(): void {
    if (!this.ids.length) return;

    const now = new Date();
    const endsAt = this.durationDays > 0
      ? new Date(now.getTime() + this.durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    this.loading = true;
    this.cdr.markForCheck();
    this.promotionService.bulkUpsert({
      targetType: this.targetType,
      targetIds: this.ids,
      placement: this.placement,
      priority: this.priority,
      startsAt: now.toISOString(),
      endsAt,
      isActive: true,
      showOnHome: this.showOnHome || this.placement === ContentPromotionPlacement.Home,
      note: this.note.trim() || null
    }).subscribe({
      next: () => {
        this.loading = false;
        this.promoted.emit();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error saving content promotion:', error);
        alert(error?.error?.message || 'שגיאה בשמירת הקידום');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
