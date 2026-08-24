import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BumpService } from '../../../services/bump.service';

@Component({
  selector: 'app-bump-modal',
  standalone: true,
  imports: [CommonModule],
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
      case 'Teacher': return 'מורים';
      case 'Artist': return 'אומנים';
      default: return 'פריטים';
    }
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
