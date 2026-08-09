import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BroadcastNotificationAnalyticsDto,
  BroadcastNotificationAnalyticsSummaryDto
} from '../../../../models/notification.model';
import { NotificationService } from '../../../../services/notification.service';

type AnalyticsFilter = 'all' | 'clickable' | 'read';

@Component({
  selector: 'app-notification-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-analytics.component.html',
  styleUrls: ['./notification-analytics.component.css']
})
export class NotificationAnalyticsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);

  analytics: BroadcastNotificationAnalyticsSummaryDto = {
    campaignCount: 0,
    recipientCount: 0,
    readCount: 0,
    totalClicks: 0,
    campaigns: []
  };
  isLoading = true;
  errorMessage = '';
  searchTerm = '';
  filter: AnalyticsFilter = 'all';

  ngOnInit(): void {
    this.loadAnalytics();
  }

  get overallOpenRate(): number {
    return this.analytics.recipientCount === 0
      ? 0
      : this.analytics.readCount / this.analytics.recipientCount * 100;
  }

  get filteredCampaigns(): BroadcastNotificationAnalyticsDto[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.analytics.campaigns.filter(campaign => {
      const matchesSearch = !term || [
        campaign.campaignName,
        campaign.audienceLabel,
        campaign.title,
        campaign.message
      ].some(value => value?.toLowerCase().includes(term));

      const matchesFilter = this.filter === 'all'
        || (this.filter === 'clickable' && campaign.hasClickableContent)
        || (this.filter === 'read' && campaign.readCount > 0);

      return matchesSearch && matchesFilter;
    });
  }

  loadAnalytics(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.notificationService.getBroadcastAnalytics().subscribe({
      next: analytics => {
        this.analytics = analytics;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לטעון את נתוני ההתראות כרגע.';
        this.isLoading = false;
      }
    });
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  trackByCampaign(_: number, campaign: BroadcastNotificationAnalyticsDto): string {
    return `${campaign.sentAt}-${campaign.campaignName || campaign.title}`;
  }
}
