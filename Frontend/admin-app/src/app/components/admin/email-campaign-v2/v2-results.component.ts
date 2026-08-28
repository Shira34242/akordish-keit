import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { EmailCampaignV2Service } from '../../../services/email-campaign-v2.service';
import { MarketingCampaignService, MarketingCampaignSummary } from '../../../services/admin/marketing-campaign.service';

interface AnalyticsData {
  campaignId: number;
  sentCount: number;
  deliveredCount: number;
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
  hardBounces: number;
  softBounces: number;
  unsubscribes: number;
  spamComplaints: number;
  blocked: number;
  deferred: number;
  failedCount: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  ctorRate: number;
  topLinks: { url: string; uniqueClicks: number; totalClicks: number }[];
  campaignStatus: string;
  lastUpdatedAt: string;
}

@Component({
  selector: 'app-v2-results',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loading()) {
      <div class="loading-state">
        <span class="spinner"></span>
        טוען נתוני קמפיין...
      </div>
    } @else if (error()) {
      <div class="error-banner">{{ error() }}</div>
    } @else {
      <div class="results-page" dir="rtl">
        <div class="results-header">
          <h2>תוצאות המייל</h2>
          <p class="updated">
            עודכן: {{ data()?.lastUpdatedAt | date:'short' }}
            <button class="refresh-btn" (click)="loadAnalytics()" [disabled]="refreshing()">
              {{ refreshing() ? 'מעדכן...' : 'רענון' }}
            </button>
          </p>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-value">{{ data()?.sentCount | number }}</div>
            <div class="kpi-label">נשלחו</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">{{ data()?.deliveredCount | number }}</div>
            <div class="kpi-label">נמסרו</div>
          </div>
          <div class="kpi-card highlight-blue">
            <div class="kpi-value">{{ data()?.uniqueOpens | number }}</div>
            <div class="kpi-label">פתיחות ייחודיות</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">{{ data()?.totalOpens | number }}</div>
            <div class="kpi-label">סך פתיחות</div>
          </div>
          <div class="kpi-card highlight-green">
            <div class="kpi-value">{{ data()?.uniqueClicks | number }}</div>
            <div class="kpi-label">לוחצים ייחודיים</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">{{ data()?.totalClicks | number }}</div>
            <div class="kpi-label">סך לחיצות</div>
          </div>
        </div>

        <div class="rates-grid">
          <div class="rate-card">
            <div class="rate-value">{{ data()?.deliveryRate }}%</div>
            <div class="rate-label">שיעור מסירה</div>
            <div class="rate-bar"><div class="rate-fill green" [style.width.%]="data()?.deliveryRate"></div></div>
          </div>
          <div class="rate-card">
            <div class="rate-value">{{ data()?.openRate }}%</div>
            <div class="rate-label">שיעור פתיחה</div>
            <div class="rate-bar"><div class="rate-fill blue" [style.width.%]="data()?.openRate"></div></div>
            <div class="rate-note">הנתון משוער; חלק מתוכנות המייל טוענות תמונות מראש</div>
          </div>
          <div class="rate-card">
            <div class="rate-value">{{ data()?.clickRate }}%</div>
            <div class="rate-label">CTR</div>
            <div class="rate-bar"><div class="rate-fill orange" [style.width.%]="data()?.clickRate"></div></div>
          </div>
          <div class="rate-card">
            <div class="rate-value">{{ data()?.ctorRate }}%</div>
            <div class="rate-label">CTOR</div>
            <div class="rate-bar"><div class="rate-fill purple" [style.width.%]="data()?.ctorRate"></div></div>
          </div>
        </div>

        <div class="issues-grid">
          <div class="issue-card">
            <div class="issue-value">{{ data()?.hardBounces | number }}</div>
            <div class="issue-label">החזרות קבועות</div>
          </div>
          <div class="issue-card">
            <div class="issue-value">{{ data()?.softBounces | number }}</div>
            <div class="issue-label">החזרות זמניות</div>
          </div>
          <div class="issue-card">
            <div class="issue-value">{{ data()?.unsubscribes | number }}</div>
            <div class="issue-label">הסרות</div>
          </div>
          <div class="issue-card">
            <div class="issue-value">{{ data()?.spamComplaints | number }}</div>
            <div class="issue-label">דיווחי ספאם</div>
          </div>
          <div class="issue-card">
            <div class="issue-value">{{ data()?.blocked | number }}</div>
            <div class="issue-label">חסומים</div>
          </div>
          <div class="issue-card">
            <div class="issue-value">{{ data()?.deferred | number }}</div>
            <div class="issue-label">נדחו זמנית</div>
          </div>
        </div>

        @if (data()?.topLinks?.length) {
          <div class="section">
            <h3>קישורים מובילים</h3>
            <div class="links-table">
              @for (link of data()?.topLinks; track link.url) {
                <div class="link-row">
                  <div class="link-identity">
                    <strong>{{ linkLabel(link.url) }}</strong>
                    <a class="link-url" [href]="link.url" target="_blank" rel="noopener" [title]="link.url">{{ link.url }}</a>
                  </div>
                  <div class="link-clicks">{{ link.totalClicks }} לחיצות · {{ link.uniqueClicks }} ייחודיות</div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; padding: 24px; max-width: 1000px; margin: 0 auto; }

    .loading-state {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      padding: 80px 0; color: #888; font-size: 15px;
    }

    .spinner {
      width: 20px; height: 20px; border: 3px solid #e5e7eb;
      border-top-color: #1a73e8; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .error-banner {
      padding: 16px; border-radius: 8px; background: #fee2e2; color: #991b1b; margin: 24px;
    }

    .results-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
    }

    .results-header h2 { margin: 0; font-size: 22px; font-weight: 700; }

    .updated { margin: 0; color: #888; font-size: 13px; display: flex; align-items: center; gap: 8px; }

    .refresh-btn {
      padding: 4px 12px; border: 1px solid #d1d5db; border-radius: 6px;
      background: #fff; color: #555; font-size: 13px; cursor: pointer;
    }

    .refresh-btn:hover:not(:disabled) { background: #f5f5f5; }
    .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .kpi-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;
    }

    @media (max-width: 640px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }

    .kpi-card {
      background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
      padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .kpi-card.highlight-blue { border-color: #93c5fd; background: #eff6ff; }
    .kpi-card.highlight-green { border-color: #86efac; background: #f0fdf4; }

    .kpi-value { font-size: 28px; font-weight: 800; color: #1a1a1a; line-height: 1.1; }
    .kpi-label { font-size: 13px; color: #888; margin-top: 4px; }

    .rates-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;
    }

    @media (max-width: 640px) { .rates-grid { grid-template-columns: repeat(2, 1fr); } }

    .rate-card {
      background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
      padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .rate-value { font-size: 22px; font-weight: 700; color: #1a1a1a; }
    .rate-label { font-size: 13px; color: #888; margin-bottom: 8px; }
    .rate-note { font-size: 11px; color: #aaa; margin-top: 6px; line-height: 1.3; }

    .rate-bar { height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
    .rate-fill { height: 100%; border-radius: 3px; }
    .rate-fill.green { background: #22c55e; }
    .rate-fill.blue { background: #3b82f6; }
    .rate-fill.orange { background: #f59e0b; }
    .rate-fill.purple { background: #8b5cf6; }

    .issues-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px;
    }

    @media (max-width: 640px) { .issues-grid { grid-template-columns: repeat(3, 1fr); } }

    .issue-card {
      background: #fff; border: 1px solid #f0f0f0; border-radius: 8px;
      padding: 12px 14px; text-align: center;
    }

    .issue-value { font-size: 20px; font-weight: 700; color: #555; }
    .issue-label { font-size: 11px; color: #999; margin-top: 2px; }

    .section { margin-bottom: 20px; }
    .section h3 { margin: 0 0 12px 0; font-size: 16px; font-weight: 600; }

    .links-table {
      background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;
    }

    .link-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; border-bottom: 1px solid #f0f0f0; flex-wrap: wrap; gap: 8px;
    }
    .link-row:last-child { border-bottom: none; }

    .link-url {
      font-size: 13px; color: #1a73e8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 500px;
    }
    .link-identity { min-width: 0; display: grid; gap: 4px; }
    .link-clicks { font-size: 13px; color: #666; white-space: nowrap; }
  `]
})
export class V2ResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private v2Service = inject(EmailCampaignV2Service);
  private marketingCampaignService = inject(MarketingCampaignService);

  campaignId = signal<number>(0);
  loading = signal(true);
  refreshing = signal(false);
  error = signal('');
  data = signal<AnalyticsData | null>(null);
  trackingCampaigns = signal<MarketingCampaignSummary[]>([]);

  ngOnInit(): void {
    this.marketingCampaignService.getDashboard().subscribe({
      next: result => this.trackingCampaigns.set(result.campaigns),
    });
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id && !isNaN(id)) {
        this.campaignId.set(id);
        this.loadAnalytics();
      } else {
        this.loading.set(false);
        this.error.set('invalid campaign id');
      }
    });
  }

  linkLabel(rawUrl: string): string {
    try {
      const url = new URL(rawUrl);
      const codeFromPath = url.pathname.match(/\/(?:r|open)\/([a-z0-9-]+)/i)?.[1];
      const code = codeFromPath || url.searchParams.get('ak_campaign');
      const tracked = code
        ? this.trackingCampaigns().find(item => item.code.toLowerCase() === code.toLowerCase())
        : null;
      if (tracked) return tracked.name;

      const lastSegment = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
      return lastSegment && !/^\d+$/.test(lastSegment)
        ? lastSegment.replace(/[-_]+/g, ' ')
        : url.hostname;
    } catch {
      return rawUrl;
    }
  }

  loadAnalytics(): void {
    if (!this.campaignId()) return;
    this.v2Service.getAnalytics(this.campaignId()).subscribe({
      next: (result) => {
        this.data.set(result);
        this.loading.set(false);
        this.refreshing.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.refreshing.set(false);
        this.error.set(`error: ${err?.message || err}`);
      },
    });
  }
}
