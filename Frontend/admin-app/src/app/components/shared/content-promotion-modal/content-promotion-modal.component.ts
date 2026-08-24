import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ContentPromotionPlacement,
  ContentPromotionService,
  ContentPromotionTargetType
} from '../../../services/content-promotion.service';
import { BumpService } from '../../../services/bump.service';

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
  @Input() title = 'ניהול חשיפה';
  @Input() allowBump = true;
  @Output() close = new EventEmitter<void>();
  @Output() promoted = new EventEmitter<void>();

  loading = false;
  exposureType: 'bump' | 'promotion' = 'promotion';
  durationDays = 30;
  note = '';

  readonly durationShortcuts = [7, 14, 30, 90];

  constructor(
    private promotionService: ContentPromotionService,
    private bumpService: BumpService,
    private cdr: ChangeDetectorRef
  ) {}

  get bumpEntityType(): string | null {
    switch (this.targetType) {
      case ContentPromotionTargetType.Article: return 'Article';
      case ContentPromotionTargetType.Artist: return 'Artist';
      case ContentPromotionTargetType.ServiceProvider: return 'ServiceProvider';
      case ContentPromotionTargetType.Teacher: return 'Teacher';
      case ContentPromotionTargetType.Song: return 'Song';
      default: return null;
    }
  }

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

    if (this.exposureType === 'bump' && this.allowBump && this.bumpEntityType) {
      this.saveBump(this.bumpEntityType);
      return;
    }

    const durationDays = Math.floor(Number(this.durationDays));
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 3650) {
      alert('יש להזין משך קידום בין יום אחד ל־3,650 ימים');
      return;
    }

    this.durationDays = durationDays;
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    this.loading = true;
    this.cdr.markForCheck();
    this.promotionService.bulkUpsert({
      targetType: this.targetType,
      targetIds: this.ids,
      placement: ContentPromotionPlacement.General,
      priority: 100,
      startsAt: now.toISOString(),
      endsAt,
      isActive: true,
      showOnHome: false,
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

  private saveBump(entityType: string): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.bumpService.bump({ entityType, ids: this.ids }).subscribe({
      next: () => {
        this.loading = false;
        this.promoted.emit();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error bumping content:', error);
        alert(error?.error?.message || 'שגיאה בהקפצת התוכן');
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
