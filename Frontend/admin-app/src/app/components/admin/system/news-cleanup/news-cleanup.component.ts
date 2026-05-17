import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ArticleNewsCleanupSettingsDto,
  ArticleService
} from '../../../../services/admin/article.service';
import { SiteAlertService } from '../../../../services/site-alert.service';

@Component({
  selector: 'app-news-cleanup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './news-cleanup.component.html',
  styleUrls: ['./news-cleanup.component.css']
})
export class NewsCleanupComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly siteAlerts = inject(SiteAlertService);

  cleanupSettings: ArticleNewsCleanupSettingsDto = {
    autoDeleteEnabled: false,
    retentionDays: 365,
    lastRunAt: null
  };
  cleanupSettingsDraft = { autoDeleteEnabled: false, retentionDays: 365 };
  manualCleanupDays = 365;
  cleanupLoading = false;
  cleanupSettingsLoading = false;

  ngOnInit(): void {
    this.loadCleanupSettings();
  }

  loadCleanupSettings(): void {
    this.cleanupSettingsLoading = true;
    this.articleService.getNewsCleanupSettings().subscribe({
      next: (settings) => {
        this.cleanupSettings = settings;
        this.cleanupSettingsDraft = {
          autoDeleteEnabled: settings.autoDeleteEnabled,
          retentionDays: settings.retentionDays
        };
        this.manualCleanupDays = settings.retentionDays || this.manualCleanupDays;
        this.cleanupSettingsLoading = false;
      },
      error: (error) => {
        console.error('Error loading news cleanup settings:', error);
        this.cleanupSettingsLoading = false;
      }
    });
  }

  saveCleanupSettings(): void {
    this.cleanupLoading = true;
    this.articleService.updateNewsCleanupSettings({
      autoDeleteEnabled: this.cleanupSettingsDraft.autoDeleteEnabled,
      retentionDays: this.cleanupSettingsDraft.retentionDays
    }).subscribe({
      next: (settings) => {
        this.cleanupSettings = settings;
        this.cleanupSettingsDraft = {
          autoDeleteEnabled: settings.autoDeleteEnabled,
          retentionDays: settings.retentionDays
        };
        this.manualCleanupDays = settings.retentionDays;
        this.cleanupLoading = false;
        alert('הגדרות הניקוי נשמרו בהצלחה');
      },
      error: (error) => {
        console.error('Error saving news cleanup settings:', error);
        alert(error?.error?.message || 'שגיאה בשמירת הגדרות הניקוי');
        this.cleanupLoading = false;
      }
    });
  }

  async runManualCleanup(): Promise<void> {
    const days = this.manualCleanupDays;
    if (!days || days < 30) {
      alert('בחר לפחות 30 ימים כדי למנוע מחיקה רחבה מדי');
      return;
    }

    if (!(await this.siteAlerts.confirm(`למחוק חדשות מוזיקה שפורסמו לפני יותר מ-${days} ימים?`))) {
      return;
    }

    this.cleanupLoading = true;
    this.articleService.cleanupOldNews({ olderThanDays: days }).subscribe({
      next: (result) => {
        this.cleanupLoading = false;
        this.loadCleanupSettings();
        alert(`נמחקו ${result.deletedCount} כתבות חדשות ישנות`);
      },
      error: (error) => {
        console.error('Error cleaning old news:', error);
        alert(error?.error?.message || 'שגיאה במחיקת חדשות ישנות');
        this.cleanupLoading = false;
      }
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
