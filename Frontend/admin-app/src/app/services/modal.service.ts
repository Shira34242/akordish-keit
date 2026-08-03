import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface ModalState {
  isOpen: boolean;
  editMode: boolean;
  songToEdit?: any;
  songPrefill?: any;
  flowMode?: 'smart' | 'legacy';
  suppressTitleLengthWarning?: boolean;
}

export interface ReportModalState {
  isOpen: boolean;
  contentType: 'Song' | 'Article' | 'BlogPost' | 'General';
  contentId: number;
  contentTitle?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalState = new BehaviorSubject<ModalState>({
    isOpen: false,
    editMode: false,
    songToEdit: null,
    flowMode: 'smart'
  });

  private songUpdated = new Subject<void>();
  private reportModalState = new BehaviorSubject<ReportModalState>({
    isOpen: false,
    contentType: 'General',
    contentId: 0,
    contentTitle: undefined
  });

  modalState$ = this.modalState.asObservable();
  songUpdated$ = this.songUpdated.asObservable();
  reportModalState$ = this.reportModalState.asObservable();

  openAddSongModal(options: { flowMode?: 'smart' | 'legacy'; suppressTitleLengthWarning?: boolean } = {}) {
    this.modalState.next({
      isOpen: true,
      editMode: false,
      songToEdit: null,
      songPrefill: null,
      flowMode: options.flowMode ?? 'smart',
      suppressTitleLengthWarning: options.suppressTitleLengthWarning ?? false
    });
  }

  openPrefilledAddSongModal(songPrefill: any) {
    this.modalState.next({
      isOpen: true,
      editMode: false,
      songToEdit: null,
      songPrefill,
      flowMode: 'legacy'
    });
  }

  openEditSongModal(song: any) {
    this.modalState.next({
      isOpen: true,
      editMode: true,
      songToEdit: song,
      songPrefill: null,
      flowMode: 'legacy'
    });
  }

  closeModal() {
    this.modalState.next({
      isOpen: false,
      editMode: false,
      songToEdit: null,
      songPrefill: null,
      flowMode: 'smart'
    });
  }

  notifySongUpdated() {
    this.songUpdated.next();
  }

  openReportModal(report: Partial<Omit<ReportModalState, 'isOpen'>> = {}) {
    this.reportModalState.next({
      isOpen: true,
      contentType: report.contentType || 'General',
      contentId: report.contentId || 0,
      contentTitle: report.contentTitle
    });
  }

  closeReportModal() {
    this.reportModalState.next({
      isOpen: false,
      contentType: 'General',
      contentId: 0,
      contentTitle: undefined
    });
  }
}
