import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AddSongModalComponent } from './components/add-song-modal/add-song-modal.component';
import { LayoutComponent } from './components/layout/layout.component';
import { CommonModule } from '@angular/common';
import { ModalService } from './services/modal.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AddSongModalComponent, LayoutComponent, CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  title = 'אקורדישקייט';
  isAddSongModalOpen = false;
  editMode = false;
  songToEdit: any = null;

  constructor(private modalService: ModalService) { }

  ngOnInit() {
    // Subscribe to modal state changes
    this.modalService.modalState$.subscribe(state => {
      this.isAddSongModalOpen = state.isOpen;
      this.editMode = state.editMode;
      this.songToEdit = state.songToEdit;
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