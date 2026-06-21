import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { AdminUpdateUserDto, UserListDto, UserRole, UserContentTag } from '../../../models/user.model';
import { PagedResult } from '../../../models/user.model';
import { SiteAlertService } from '../../../services/site-alert.service';
import { TeacherFormComponent } from '../teachers/teacher-form.component';
import { ServiceProviderFormComponent } from '../service-providers/service-provider-form.component';


@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TeacherFormComponent, ServiceProviderFormComponent],
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  users: UserListDto[] = [];
  loading = false;
  error: string | null = null;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-users-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-users-view', mode); }
  showTeacherFormModal = false;
  showProviderFormModal = false;
  selectedProfileUserId: number | undefined = undefined;
  editingUser: UserListDto | null = null;
  savingUser = false;
  editUserError: string | null = null;
  selectedUserIds = new Set<number>();
  bulkActionLoading = false;
  userEditForm: AdminUpdateUserDto = {
    username: '',
    email: '',
    phone: '',
    role: UserRole.Regular,
    isActive: true
  };

  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalCount = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  filterRole: number | null = null;
  filterIsActive: boolean | null = null;
  filterContentTag: number | null = null;

  tagOptions = [
    { value: null, label: 'כל התגים' },
    { value: 1, label: 'חבר מתחיל' },
    { value: 2, label: 'תורם' },
    { value: 3, label: 'תורם מוביל' }
  ];

  // Role enum for dropdown
  roleOptions = [
    { value: null, label: 'כל התפקידים' },
    { value: 0, label: 'משתמש רגיל' },
    { value: 1, label: 'מורה' },
    { value: 2, label: 'אמן' },
    { value: 3, label: 'מנהל תוכן' },
    { value: 4, label: 'מנהל מערכת' }
  ];

  editableRoleOptions = this.roleOptions.filter(option => option.value !== null) as { value: UserRole; label: string }[];

  // UserRole enum reference for template
  UserRole = UserRole;
  UserContentTag = UserContentTag;

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
      this.pageSize,
      this.filterContentTag ?? undefined
    ).subscribe({
      next: (result: PagedResult<UserListDto>) => {
        this.users = result.items;
        this.totalCount = result.totalCount;
        this.totalPages = Math.ceil(result.totalCount / result.pageSize);
        this.clearSelection();
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
    this.filterContentTag = null;
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

  get selectedCount(): number {
    return this.selectedUserIds.size;
  }

  get selectedUserIdsArray(): number[] {
    return Array.from(this.selectedUserIds);
  }

  get hasSelection(): boolean {
    return this.selectedUserIds.size > 0;
  }

  get allCurrentPageSelected(): boolean {
    return this.users.length > 0 && this.users.every(user => this.selectedUserIds.has(user.id));
  }

  isSelected(userId: number): boolean {
    return this.selectedUserIds.has(userId);
  }

  toggleUserSelection(userId: number, event?: Event): void {
    event?.stopPropagation();
    if (this.bulkActionLoading) return;

    if (this.selectedUserIds.has(userId)) {
      this.selectedUserIds.delete(userId);
      return;
    }

    this.selectedUserIds.add(userId);
  }

  toggleSelectCurrentPage(event?: Event): void {
    event?.stopPropagation();
    if (this.bulkActionLoading) return;

    if (this.allCurrentPageSelected) {
      this.users.forEach(user => this.selectedUserIds.delete(user.id));
      return;
    }

    this.selectAllCurrentPage();
  }

  selectAllCurrentPage(): void {
    if (this.bulkActionLoading) return;
    this.users.forEach(user => this.selectedUserIds.add(user.id));
  }

  clearSelection(): void {
    if (this.bulkActionLoading) return;
    this.selectedUserIds.clear();
  }

  editUser(user: UserListDto): void {
    this.editingUser = user;
    this.editUserError = null;
    this.userEditForm = {
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      isActive: user.isActive
    };
  }

  closeEditUserModal(): void {
    if (this.savingUser) return;
    this.editingUser = null;
    this.editUserError = null;
  }

  saveUser(): void {
    if (!this.editingUser) return;

    this.savingUser = true;
    this.editUserError = null;

    const payload = this.buildUserUpdatePayload();

    this.userService.updateUser(this.editingUser.id, payload).subscribe({
      next: (updated) => {
        this.users = this.users.map(user => user.id === updated.id ? updated : user);
        this.savingUser = false;
        this.closeEditUserModal();
      },
      error: (err: any) => {
        console.error('שגיאה בעדכון משתמש:', err);
        this.editUserError = 'לא הצלחנו לשמור את פרטי המשתמש';
        this.savingUser = false;
      }
    });
  }

  async upgradeToAdmin(user: UserListDto): Promise<void> {
    if (user.role === UserRole.Admin) return;

    if (await this.siteAlerts.confirm(`לשדרג את ${user.username} למנהל מערכת?`)) {
      this.userService.updateUser(user.id, {
        username: user.username,
        email: user.email,
        phone: user.phone || '',
        role: UserRole.Admin,
        isActive: user.isActive
      }).subscribe({
        next: (updated) => {
          this.users = this.users.map(existing => existing.id === updated.id ? updated : existing);
        },
        error: (err: any) => {
          console.error('שגיאה בשדרוג למנהל:', err);
          this.siteAlerts.show('לא הצלחנו לשדרג את המשתמש למנהל');
        }
      });
    }
  }
  async bulkUpgradeToAdmin(): Promise<void> {
    const selectedUsers = this.getSelectedUsers();
    const usersToUpgrade = selectedUsers.filter(user => user.role !== UserRole.Admin);

    if (usersToUpgrade.length === 0) {
      this.siteAlerts.show('כל המשתמשים שנבחרו כבר מנהלי מערכת');
      return;
    }

    if (!await this.siteAlerts.confirm(`לשדרג ${usersToUpgrade.length} משתמשים למנהלי מערכת?`)) {
      return;
    }

    this.bulkActionLoading = true;
    forkJoin(usersToUpgrade.map(user => this.userService.updateUser(user.id, {
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      role: UserRole.Admin,
      isActive: user.isActive
    }))).subscribe({
      next: (updatedUsers) => {
        this.users = this.users.map(user => updatedUsers.find(updated => updated.id === user.id) || user);
        this.bulkActionLoading = false;
        this.clearSelection();
      },
      error: (err: any) => {
        console.error('שגיאה בשדרוג משתמשים למנהל:', err);
        this.bulkActionLoading = false;
        this.siteAlerts.show('לא הצלחנו לשדרג את המשתמשים שנבחרו');
      }
    });
  }

  async bulkDeleteSelected(): Promise<void> {
    const ids = this.selectedUserIdsArray;
    if (ids.length === 0) return;

    if (!await this.siteAlerts.confirm(`למחוק ${ids.length} משתמשים? פעולה זו אינה הפיכה.`)) {
      return;
    }

    this.bulkActionLoading = true;
    forkJoin(ids.map(id => this.userService.deleteUser(id))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.siteAlerts.show('המשתמשים שנבחרו נמחקו בהצלחה');
        this.clearSelection();
        this.loadUsers();
      },
      error: (err: any) => {
        console.error('שגיאה במחיקת משתמשים:', err);
        this.bulkActionLoading = false;
        this.siteAlerts.show('שגיאה במחיקת המשתמשים שנבחרו');
      }
    });
  }

  private getSelectedUsers(): UserListDto[] {
    return this.users.filter(user => this.selectedUserIds.has(user.id));
  }

  private buildUserUpdatePayload(): AdminUpdateUserDto {
    return { ...this.userEditForm };
  }

  async deleteUser(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם למחוק את המשתמש? פעולה זו אינה הפיכה.')) {
      this.userService.deleteUser(id).subscribe({
        next: () => {
          this.siteAlerts.show('המשתמש נמחק בהצלחה');
          this.loadUsers();
        },
        error: (err: any) => {
          console.error('שגיאה במחיקת משתמש:', err);
          this.siteAlerts.show('שגיאה במחיקת המשתמש');
        }
      });
    }
  }

  upgradeToTeacher(userId: number): void {
    this.selectedProfileUserId = userId;
    this.showTeacherFormModal = true;
  }

  upgradeToServiceProvider(userId: number): void {
    this.selectedProfileUserId = userId;
    this.showProviderFormModal = true;
  }

  upgradeSelectedToTeacher(): void {
    const [userId] = this.selectedUserIdsArray;
    if (!userId || this.selectedCount !== 1) return;
    this.upgradeToTeacher(userId);
  }

  upgradeSelectedToServiceProvider(): void {
    const [userId] = this.selectedUserIdsArray;
    if (!userId || this.selectedCount !== 1) return;
    this.upgradeToServiceProvider(userId);
  }

  closeProfileFormModal(): void {
    this.showTeacherFormModal = false;
    this.showProviderFormModal = false;
    this.selectedProfileUserId = undefined;
    this.loadUsers();
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

  getContentTagLabel(tag: UserContentTag): string {
    switch (tag) {
      case UserContentTag.Beginner:           return 'חבר מתחיל';
      case UserContentTag.Contributor:        return 'תורם';
      case UserContentTag.LeadingContributor: return 'תורם מוביל';
      default: return '';
    }
  }

  getContentTagClass(tag: UserContentTag): string {
    switch (tag) {
      case UserContentTag.Beginner:           return 'tag-beginner';
      case UserContentTag.Contributor:        return 'tag-contributor';
      case UserContentTag.LeadingContributor: return 'tag-leading';
      default: return '';
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
