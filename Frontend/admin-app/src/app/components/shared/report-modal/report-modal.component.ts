import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../services/report.service';
import { CreateReportDto, ReportTypeLabels } from '../../../models/report.model';

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-modal.component.html',
  styleUrls: ['./report-modal.component.css']
})
export class ReportModalComponent implements OnInit {
  @Input() isOpen: boolean = false;
  @Input() contentType!: 'Song' | 'Article' | 'BlogPost' | 'General';
  @Input() contentId!: number;
  @Input() contentTitle?: string;

  @Output() close = new EventEmitter<void>();

  selectedReportType: 'ContentError' | 'InappropriateContent' | 'Other' = 'ContentError';
  description: string = '';
  isSubmitting: boolean = false;
  showSuccess: boolean = false;
  errorMessage: string = '';

  reportTypes = [
    { value: 'ContentError' as const, label: 'טעות בתוכן' },
    { value: 'InappropriateContent' as const, label: 'תוכן לא ראוי' },
    { value: 'Other' as const, label: 'אחר' }
  ];

  constructor(private reportService: ReportService) {}

  ngOnInit(): void {
    // Reset form when modal opens
    if (this.isOpen) {
      this.resetForm();
    }
  }

  closeModal(): void {
    this.close.emit();
    this.resetForm();
  }

  submitReport(): void {
    if (!this.description.trim() || this.description.length < 10) {
      this.errorMessage = 'נא לתאר את הבעיה בעשרה תווים לפחות';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const dto: CreateReportDto = {
      contentType: this.contentType,
      contentId: this.contentId,
      reportType: this.selectedReportType,
      description: this.description.trim()
    };

    this.reportService.createReport(dto).subscribe({
      next: (response) => {
        this.showSuccess = true;
        setTimeout(() => {
          this.closeModal();
        }, 2000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'שגיאה בשליחת הדיווח';
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  private resetForm(): void {
    this.selectedReportType = 'ContentError';
    this.description = '';
    this.showSuccess = false;
    this.errorMessage = '';
    this.isSubmitting = false;
  }

  handleBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }
}
