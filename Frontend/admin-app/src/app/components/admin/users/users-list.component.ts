import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { UserListDto, UserRole } from '../../../models/user.model';
import { PagedResult } from '../../../models/user.model';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit {
  users: UserListDto[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  filterRole: number | null = null;
  filterIsActive: boolean | null = null;

  // Role enum for dropdown
  roleOptions = [
    { value: null, label: 'כל התפקידים' },
    { value: 0, label: 'משתמש רגיל' },
    { value: 1, label: 'מורה' },
    { value: 2, label: 'אמן' },
    { value: 3, label: 'מנהל תוכן' },
    { value: 4, label: 'מנהל מערכת' }
  ];

  // UserRole enum reference for template
  UserRole = UserRole;

  constructor(
    private userService: UserService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;

    this.userService.getUsers(
      this.searchTerm || undefined,
      this.filterRole ?? undefined,
      this.filterIsActive ?? undefined,
      this.currentPage,
      this.pageSize
    ).subscribe({
      next: (result: PagedResult<UserListDto>) => {
        this.users = result.items;
        this.totalCount = result.totalCount;
        this.totalPages = Math.ceil(result.totalCount / result.pageSize);
        this.loading = false;
      },
      error: (err: any) => {
        console.error('שגיאה בטעינת משתמשים:', err);
        this.error = 'שגיאה בטעינת נתוני המשתמשים';
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterRole = null;
    this.filterIsActive = null;
    this.currentPage = 1;
    this.loadUsers();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadUsers();
    }
  }

  viewUser(id: number): void {
    this.router.navigate(['/admin/users/view', id]);
  }

  editUser(id: number): void {
    this.router.navigate(['/admin/users/edit', id]);
  }

  deleteUser(id: number): void {
    if (confirm('האם למחוק את המשתמש? פעולה זו אינה הפיכה.')) {
      this.userService.deleteUser(id).subscribe({
        next: () => {
          alert('המשתמש נמחק בהצלחה');
          this.loadUsers();
        },
        error: (err: any) => {
          console.error('שגיאה במחיקת משתמש:', err);
          alert('שגיאה במחיקת המשתמש');
        }
      });
    }
  }

  upgradeToTeacher(userId: number): void {
    this.router.navigate(['/admin/teachers/new'], {
      queryParams: { userId: userId }
    });
  }

  upgradeToServiceProvider(userId: number): void {
    this.router.navigate(['/admin/service-providers/new'], {
      queryParams: { userId: userId }
    });
  }

  getRoleBadgeClass(role: UserRole): string {
    switch (role) {
      case UserRole.Admin: return 'badge-danger';
      case UserRole.Manager: return 'badge-warning';
      case UserRole.Teacher: return 'badge-success';
      case UserRole.Artist: return 'badge-star';
      case UserRole.Regular: return 'badge-secondary';
      default: return 'badge-secondary';
    }
  }

  getRoleLabel(role: UserRole): string {
    switch (role) {
      case UserRole.Admin: return 'מנהל מערכת';
      case UserRole.Manager: return 'מנהל תוכן';
      case UserRole.Teacher: return 'מורה';
      case UserRole.Artist: return 'אמן';
      case UserRole.Regular: return 'משתמש רגיל';
      default: return 'לא ידוע';
    }
  }

  getPaginationRange(): number[] {
    const range: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }
}
