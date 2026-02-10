import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReportService } from '../../../services/report.service';
import { Report, ReportTypeLabels, ContentTypeLabels, StatusLabels, UpdateReportStatusDto } from '../../../models/report.model';
import { PagedResult } from '../../../models/pagination.model';

@Component({
  selector: 'app-reports-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports-list.component.html',
  styleUrls: ['./reports-list.component.css']
})
export class ReportsListComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly router = inject(Router);

  // State
  reports: Report[] = [];
  loading = false;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalItems = 0;
  totalPages = 0;

  // Filters
  selectedStatus?: string;
  selectedContentType?: string;
  selectedReportType?: string;

  // Labels for template
  reportTypeLabels = ReportTypeLabels;
  contentTypeLabels = ContentTypeLabels;
  statusLabels = StatusLabels;

  // Expanded row for details
  expandedReportId: number | null = null;

  // Edit modal
  editingReportId: number | null = null;
  editingStatus: 'Resolved' | 'Dismissed' = 'Resolved';
  adminNotes: string = '';

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.loading = true;

    this.reportService.getReports(
      this.currentPage,
      this.pageSize,
      this.selectedStatus,
      this.selectedContentType,
      this.selectedReportType
    ).subscribe({
      next: (result: PagedResult<Report>) => {
        this.reports = result.items;
        this.totalItems = result.totalCount;
        this.totalPages = result.totalPages;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading reports:', error);
        this.loading = false;
        alert('שגיאה בטעינת הדיווחים');
      }
    });
  }

  onStatusFilter(status?: string): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.loadReports();
  }

  onContentTypeFilter(contentType?: string): void {
    this.selectedContentType = contentType;
    this.currentPage = 1;
    this.loadReports();
  }

  onReportTypeFilter(reportType?: string): void {
    this.selectedReportType = reportType;
    this.currentPage = 1;
    this.loadReports();
  }

  resetFilters(): void {
    this.selectedStatus = undefined;
    this.selectedContentType = undefined;
    this.selectedReportType = undefined;
    this.currentPage = 1;
    this.loadReports();
  }

  toggleExpand(reportId: number): void {
    this.expandedReportId = this.expandedReportId === reportId ? null : reportId;
  }

  openStatusModal(report: Report): void {
    this.editingReportId = report.id;
    this.editingStatus = report.status === 'Dismissed' ? 'Dismissed' : 'Resolved';
    this.adminNotes = report.adminNotes || '';
  }

  closeStatusModal(): void {
    this.editingReportId = null;
    this.adminNotes = '';
  }

  updateStatus(): void {
    if (!this.editingReportId) return;

    const dto: UpdateReportStatusDto = {
      status: this.editingStatus,
      adminNotes: this.adminNotes || undefined
    };

    this.reportService.updateReportStatus(this.editingReportId, dto).subscribe({
      next: () => {
        this.closeStatusModal();
        this.loadReports();
      },
      error: (error) => {
        console.error('Error updating report:', error);
        alert('שגיאה בעדכון הדיווח');
      }
    });
  }

  deleteReport(reportId: number): void {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הדיווח לצמיתות?')) {
      return;
    }

    this.reportService.deleteReport(reportId).subscribe({
      next: () => {
        this.loadReports();
      },
      error: (error) => {
        console.error('Error deleting report:', error);
        alert('שגיאה במחיקת הדיווח');
      }
    });
  }

  goToContent(report: Report): void {
    window.open(report.contentUrl, '_blank');
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Pending': return 'status-pending';
      case 'Resolved': return 'status-resolved';
      case 'Dismissed': return 'status-dismissed';
      default: return '';
    }
  }

  // Pagination
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadReports();
  }

  get pages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }
}
