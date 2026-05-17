import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../services/report.service';
import { CreateReportDto } from '../../../models/report.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';

type ReportOption = {
  value: 'ContentError' | 'InappropriateContent' | 'Other';
  labelKey: string;
};

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './report-modal.component.html',
  styleUrls: ['./report-modal.component.css']
})
export class ReportModalComponent implements OnChanges {
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

  readonly reportTypes: ReportOption[] = [
    { value: 'ContentError', labelKey: 'report.type_error' },
    { value: 'InappropriateContent', labelKey: 'report.type_inappropriate' },
    { value: 'Other', labelKey: 'report.type_other' }
  ];

  constructor(
    private reportService: ReportService,
    private langService: LanguageService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true && changes['isOpen'].previousValue !== true) {
      this.resetForm();
    }
  }

  closeModal(): void {
    this.close.emit();
    this.resetForm();
  }

  submitReport(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.description.trim() || this.description.length < 10) {
      this.errorMessage = this.langService.translate('report.validation');
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
        this.errorMessage = error.error?.message || this.langService.translate('report.error_submit');
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  trackByReportType(_index: number, type: ReportOption): string {
    return type.value;
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
