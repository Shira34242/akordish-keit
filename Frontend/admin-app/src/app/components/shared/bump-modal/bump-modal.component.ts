import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BumpService } from '../../../services/bump.service';

@Component({
  selector: 'app-bump-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bump-modal.component.html',
  styleUrls: ['./bump-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BumpModalComponent {
  @Input() entityType: string = '';
  @Input() ids: number[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() bumped = new EventEmitter<void>();

  loading = false;
  scheduleMode = false;
  times = 3;
  intervalHours = 168;

  intervalOptions = [
    { label: 'כל 12 שעות', value: 12 },
    { label: 'כל יום', value: 24 },
    { label: 'כל יומיים', value: 48 },
    { label: 'פעם בשבוע', value: 168 },
    { label: 'כל שבועיים', value: 336 },
    { label: 'פעם בחודש', value: 720 }
  ];

  timesOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  constructor(
    private bumpService: BumpService,
    private cdr: ChangeDetectorRef
  ) {}

  entityLabel(): string {
    switch (this.entityType) {
      case 'Song': return 'שירים';
      case 'Article': return 'כתבות';
      case 'Playlist': return 'פלייליסטים';
      case 'ServiceProvider': return 'פרופילים';
      default: return 'פריטים';
    }
  }

  intervalLabel(): string {
    const opt = this.intervalOptions.find(o => o.value === this.intervalHours);
    return opt ? opt.label : `כל ${this.intervalHours} שעות`;
  }

  bumpNow(): void {
    if (this.ids.length === 0) return;
    this.loading = true;
    this.cdr.markForCheck();
    this.bumpService.bump({ entityType: this.entityType, ids: this.ids }).subscribe({
      next: () => {
        this.loading = false;
        this.bumped.emit();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        alert('שגיאה בהקפצה');
        this.cdr.markForCheck();
      }
    });
  }

  bumpScheduled(): void {
    if (this.ids.length === 0) return;
    this.loading = true;
    this.cdr.markForCheck();
    this.bumpService.bump({
      entityType: this.entityType,
      ids: this.ids,
      schedule: { times: this.times, intervalHours: this.intervalHours }
    }).subscribe({
      next: () => {
        this.loading = false;
        this.bumped.emit();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        alert('שגיאה בהקפצה');
        this.cdr.markForCheck();
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
