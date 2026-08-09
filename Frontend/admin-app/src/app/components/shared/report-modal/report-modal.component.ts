import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../services/report.service';
import { CreateReportDto } from '../../../models/report.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';
import { ReportContextService } from '../../../services/report-context.service';

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
  attemptedAction: string = '';
  expectedResult: string = '';
  inappropriateLocation: string = '';
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
    private langService: LanguageService,
    private reportContextService: ReportContextService
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

    const structuredDescription = this.buildStructuredDescription();
    if (!this.isFormValid || structuredDescription.length > 700) {
      this.errorMessage = this.langService.translate('report.validation');
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const recentError = this.reportContextService.getRecentError();
    const dto: CreateReportDto = {
      contentType: this.contentType,
      contentId: this.contentId,
      reportType: this.selectedReportType,
      description: structuredDescription,
      sourcePageUrl: this.getCurrentInternalUrl(),
      sourcePageTitle: (this.contentType === 'General' ? document.title : this.contentTitle || document.title || '').trim().slice(0, 200),
      sourceContext: this.getSourceContext(),
      lastAction: this.reportContextService.getLastMeaningfulAction(),
      clientEnvironment: this.reportContextService.getClientEnvironment(),
      errorId: recentError?.id,
      errorSummary: recentError?.summary
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

  private getCurrentInternalUrl(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    const url = new URL(window.location.href);
    const sensitiveKeys = /token|code|password|secret|email|access[_-]?token|refresh[_-]?token/i;
    [...url.searchParams.keys()].forEach(key => {
      if (sensitiveKeys.test(key)) url.searchParams.set(key, '[hidden]');
    });
    return `${url.pathname}${url.search}${url.hash}`.slice(0, 500);
  }

  private getSourceContext(): string {
    const labels: Record<string, string> = {
      Song: 'כפתור דיווח בדף שיר',
      Article: 'כפתור דיווח בכתבה',
      BlogPost: 'כפתור דיווח בבלוג',
      General: 'דיווח כללי מהאתר'
    };
    if (this.contentType === 'General' && this.contentTitle === 'דף 404') return 'דיווח מדף 404';
    return labels[this.contentType] || 'דיווח מהאתר';
  }

  get structuredDescriptionLength(): number {
    return this.buildStructuredDescription().length;
  }

  get isFormValid(): boolean {
    return this.description.trim().length >= 10 && this.structuredDescriptionLength <= 700;
  }

  private buildStructuredDescription(): string {
    if (this.selectedReportType === 'InappropriateContent') {
      const sections = [
        { label: this.langService.translate('report.inappropriate_location'), value: this.inappropriateLocation.trim() },
        { label: this.langService.translate('report.inappropriate_explanation'), value: this.description.trim() }
      ];
      return sections
        .filter(section => section.value)
        .map(section => `${section.label}:\n${section.value}`)
        .join('\n\n');
    }

    if (this.selectedReportType === 'Other') {
      return `${this.langService.translate('report.other_details')}:\n${this.description.trim()}`;
    }

    const sections = [
      { label: this.langService.translate('report.attempted_action'), value: this.attemptedAction.trim() },
      { label: this.langService.translate('report.expected_result'), value: this.expectedResult.trim() },
      { label: this.langService.translate('report.actual_result'), value: this.description.trim() }
    ];
    return sections
      .filter(section => section.value)
      .map(section => `${section.label}:\n${section.value}`)
      .join('\n\n');
  }

  trackByReportType(_index: number, type: ReportOption): string {
    return type.value;
  }

  private resetForm(): void {
    this.selectedReportType = 'ContentError';
    this.description = '';
    this.attemptedAction = '';
    this.expectedResult = '';
    this.inappropriateLocation = '';
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
