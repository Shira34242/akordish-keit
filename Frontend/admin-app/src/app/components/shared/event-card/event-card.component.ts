import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventCardData, getDisplayArtist, hasDisplayEventTitle, isEventPast } from '../../../utils/event.utils';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ImgFallbackDirective],
  templateUrl: './event-card.component.html',
  styleUrls: ['./event-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventCardComponent {
  @Input({ required: true }) event!: EventCardData;
  @Input() showInfo = true;
  @Output() cardClick = new EventEmitter<EventCardData>();

  get displayArtist(): string | null {
    return getDisplayArtist(this.event);
  }

  get hasTitle(): boolean {
    return hasDisplayEventTitle(this.event);
  }

  get isPast(): boolean {
    return isEventPast(this.event);
  }

  get badgeClass(): string {
    if (this.isPast) return 'badge--past';
    if (this.event.eventStatus === 'היום') return 'badge--today';
    return 'badge--upcoming';
  }

  get formattedDate(): string {
    const d = new Date(this.event.eventDate);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  get formattedTime(): string {
    const d = new Date(this.event.eventDate);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
}
