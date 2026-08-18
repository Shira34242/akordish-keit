import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AddSongModalComponent } from './components/add-song-modal/add-song-modal.component';
import { ReportModalComponent } from './components/shared/report-modal/report-modal.component';
import { CommonModule } from '@angular/common';
import { ModalService, ReportModalState } from './services/modal.service';
import { SiteAlertsComponent } from './components/shared/site-alerts/site-alerts.component';
import { SiteAlertService } from './services/site-alert.service';
import { RequiredFieldFeedbackService } from './services/required-field-feedback.service';
import { AuthService } from './services/auth.service';
import { SeoRouteService } from './services/seo-route.service';
import { AdBlockDetectionService } from './services/adblock-detection.service';
import { PageViewAnalyticsService } from './services/page-view-analytics.service';
import { ReportContextService } from './services/report-context.service';
import { ScrollRestorationService } from './services/scroll-restoration.service';
import { MarketingAttributionService } from './services/marketing-attribution.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AddSongModalComponent, ReportModalComponent, CommonModule, SiteAlertsComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  title = 'אקורדישקייט';

  isAddSongModalOpen = false;
  editMode = false;
  songToEdit: any = null;
  songPrefill: any = null;
  songModalFlowMode: 'smart' | 'legacy' = 'smart';
  suppressSongTitleLengthWarning = false;
  reportModal: ReportModalState = {
    isOpen: false,
    contentType: 'General',
    contentId: 0,
    contentTitle: undefined
  };
  private appServicesStarted = false;

  constructor(
    private modalService: ModalService,
    private siteAlertService: SiteAlertService,
    private requiredFieldFeedback: RequiredFieldFeedbackService,
    private authService: AuthService,
    private seoRouteService: SeoRouteService,
    private adBlockDetectionService: AdBlockDetectionService,
    private router: Router,
    private pageViewAnalytics: PageViewAnalyticsService,
    private reportContextService: ReportContextService,
    private scrollRestoration: ScrollRestorationService,
    private marketingAttribution: MarketingAttributionService
  ) { }

  ngOnInit() {
    void this.scrollRestoration;
    this.authService.captureReferralCodeFromUrl();
    this.marketingAttribution.captureFromUrl();
    this.startAppServices();
  }

  private startAppServices(): void {
    if (this.appServicesStarted) return;
    this.appServicesStarted = true;

    this.seoRouteService.start();
    this.startPageTracking();
    this.adBlockDetectionService.start();
    this.siteAlertService.patchBrowserAlerts();
    this.requiredFieldFeedback.initGlobalValidation();
    this.reportContextService.start();
    this.authService.refreshSession().subscribe();

    // Subscribe to modal state changes
    this.modalService.modalState$.subscribe(state => {
      this.isAddSongModalOpen = state.isOpen;
      this.editMode = state.editMode;
      this.songToEdit = state.songToEdit;
      this.songPrefill = state.songPrefill;
      this.songModalFlowMode = state.flowMode ?? 'smart';
      this.suppressSongTitleLengthWarning = state.suppressTitleLengthWarning ?? false;
    });

    this.modalService.reportModalState$.subscribe(state => {
      this.reportModal = state;
    });
  }

  private startPageTracking(): void {
    this.pageViewAnalytics.track(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        window.setTimeout(() => this.pageViewAnalytics.track(event.urlAfterRedirects), 0);
      });
  }

  openAddSongModal() {
    this.modalService.openAddSongModal();
  }

  closeAddSongModal() {
    this.modalService.closeModal();
  }

  onSongAdded() {
    this.modalService.closeModal();
    // מודיע לכל הרכיבים שהשיר עודכן
    this.modalService.notifySongUpdated();
  }

  closeReportModal() {
    this.modalService.closeReportModal();
  }
}
