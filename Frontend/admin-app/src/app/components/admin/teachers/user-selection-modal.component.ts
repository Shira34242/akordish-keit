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
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: var(--space-lg);
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal-content {
      background: #ffffff;
      border-radius: 24px;
      max-width: 500px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.2s ease-out;
    }

    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-lg) var(--space-xl);
      background: #F2F2F2;
      border-radius: 24px 24px 0 0;
    }

    .modal-header h2 {
      margin: 0;
      font-family: 'Open Sans', sans-serif;
      font-size: var(--font-xl);
      font-weight: 800;
      color: #000000;
    }

    .btn-close {
      background: #ffffff;
      border: none;
      cursor: pointer;
      width: 34px;
      height: 34px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.15s ease;
    }

    .btn-close:hover { background: #404040; }

    .btn-close:hover .material-icons { color: #ffffff; }

    .btn-close .material-icons { font-size: 18px; color: #000000; }

    .modal-body {
      padding: var(--space-xl);
      overflow-y: auto;
      flex: 1;
    }

    .search-box {
      position: relative;
      margin-bottom: var(--space-base);
    }

    .search-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #404040;
      font-size: 20px;
      opacity: 0.4;
    }

    .search-input {
      width: 100%;
      padding: var(--space-md) 40px var(--space-md) 40px;
      border: 2px solid #F2F2F2;
      border-radius: 999px;
      font-family: 'Open Sans', sans-serif;
      font-weight: 300;
      font-size: var(--font-sm);
      color: #000000;
      background: #ffffff;
      box-sizing: border-box;
      transition: border-color 0.15s ease;
    }

    .search-input:focus { outline: none; border-color: #ddff53; }

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
      transition: background 0.15s ease;
    }

    .btn-clear-search:hover { background: #F2F2F2; }

    .btn-clear-search .material-icons { font-size: 18px; color: #404040; }

    .users-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .user-item {
      display: flex;
      align-items: center;
      padding: var(--space-md) var(--space-base);
      background: #F2F2F2;
      border-radius: 16px;
      margin-bottom: var(--space-sm);
      cursor: pointer;
      transition: background 0.15s ease;
      border: none;
    }

    .user-item:hover { background: #ddff53; }

    .user-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 12px;
    }

    .user-icon .material-icons { color: #ddff53; font-size: 24px; }

    .user-info { flex: 1; }

    .user-name {
      font-family: 'Open Sans', sans-serif;
      font-weight: 800;
      color: #000000;
      margin-bottom: 2px;
      font-size: var(--font-sm);
    }

    .user-email {
      font-family: 'Open Sans', sans-serif;
      font-weight: 300;
      font-size: var(--font-xs);
      color: #404040;
    }

    .select-icon {
      color: #404040;
      font-size: 24px;
    }

    .no-results {
      text-align: center;
      padding: var(--space-3xl) var(--space-lg);
      color: #404040;
    }

    .no-results .material-icons {
      font-size: 48px;
      margin-bottom: var(--space-sm);
      opacity: 0.2;
      color: #000000;
    }

    .no-results p {
      margin: 0;
      font-family: 'Open Sans', sans-serif;
      font-weight: 300;
      font-size: var(--font-base);
    }

    .loading {
      text-align: center;
      padding: var(--space-3xl) var(--space-lg);
    }

    .spinner {
      border: 3px solid #F2F2F2;
      border-top: 3px solid #000000;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto var(--space-base);
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .modal-footer {
      padding: var(--space-lg) var(--space-xl);
      background: #F2F2F2;
      border-radius: 0 0 24px 24px;
      display: flex;
      justify-content: flex-end;
    }

    .btn-cancel {
      padding: var(--space-md) var(--space-xl);
      border: none;
      background: #ffffff;
      border-radius: 999px;
      cursor: pointer;
      font-family: 'Open Sans', sans-serif;
      font-size: var(--font-sm);
      font-weight: 800;
      color: #000000;
      transition: background 0.15s ease;
    }

    .btn-cancel:hover { background: #ddff53; }
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
