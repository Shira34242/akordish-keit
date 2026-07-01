import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../services/report.service';
import { Report, ReportTypeLabels, ContentTypeLabels, StatusLabels, UpdateReportStatusDto } from '../../../models/report.model';
import { PagedResult } from '../../../models/pagination.model';
import { SiteAlertService } from '../../../services/site-alert.service';

type DashboardGroupKey = 'all' | 'newArtists' | 'approvals' | 'contentIssues' | 'chordRequests' | 'general' | 'handled';

interface DashboardMetric {
  label: string;
  value: number;
  hint: string;
  icon: string;
  filterStatus?: string;
}

interface DashboardGroup {
  key: DashboardGroupKey;
  label: string;
  description: string;
  icon: string;
  reports: Report[];
}

@Component({
  selector: 'app-reports-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports-list.component.html',
  styleUrls: ['./reports-list.component.css']
})
export class ReportsListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly reportService = inject(ReportService);

  reports: Report[] = [];
  loading = false;
  activeGroupKey: DashboardGroupKey = 'all';

  currentPage = 1;
  pageSize = 25;
  totalItems = 0;
  totalPages = 0;
  visiblePages: number[] = [];

  selectedStatus?: string;
  selectedContentType?: string;
  selectedReportType?: string;

  reportTypeLabels = ReportTypeLabels;
  contentTypeLabels = ContentTypeLabels;
  statusLabels = StatusLabels;

  expandedReportId: number | null = null;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-reports-view') as 'list' | 'grid') || 'list';

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
        this.visiblePages = this.buildVisiblePages();
        this.syncSelectedReport();
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
    this.activeGroupKey = 'all';
    this.currentPage = 1;
    this.loadReports();
  }

  toggleExpand(reportId: number): void {
    this.expandedReportId = this.expandedReportId === reportId ? null : reportId;
  }

  setActiveGroup(groupKey: DashboardGroupKey): void {
    this.activeGroupKey = groupKey;
    this.syncSelectedReport();
  }

  selectReport(report: Report): void {
    this.expandedReportId = report.id;
  }

  setView(mode: 'list' | 'grid'): void {
    this.viewMode = mode;
    localStorage.setItem('admin-reports-view', mode);
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

  async deleteReport(reportId: number): Promise<void> {
    if (!(await this.siteAlerts.confirm('האם אתה בטוח שברצונך למחוק את הדיווח לצמיתות?'))) {
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

  async approveNewArtist(report: Report): Promise<void> {
    const artistName = report.contentTitle.split(' - ')[1] || report.description;
    if (!(await this.siteAlerts.confirm(`ליצור פרופיל אמן חדש עבור: "${artistName}"?`))) return;

    this.reportService.approveArtist(report.id).subscribe({
      next: () => this.loadReports(),
      error: (err) => {
        console.error('Error approving artist:', err);
        alert('שגיאה ביצירת האמן');
      }
    });
  }

  resolveAsPending(report: Report): void {
    const dto: UpdateReportStatusDto = { status: 'Resolved', adminNotes: 'אושר על ידי מנהל' };
    this.reportService.updateReportStatus(report.id, dto).subscribe({
      next: () => this.loadReports(),
      error: () => alert('שגיאה בעדכון הסטטוס')
    });
  }

  dismissItem(report: Report): void {
    const dto: UpdateReportStatusDto = { status: 'Dismissed', adminNotes: 'נדחה על ידי מנהל' };
    this.reportService.updateReportStatus(report.id, dto).subscribe({
      next: () => this.loadReports(),
      error: () => alert('שגיאה בעדכון הסטטוס')
    });
  }

  async cleanupArtistDuplicates(): Promise<void> {
    if (!(await this.siteAlerts.confirm('לנקות כפילויות אמנים? דיווחים עודפים יסגרו אוטומטית.'))) return;

    this.reportService.cleanupArtistDuplicates().subscribe({
      next: (res) => {
        this.siteAlerts.show(res.message);
        this.loadReports();
      },
      error: () => alert('שגיאה בניקוי הכפילויות')
    });
  }

  isNewContentReport(report: Report): boolean {
    return ['NewArtist', 'NewGenre', 'NewTag', 'NewPerson'].includes(report.reportType);
  }

  get dashboardMetrics(): DashboardMetric[] {
    const pendingCount = this.reports.filter(report => report.status === 'Pending').length;
    const resolvedCount = this.reports.filter(report => report.status === 'Resolved').length;
    const dismissedCount = this.reports.filter(report => report.status === 'Dismissed').length;
    const newContentCount = this.reports.filter(report => this.isNewContentReport(report)).length;

    return [
      { label: 'פתוחים לטיפול', value: pendingCount, hint: 'דיווחים שממתינים להחלטה', icon: 'pending_actions', filterStatus: 'Pending' },
      { label: 'תוכן לאישור', value: newContentCount, hint: 'אמנים, תגיות, ז׳אנרים ומלחינים', icon: 'fact_check' },
      { label: 'טופלו', value: resolvedCount, hint: 'נסגרו בהצלחה בעמוד הנוכחי', icon: 'task_alt', filterStatus: 'Resolved' },
      { label: 'נדחו', value: dismissedCount, hint: 'נסגרו ללא פעולה נוספת', icon: 'block', filterStatus: 'Dismissed' }
    ];
  }

  get dashboardGroups(): DashboardGroup[] {
    return [
      {
        key: 'all',
        label: 'כל הדיווחים',
        description: 'תצוגת עבודה מלאה לפי הסינון הנוכחי',
        icon: 'dashboard',
        reports: this.reports
      },
      {
        key: 'newArtists',
        label: 'אמנים שלא קיימים',
        description: 'בקשות ליצירת פרופיל אמן מתוך דיווחים',
        icon: 'person_add',
        reports: this.reports.filter(report => report.reportType === 'NewArtist')
      },
      {
        key: 'approvals',
        label: 'ממתין לאישור',
        description: 'תוכן חדש מחולק לפי סוג דיווח',
        icon: 'approval',
        reports: this.reports.filter(report => this.isNewContentReport(report))
      },
      {
        key: 'contentIssues',
        label: 'בעיות תוכן',
        description: 'טעויות, תוכן לא ראוי ודיווחים על עמודים קיימים',
        icon: 'report_problem',
        reports: this.reports.filter(report => ['ContentError', 'InappropriateContent'].includes(report.reportType))
      },
      {
        key: 'chordRequests',
        label: 'בקשות אקורדים',
        description: 'שירים שאנשים ביקשו להוסיף למאגר',
        icon: 'music_note',
        reports: this.reports.filter(report => report.reportType === 'ChordRequest')
      },
      {
        key: 'general',
        label: 'משתמשים ופניות כלליות',
        description: 'דיווחים כלליים ופניות משתמשים שהגיעו מהאתר',
        icon: 'groups',
        reports: this.reports.filter(report => report.contentType === 'General' || report.reportType === 'Other')
      },
      {
        key: 'handled',
        label: 'ארכיון טיפול',
        description: 'דיווחים שכבר נסגרו ונשארו למעקב',
        icon: 'inventory_2',
        reports: this.reports.filter(report => report.status !== 'Pending')
      }
    ];
  }

  get selectedGroup(): DashboardGroup {
    return this.dashboardGroups.find(group => group.key === this.activeGroupKey) || this.dashboardGroups[0];
  }

  get selectedReports(): Report[] {
    return this.selectedGroup.reports;
  }

  get selectedReport(): Report | undefined {
    return this.reports.find(report => report.id === this.expandedReportId) || this.selectedReports[0];
  }

  get approvalBreakdown(): Array<{ label: string; count: number }> {
    return ['NewArtist', 'NewGenre', 'NewTag', 'NewPerson']
      .map(type => ({
        label: this.reportTypeLabels[type] || type,
        count: this.reports.filter(report => report.reportType === type).length
      }))
      .filter(item => item.count > 0);
  }

  getQuickSuggestion(report: Report): string {
    if (report.reportType === 'NewArtist') return 'לבדוק כפילות ואז ליצור פרופיל אמן.';
    if (this.isNewContentReport(report)) return 'לאשר אם המידע תקין, או לדחות עם הערה קצרה.';
    if (report.reportType === 'ContentError') return 'לפתוח את התוכן, לתקן, ואז לסמן כטופל.';
    if (report.reportType === 'InappropriateContent') return 'לבדוק במהירות ולסגור בהתאם למדיניות האתר.';
    if (report.reportType === 'ChordRequest') return 'לבדוק אם השיר כבר קיים או להשאיר כבקשת אקורדים.';
    return 'לקרוא את הפנייה ולסגור כטופל או נדחה לפי הצורך.';
  }

  getReportAgeLabel(report: Report): string {
    const reportedAt = new Date(report.reportedAt).getTime();
    const diffHours = Math.max(0, Math.floor((Date.now() - reportedAt) / 36e5));
    if (diffHours < 1) return 'עכשיו';
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    return `לפני ${Math.floor(diffHours / 24)} ימים`;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Pending': return 'status-pending';
      case 'Resolved': return 'status-resolved';
      case 'Dismissed': return 'status-dismissed';
      default: return '';
    }
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadReports();
  }

  trackByReportId(_index: number, report: Report): number {
    return report.id;
  }

  trackByPage(_index: number, page: number): number {
    return page;
  }

  trackByGroup(_index: number, group: DashboardGroup): string {
    return group.key;
  }

  trackByMetric(_index: number, metric: DashboardMetric): string {
    return metric.label;
  }

  private syncSelectedReport(): void {
    if (this.selectedReports.some(report => report.id === this.expandedReportId)) return;
    this.expandedReportId = this.selectedReports[0]?.id || null;
  }

  private buildVisiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
