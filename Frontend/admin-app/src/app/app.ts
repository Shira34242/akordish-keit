import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AddSongModalComponent } from './components/add-song-modal/add-song-modal.component';
import { CommonModule } from '@angular/common';
import { ModalService } from './services/modal.service';
import { SiteAlertsComponent } from './components/shared/site-alerts/site-alerts.component';
import { SiteAlertService } from './services/site-alert.service';
import { GoogleOneTapService } from './services/google-one-tap.service';
import { RequiredFieldFeedbackService } from './services/required-field-feedback.service';
import { AuthService } from './services/auth.service';
import { SeoRouteService } from './services/seo-route.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AddSongModalComponent, CommonModule, SiteAlertsComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  title = 'אקורדישקייט';
  isAddSongModalOpen = false;
  editMode = false;
  songToEdit: any = null;
  songPrefill: any = null;

  constructor(
    private modalService: ModalService,
    private siteAlertService: SiteAlertService,
    private googleOneTapService: GoogleOneTapService,
    private requiredFieldFeedback: RequiredFieldFeedbackService,
    private authService: AuthService,
    private seoRouteService: SeoRouteService
  ) { }

  ngOnInit() {
    this.seoRouteService.start();
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
    });
  }

  openAddSongModal() {
    this.modalService.openAddSongModal();
  }

  closeAddSongModal() {
    this.modalService.closeModal();
  }

  onSongAdded() {
    console.log('Song added successfully');
    this.modalService.closeModal();
    // מודיע לכל הרכיבים שהשיר עודכן
    this.modalService.notifySongUpdated();
  }
}
