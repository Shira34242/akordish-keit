import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserListDto } from '../../../models/user.model';

@Component({
  selector: 'app-user-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>בחר משתמש</h2>
          <button class="btn-close" (click)="close()">
            <span class="material-icons">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="search-box">
            <span class="material-icons search-icon">search</span>
            <input
              type="text"
              [(ngModel)]="searchText"
              (ngModelChange)="onSearchChange()"
              placeholder="חפש לפי שם משתמש או אימייל..."
              class="search-input"
              autofocus
            />
            <button
              *ngIf="searchText"
              class="btn-clear-search"
              (click)="searchText = ''; onSearchChange()"
            >
              <span class="material-icons">clear</span>
            </button>
          </div>

          <div class="users-list" *ngIf="!loading">
            <div
              *ngFor="let user of filteredUsers"
              class="user-item"
              (click)="selectUser(user)"
            >
              <div class="user-icon">
                <span class="material-icons">person</span>
              </div>
              <div class="user-info">
                <div class="user-name">{{ user.username }}</div>
                <div class="user-email">{{ user.email }}</div>
              </div>
              <span class="material-icons select-icon">chevron_left</span>
            </div>

            <div *ngIf="filteredUsers.length === 0" class="no-results">
              <span class="material-icons">search_off</span>
              <p>לא נמצאו משתמשים</p>
            </div>
          </div>

          <div class="loading" *ngIf="loading">
            <div class="spinner"></div>
            <p>טוען משתמשים...</p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" (click)="close()">ביטול</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      max-width: 500px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.5rem;
      color: #333;
    }

    .btn-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .btn-close:hover {
      background-color: #f5f5f5;
    }

    .btn-close .material-icons {
      font-size: 24px;
      color: #666;
    }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .search-box {
      position: relative;
      margin-bottom: 20px;
    }

    .search-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #999;
      font-size: 20px;
    }

    .search-input {
      width: 100%;
      padding: 12px 40px 12px 40px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #2d7a3e;
    }

    .btn-clear-search {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    }

    .btn-clear-search:hover {
      background-color: #f5f5f5;
    }

    .btn-clear-search .material-icons {
      font-size: 18px;
      color: #999;
    }

    .users-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .user-item {
      display: flex;
      align-items: center;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .user-item:hover {
      background-color: #f9f9f9;
      border-color: #2d7a3e;
      transform: translateX(-2px);
    }

    .user-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #e8f5e9;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 12px;
    }

    .user-icon .material-icons {
      color: #2d7a3e;
      font-size: 24px;
    }

    .user-info {
      flex: 1;
    }

    .user-name {
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
    }

    .user-email {
      font-size: 0.9em;
      color: #666;
    }

    .select-icon {
      color: #999;
      font-size: 24px;
    }

    .no-results {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }

    .no-results .material-icons {
      font-size: 48px;
      margin-bottom: 10px;
      opacity: 0.5;
    }

    .no-results p {
      margin: 0;
      font-size: 1.1em;
    }

    .loading {
      text-align: center;
      padding: 40px 20px;
    }

    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #2d7a3e;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .modal-footer {
      padding: 15px 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
    }

    .btn-cancel {
      padding: 10px 20px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .btn-cancel:hover {
      background: #f5f5f5;
    }
  `]
})
export class UserSelectionModalComponent {
  @Input() users: UserListDto[] = [];
  @Input() loading: boolean = false;
  @Output() userSelected = new EventEmitter<UserListDto>();
  @Output() closeModal = new EventEmitter<void>();

  searchText: string = '';
  filteredUsers: UserListDto[] = [];

  ngOnInit() {
    this.filteredUsers = this.users;
  }

  ngOnChanges() {
    this.onSearchChange();
  }

  onSearchChange() {
    if (!this.searchText.trim()) {
      this.filteredUsers = this.users;
      return;
    }

    const search = this.searchText.toLowerCase().trim();
    this.filteredUsers = this.users.filter(user =>
      user.username.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    );
  }

  selectUser(user: UserListDto) {
    this.userSelected.emit(user);
  }

  close() {
    this.closeModal.emit();
  }
}
