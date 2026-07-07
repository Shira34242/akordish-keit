import { Component, OnInit, inject, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { AdminUpdateUserDto, AdminUserDetailDto, UserListDto, UserRole, UserContentTag } from '../../../models/user.model';
import { PagedResult } from '../../../models/user.model';
import { SiteAlertService } from '../../../services/site-alert.service';
import { TeacherFormComponent } from '../teachers/teacher-form.component';
import { ServiceProviderFormComponent } from '../service-providers/service-provider-form.component';


@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TeacherFormComponent, ServiceProviderFormComponent],
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private isDestroyed = false;
  private scrollObserver?: IntersectionObserver;

  @ViewChild('scrollSentinel') scrollSentinelRef?: ElementRef<HTMLElement>;
  users: UserListDto[] = [];
  loading = false;
  error: string | null = null;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-users-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-users-view', mode); }
  showTeacherFormModal = false;
  showProviderFormModal = false;
  selectedProfileUserId: number | undefined = undefined;
  editingUser: UserListDto | null = null;
  selectedUserDetail: AdminUserDetailDto | null = null;
  loadingUserDetail = false;
  userDetailError: string | null = null;
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

  // Infinite scroll
  pageSize = 25;
  totalCount = 0;
  allLoaded = false;
  loadingMore = false;
  currentPage = 0;

  // Filters
  searchTerm = '';
  filterRole: number | null = null;
  filterIsActive: boolean | null = null;
  filterContentTag: number | null = null;
  sortBy = 'created_desc';

  sortOptions = [
    { value: 'created_desc', label: 'חדש לישן' },
    { value: 'created_asc', label: 'ישן לחדש' },
    { value: 'name_asc', label: 'א-ת' },
    { value: 'name_desc', label: 'ת-א' }
  ];

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

  ngAfterViewInit(): void {
    this.setupScrollObserver();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.destroyScrollObserver();
  }

  private destroyScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = undefined;
    }
  }

  private setupScrollObserver(): void {
    if (this.isDestroyed) return;

    this.destroyScrollObserver();

    if (!this.scrollSentinelRef?.nativeElement) {
      // Retry after a short delay (sentinel might not be rendered yet)
      setTimeout(() => this.setupScrollObserver(), 100);
      return;
    }

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.loading && !this.loadingMore && !this.allLoaded) {
          this.loadMoreUsers();
        }
      },
      { rootMargin: '200px' }
    );

    this.scrollObserver.observe(this.scrollSentinelRef.nativeElement);
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;
    this.currentPage = 1;
    this.allLoaded = false;
    this.loadingMore = false;

    this.userService.getUsers(
      this.searchTerm || undefined,
      this.filterRole ?? undefined,
      this.filterIsActive ?? undefined,
      this.currentPage,
      this.pageSize,
      this.filterContentTag ?? undefined,
      undefined,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<UserListDto>) => {
        this.users = result.items;
        this.totalCount = result.totalCount;
        this.allLoaded = result.items.length >= result.totalCount;
        this.clearSelection();
        this.loading = false;
        // Re-observe sentinel after data changes
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (err: any) => {
        console.error('שגיאה בטעינת משתמשים:', err);
        this.error = 'שגיאה בטעינת נתוני המשתמשים';
        this.loading = false;
      }
    });
  }

  loadMoreUsers(): void {
    if (this.loading || this.loadingMore || this.allLoaded) return;

    this.loadingMore = true;
    this.currentPage++;

    this.userService.getUsers(
      this.searchTerm || undefined,
      this.filterRole ?? undefined,
      this.filterIsActive ?? undefined,
      this.currentPage,
      this.pageSize,
      this.filterContentTag ?? undefined,
      undefined,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<UserListDto>) => {
        this.users = [...this.users, ...result.items];
        this.totalCount = result.totalCount;
        this.allLoaded = this.users.length >= result.totalCount;
        this.loadingMore = false;
        // Re-observe sentinel after data changes
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (err: any) => {
        console.error('שגיאה בטעינת משתמשים נוספים:', err);
        this.loadingMore = false;
        this.currentPage--; // Rollback page on error
      }
    });
  }

  private reattachScrollObserver(): void {
    if (!this.scrollSentinelRef?.nativeElement) return;
    this.scrollObserver?.disconnect();
    this.scrollObserver?.observe(this.scrollSentinelRef.nativeElement);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  getPaginationRange(): number[] {
    const total = this.totalPages;
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  goToPage(page: number): void {
    const targetPage = Math.min(Math.max(page, 1), this.totalPages);
    if (targetPage === this.currentPage || this.loading || this.loadingMore) return;

    this.loading = true;
    this.error = null;
    this.currentPage = targetPage;
    this.allLoaded = false;
    this.loadingMore = false;

    this.userService.getUsers(
      this.searchTerm || undefined,
      this.filterRole ?? undefined,
      this.filterIsActive ?? undefined,
      this.currentPage,
      this.pageSize,
      this.filterContentTag ?? undefined,
      undefined,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<UserListDto>) => {
        this.users = result.items;
        this.totalCount = result.totalCount;
        this.allLoaded = this.currentPage >= this.totalPages;
        this.clearSelection();
        this.loading = false;
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (err: any) => {
        console.error('׳©׳’׳™׳׳” ׳‘׳˜׳¢׳™׳ ׳× ׳¢׳׳•׳“ ׳׳©׳×׳׳©׳™׳:', err);
        this.error = '׳©׳’׳™׳׳” ׳‘׳˜׳¢׳™׳ ׳× ׳ ׳×׳•׳ ׳™ ׳”׳׳©׳×׳׳©׳™׳';
        this.loading = false;
      }
    });
  }


  onSearch(): void {
    this.loadUsers();
  }

  onFilterChange(): void {
    this.loadUsers();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterRole = null;
    this.filterIsActive = null;
    this.filterContentTag = null;
    this.sortBy = 'created_desc';
    this.loadUsers();
  }

  viewUser(id: number): void {
    this.loadingUserDetail = true;
    this.userDetailError = null;
    this.selectedUserDetail = null;

    this.userService.getUserDetail(id).subscribe({
      next: (detail) => {
        this.selectedUserDetail = detail;
        this.loadingUserDetail = false;
      },
      error: (err: any) => {
        console.error('שגיאה בטעינת פרטי משתמש:', err);
        if (err?.status === 0) {
          this.userDetailError = 'השרת לא זמין כרגע. צריך לוודא שה-Backend רץ.';
        } else if (err?.status === 404) {
          this.userDetailError = 'השרת שרץ עדיין לא מכיר את פרטי המשתמש החדשים. צריך להפעיל את ה-Backend מחדש.';
        } else if (err?.error?.detail) {
          this.userDetailError = `שגיאה בטעינת פרטי המשתמש: ${err.error.detail}`;
        } else {
          this.userDetailError = 'לא הצלחנו לטעון את פרטי המשתמש';
        }
        this.loadingUserDetail = false;
      }
    });
  }

  closeUserDetailModal(): void {
    this.selectedUserDetail = null;
    this.userDetailError = null;
    this.loadingUserDetail = false;
  }

  openNotificationForUser(user: AdminUserDetailDto): void {
    this.router.navigate(['/admin/notifications/messages'], {
      queryParams: {
        userId: user.id,
        userName: user.username
      }
    });
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

  getInstrumentLevelLabel(level?: number | null): string {
    switch (level) {
      case 1: return 'מתחיל';
      case 2: return 'מתקדם';
      case 3: return 'מקצועי';
      default: return 'לא הוגדר';
    }
  }

  getProfileTypeLabel(page: { profileType: string; isTeacher?: boolean }): string {
    if (page.profileType === 'artist') return 'אמן';
    if (page.isTeacher) return 'מורה';
    return 'נותן שירות';
  }

  getStatusLabel(status?: string | null): string {
    switch (status) {
      case 'Active': return 'פעיל';
      case 'Pending': return 'ממתין';
      case 'Suspended': return 'מושהה';
      case 'Hidden': return 'מוסתר';
      case 'Inactive': return 'לא פעיל';
      default: return status || 'לא ידוע';
    }
  }

  getPagePublicUrl(page: { profileUrl: string }): string {
    return page.profileUrl || '';
  }

  getAgencyUrl(agency: { slug: string }): string {
    return `/agency/${agency.slug}`;
  }

}
