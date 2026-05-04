import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface ModalState {
  isOpen: boolean;
  editMode: boolean;
  songToEdit?: any;
  songPrefill?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalState = new BehaviorSubject<ModalState>({
    isOpen: false,
    editMode: false,
    songToEdit: null
  });

  private songUpdated = new Subject<void>();

  modalState$ = this.modalState.asObservable();
  songUpdated$ = this.songUpdated.asObservable();

  openAddSongModal() {
    this.modalState.next({
      isOpen: true,
      editMode: false,
      songToEdit: null,
      songPrefill: null
    });
  }

  openPrefilledAddSongModal(songPrefill: any) {
    this.modalState.next({
      isOpen: true,
      editMode: false,
      songToEdit: null,
      songPrefill
    });
  }

  openEditSongModal(song: any) {
    this.modalState.next({
      isOpen: true,
      editMode: true,
      songToEdit: song,
      songPrefill: null
    });
  }

  closeModal() {
    this.modalState.next({
      isOpen: false,
      editMode: false,
      songToEdit: null,
      songPrefill: null
    });
  }

  notifySongUpdated() {
    this.songUpdated.next();
  }
}
