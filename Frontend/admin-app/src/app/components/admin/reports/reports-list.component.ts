import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../services/report.service';
import { Report, ReportSummary, ReportTypeLabels, ContentTypeLabels, StatusLabels, UpdateReportStatusDto } from '../../../models/report.model';
import { PagedResult } from '../../../models/pagination.model';
import { SiteAlertService } from '../../../services/site-alert.service';

type ViewMode = 'compact' | 'wide' | 'grid';

@Component({
  selector: 'app-reports-list', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './reports-list.component.html', styleUrls: ['./reports-list.component.css']
})
export class ReportsListComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly siteAlerts = inject(SiteAlertService);

  reports: Report[] = [];
  summary: ReportSummary = { totalCount: 0, pendingCount: 0, resolvedCount: 0, dismissedCount: 0, newContentCount: 0 };
  loading = false;
  loadingMore = false;
  actionLoading = false;
  errorMessage = '';
  currentPage = 1;
  pageSize = 25;
  totalItems = 0;
  totalPages = 0;
  visiblePages: number[] = [];
  selectedStatus?: string;
  selectedContentType?: string;
  selectedReportType?: string;
  searchTerm = '';
  sortOrder: 'newest' | 'oldest' = 'newest';
  viewMode: ViewMode = (localStorage.getItem('admin-reports-view') as ViewMode) || 'grid';
  selectedIds = new Set<number>();
  previewReport: Report | null = null;
  editingReportId: number | null = null;
  editingStatus: 'Resolved' | 'Dismissed' = 'Resolved';
  adminNotes = '';

  reportTypeLabels = ReportTypeLabels;
  contentTypeLabels = ContentTypeLabels;
  statusLabels = StatusLabels;

  ngOnInit(): void { this.loadReports(); }

  get filteredReports(): Report[] {
    const term = this.searchTerm.trim().toLowerCase();
    const result = this.reports.filter(report => !term || [report.contentTitle, report.description, report.reporterUsername || ''].some(value => value.toLowerCase().includes(term)));
    return result.sort((a, b) => this.sortOrder === 'newest'
      ? new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
      : new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime());
  }

  get allVisibleSelected(): boolean { return this.filteredReports.length > 0 && this.filteredReports.every(report => this.selectedIds.has(report.id)); }
  get selectedCount(): number { return this.selectedIds.size; }

  loadReports(): void {
    this.loading = true; this.loadingMore = false; this.errorMessage = ''; this.currentPage = 1;
    this.reportService.getReports(this.currentPage, this.pageSize, this.selectedStatus, this.selectedContentType, this.selectedReportType).subscribe({
      next: (result: PagedResult<Report>) => {
        this.reports = result.items; this.totalItems = result.totalCount; this.totalPages = result.totalPages;
        this.visiblePages = this.buildVisiblePages(); this.loading = false; this.loadSummary();
        setTimeout(() => this.onWindowScroll());
      },
      error: () => { this.loading = false; this.errorMessage = 'לא ניתן לטעון את הדיווחים כרגע.'; }
    });
  }

  loadMore(): void {
    if (this.loading || this.loadingMore || this.currentPage >= this.totalPages) return;
    this.loadingMore = true;
    const nextPage = this.currentPage + 1;
    this.reportService.getReports(nextPage, this.pageSize, this.selectedStatus, this.selectedContentType, this.selectedReportType).subscribe({
      next: result => {
        this.currentPage = nextPage;
        this.reports = [...this.reports, ...result.items];
        this.totalItems = result.totalCount;
        this.totalPages = result.totalPages;
        this.loadingMore = false;
      },
      error: () => { this.loadingMore = false; this.errorMessage = 'לא ניתן לטעון דיווחים נוספים כרגע.'; }
    });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 520;
    if (nearBottom) this.loadMore();
  }

  loadSummary(): void {
    this.reportService.getReportSummary(this.selectedStatus, this.selectedContentType, this.selectedReportType).subscribe({ next: summary => this.summary = summary });
  }

  onFilterChange(): void { this.currentPage = 1; this.clearSelection(); this.loadReports(); }
  onStatusTab(status?: string): void { this.selectedStatus = status; this.selectedContentType = undefined; this.selectedReportType = undefined; this.onFilterChange(); }
  resetFilters(): void { this.selectedStatus = undefined; this.selectedContentType = undefined; this.selectedReportType = undefined; this.searchTerm = ''; this.currentPage = 1; this.clearSelection(); this.loadReports(); }
  setView(mode: ViewMode): void { this.viewMode = mode; localStorage.setItem('admin-reports-view', mode); }
  setSort(order: 'newest' | 'oldest'): void { this.sortOrder = order; }

  toggleSelection(report: Report, event?: Event): void { event?.stopPropagation(); this.selectedIds.has(report.id) ? this.selectedIds.delete(report.id) : this.selectedIds.add(report.id); }
  toggleSelectAll(): void { this.allVisibleSelected ? this.filteredReports.forEach(report => this.selectedIds.delete(report.id)) : this.filteredReports.forEach(report => this.selectedIds.add(report.id)); }
  clearSelection(): void { this.selectedIds.clear(); }

  openPreview(report: Report): void { this.previewReport = report; }
  closePreview(): void { this.previewReport = null; }
  goToPreview(direction: number): void {
    if (!this.previewReport) return;
    const index = this.filteredReports.findIndex(report => report.id === this.previewReport?.id);
    const next = this.filteredReports[index + direction];
    if (next) this.previewReport = next;
  }

  openStatusModal(report: Report): void { this.editingReportId = report.id; this.editingStatus = report.status === 'Dismissed' ? 'Dismissed' : 'Resolved'; this.adminNotes = report.adminNotes || ''; }
  closeStatusModal(): void { this.editingReportId = null; this.adminNotes = ''; }
  updateStatus(): void {
    if (!this.editingReportId) return;
    const dto: UpdateReportStatusDto = { status: this.editingStatus, adminNotes: this.adminNotes || undefined };
    this.reportService.updateReportStatus(this.editingReportId, dto).subscribe({ next: () => { this.closeStatusModal(); this.closePreview(); this.loadReports(); }, error: () => this.errorMessage = 'עדכון הסטטוס נכשל.' });
  }

  async bulkStatus(status: 'Resolved' | 'Dismissed'): Promise<void> {
    if (!this.selectedCount || !(await this.siteAlerts.confirm(`לעדכן ${this.selectedCount} דיווחים?`))) return;
    this.actionLoading = true;
    this.reportService.bulkUpdateStatus([...this.selectedIds], status).subscribe({ next: () => { this.actionLoading = false; this.clearSelection(); this.loadReports(); }, error: () => { this.actionLoading = false; this.errorMessage = 'הפעולה נכשלה.'; } });
  }

  async bulkDelete(): Promise<void> {
    if (!this.selectedCount || !(await this.siteAlerts.confirm(`למחוק לצמיתות ${this.selectedCount} דיווחים?`))) return;
    this.actionLoading = true;
    this.reportService.bulkDelete([...this.selectedIds]).subscribe({ next: () => { this.actionLoading = false; this.clearSelection(); this.loadReports(); }, error: () => { this.actionLoading = false; this.errorMessage = 'המחיקה נכשלה.'; } });
  }

  async deleteReport(report: Report): Promise<void> {
    if (!(await this.siteAlerts.confirm('למחוק את הדיווח לצמיתות?'))) return;
    this.reportService.deleteReport(report.id).subscribe({ next: () => { this.closePreview(); this.loadReports(); }, error: () => this.errorMessage = 'המחיקה נכשלה.' });
  }

  goToContent(report: Report): void { window.open(report.contentUrl, '_blank'); }
  getReporterProfileUrl(report: Report): string { return report.reporterUserId ? `/admin/users/clients?userId=${report.reporterUserId}` : '#'; }
  getStatusClass(status: string): string { return `status-${status.toLowerCase()}`; }
  getReportIcon(report: Report): string {
    if (this.isNewContentReport(report)) return 'add_circle';
    if (report.reportType === 'ContentError') return 'edit_note';
    if (report.reportType === 'InappropriateContent') return 'report_problem';
    if (report.reportType === 'ChordRequest') return 'music_note';
    return 'forum';
  }
  getReportAccent(report: Report): string {
    if (this.isNewContentReport(report)) return 'accent-purple';
    if (report.reportType === 'ContentError') return 'accent-blue';
    if (report.reportType === 'InappropriateContent') return 'accent-orange';
    if (report.reportType === 'ChordRequest') return 'accent-cyan';
    return 'accent-pink';
  }
  getReportAgeLabel(report: Report): string { const hours = Math.max(0, Math.floor((Date.now() - new Date(report.reportedAt).getTime()) / 36e5)); return hours < 1 ? 'עכשיו' : hours < 24 ? `לפני ${hours} שעות` : `לפני ${Math.floor(hours / 24)} ימים`; }
  isNewContentReport(report: Report): boolean { return ['NewArtist', 'NewGenre', 'NewTag', 'NewPerson'].includes(report.reportType); }
  getQuickSuggestion(report: Report): string {
    const contextLines: string[] = [];
    if (report.sourcePageUrl) contextLines.push(`הדף המדויק: ${report.sourcePageUrl}`);
    if (report.sourceContext) contextLines.push(`מקור הדיווח: ${report.sourceContext}`);
    if (report.lastAction) contextLines.push(`פעולה קודמת: ${report.lastAction}`);
    if (report.clientEnvironment) contextLines.push(`סביבת משתמש: ${report.clientEnvironment}`);
    if (report.errorId) contextLines.push(`מזהה שגיאה: ${report.errorId}`);
    if (report.errorSummary) contextLines.push(`שגיאה שנקלטה: ${report.errorSummary}`);

    const suggestion = report.reportType === 'ContentError'
      ? 'כדאי לפתוח את התוכן ולבדוק את הבעיה.'
      : report.reportType === 'InappropriateContent'
        ? 'יש לבדוק במהירות בהתאם למדיניות האתר.'
        : 'יש לקרוא את הפנייה ולבחור פעולה מתאימה.';

    return contextLines.length ? `${contextLines.join('\n')}\n\n${suggestion}` : suggestion;
  }
  goToPage(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.clearSelection(); this.loadReports(); }
  trackByReportId(_: number, report: Report): number { return report.id; }
  trackByPage(_: number, page: number): number { return page; }
  private buildVisiblePages(): number[] { const pages: number[] = []; for (let page = Math.max(1, this.currentPage - 2); page <= Math.min(this.totalPages, this.currentPage + 2); page++) pages.push(page); return pages; }
}
