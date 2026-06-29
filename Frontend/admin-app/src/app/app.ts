import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AddSongModalComponent } from './components/add-song-modal/add-song-modal.component';
import { ReportModalComponent } from './components/shared/report-modal/report-modal.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalService, ReportModalState } from './services/modal.service';
import { SiteAlertsComponent } from './components/shared/site-alerts/site-alerts.component';
import { SiteAlertService } from './services/site-alert.service';
import { GoogleOneTapService } from './services/google-one-tap.service';
import { RequiredFieldFeedbackService } from './services/required-field-feedback.service';
import { AuthService } from './services/auth.service';
import { SeoRouteService } from './services/seo-route.service';
import { AdBlockDetectionService } from './services/adblock-detection.service';
import { SystemSettingsService } from './services/system-settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AddSongModalComponent, ReportModalComponent, CommonModule, FormsModule, SiteAlertsComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  title = 'אקורדישקייט';

  showGate = false;
  gateSubmitting = false;
  gateInput = '';
  gateError: string | null = null;

  submitGate() {
    if (!this.gateInput.trim() || this.gateSubmitting) return;

    this.gateSubmitting = true;
    this.gateError = null;

    this.settingsService.verifyAccessGate(this.gateInput).subscribe({
      next: (status) => {
        this.showGate = false;
        this.gateSubmitting = false;
        this.gateInput = '';
        this.startAppServices();
      },
      error: () => {
        this.gateError = 'סיסמה שגויה';
        this.gateSubmitting = false;
      }
    });
  }

  isAddSongModalOpen = false;
  editMode = false;
  songToEdit: any = null;
  songPrefill: any = null;
  songModalFlowMode: 'smart' | 'legacy' = 'smart';
  reportModal: ReportModalState = {
    isOpen: false,
    contentType: 'General',
    contentId: 0,
    contentTitle: undefined
  };

  constructor(
    private modalService: ModalService,
    private siteAlertService: SiteAlertService,
    private googleOneTapService: GoogleOneTapService,
    private requiredFieldFeedback: RequiredFieldFeedbackService,
    private authService: AuthService,
    private seoRouteService: SeoRouteService,
    private adBlockDetectionService: AdBlockDetectionService,
    private settingsService: SystemSettingsService
  ) { }

  ngOnInit() {
    this.startAppServices();
    this.checkAccessGate();
  }

  private checkAccessGate(): void {
    this.settingsService.getAccessGate().subscribe({
      next: (status) => {
        this.showGate = status.enabled && !status.hasAccess;
      },
      error: () => {
        // שגיאה בבדיקת ה-gate לא חוסמת את האפליקציה
      }
    });
  }

  private startAppServices(): void {
    this.seoRouteService.start();
    this.adBlockDetectionService.start();
    this.siteAlertService.patchBrowserAlerts();
    this.requiredFieldFeedback.initGlobalValidation();
    this.googleOneTapService.init();
    this.authService.refreshSession().subscribe({
      error: () => {}
    });

    // Subscribe to modal state changes
    this.modalService.modalState$.subscribe(state => {
      this.isAddSongModalOpen = state.isOpen;
      this.editMode = state.editMode;
      this.songToEdit = state.songToEdit;
      this.songPrefill = state.songPrefill;
      this.songModalFlowMode = state.flowMode ?? 'smart';
    });

    this.modalService.reportModalState$.subscribe(state => {
      this.reportModal = state;
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
