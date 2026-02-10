import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.css']
})
export class PaginationComponent {
  @Input() totalCount: number = 0;
  @Input() pageNumber: number = 1;
  @Input() pageSize: number = 10;
  @Input() totalPages: number = 0;
  @Input() hasPreviousPage: boolean = false;
  @Input() hasNextPage: boolean = false;

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  pageSizeOptions = [5, 10, 20, 30, 50, 100];

  get startItem(): number {
    return this.totalCount === 0 ? 0 : (this.pageNumber - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    const end = this.pageNumber * this.pageSize;
    return end > this.totalCount ? this.totalCount : end;
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 7;

    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (this.pageNumber <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push(-1); // Ellipsis
        pages.push(this.totalPages);
      } else if (this.pageNumber >= this.totalPages - 3) {
        pages.push(1);
        pages.push(-1); // Ellipsis
        for (let i = this.totalPages - 4; i <= this.totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push(-1); // Ellipsis
        for (let i = this.pageNumber - 1; i <= this.pageNumber + 1; i++) {
          pages.push(i);
        }
        pages.push(-1); // Ellipsis
        pages.push(this.totalPages);
      }
    }

    return pages;
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.pageNumber) {
      this.pageChange.emit(page);
    }
  }

  onPageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newSize = parseInt(select.value, 10);
    this.pageSizeChange.emit(newSize);
  }

  onFirstPage(): void {
    this.onPageChange(1);
  }

  onPreviousPage(): void {
    this.onPageChange(this.pageNumber - 1);
  }

  onNextPage(): void {
    this.onPageChange(this.pageNumber + 1);
  }

  onLastPage(): void {
    this.onPageChange(this.totalPages);
  }
}
