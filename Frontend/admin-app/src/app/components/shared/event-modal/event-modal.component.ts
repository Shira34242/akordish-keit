import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventCardData, getDisplayArtist, isEventPast } from '../../../utils/event.utils';
import { AnalyticsService } from '../../../services/analytics.service';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { ContentUploaderBadgeComponent } from '../content-uploader-badge/content-uploader-badge.component';

@Component({
  selector: 'app-event-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ContentUploaderBadgeComponent],
  templateUrl: './event-modal.component.html',
  styleUrls: ['./event-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventModalComponent implements OnChanges {
  @Input() event: EventCardData | null = null;
  @Output() close = new EventEmitter<void>();

  private readonly analytics = inject(AnalyticsService);

  ngOnChanges(): void {
    document.body.style.overflow = this.event ? 'hidden' : '';
    if (this.event) {
      this.analytics.trackEventView(this.event.id);
    }
  }

  onTicketClick(): void {
    if (this.event) {
      this.analytics.trackButtonClick('ticket', this.event.id, this.event.name);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.event) this.close.emit();
  }

  get displayArtist(): string | null {
    return this.event ? getDisplayArtist(this.event) : null;
  }

  get isPast(): boolean {
    return this.event ? isEventPast(this.event) : false;
  }

  get formattedDateTime(): string {
    if (!this.event) return '';
    const d = new Date(this.event.eventDate);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const timeStr = `${h}:${m}`;
    return timeStr === '00:00'
      ? `${day}/${month}/${year}`
      : `${day}/${month}/${year} | ${timeStr}`;
  }
}
