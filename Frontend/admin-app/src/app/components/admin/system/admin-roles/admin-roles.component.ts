import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { AdminPermission, AdminRole, SaveAdminRole } from '../../../../models/admin-role.model';
import { AdminRoleService } from '../../../../services/admin-role.service';
import { SiteAlertService } from '../../../../services/site-alert.service';

export interface PermissionGroup {
  group: string;
  items: AdminPermission[];
}

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-roles.component.html',
  styleUrls: ['./admin-roles.component.css']
})
export class AdminRolesComponent implements OnInit, OnDestroy {
  private readonly roleService = inject(AdminRoleService);
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly destroy$ = new Subject<void>();

  roles: AdminRole[] = [];
  permissions: AdminPermission[] = [];
  permissionGroups: PermissionGroup[] = [];
  selectedRole: AdminRole | null = null;
  loading = false;
  saving = false;
  error: string | null = null;

  form: SaveAdminRole = {
    name: '',
    description: '',
    isActive: true,
    permissions: ['admin.access']
  };

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      permissions: this.roleService.getPermissions(),
      roles: this.roleService.getRoles(true)
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ permissions, roles }) => {
        this.permissions = permissions;
        this.roles = roles;
        this.buildPermissionGroups();
        this.loading = false;
      },
      error: err => this.handleLoadError(err)
    });
  }

  startNew(): void {
    this.selectedRole = null;
    this.error = null;
    this.form = {
      name: '',
      description: '',
      isActive: true,
      permissions: ['admin.access']
    };
  }

  editRole(role: AdminRole): void {
    this.selectedRole = role;
    this.error = null;
    this.form = {
      name: role.name,
      description: role.description || '',
      isActive: role.isActive,
      permissions: [...role.permissions]
    };
  }

  togglePermission(key: string, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    const idx = this.form.permissions.indexOf(key);
    if (idx !== -1) {
      this.form.permissions = [
        ...this.form.permissions.slice(0, idx),
        ...this.form.permissions.slice(idx + 1)
      ];
      return;
    }

    this.form.permissions = [...this.form.permissions, key];
  }

  hasPermission(key: string): boolean {
    return this.form.permissions.includes(key);
  }

  saveRole(): void {
    if (!this.form.name.trim()) {
      this.error = 'שם תפקיד הוא שדה חובה';
      return;
    }

    this.saving = true;
    this.error = null;
    const request = this.selectedRole
      ? this.roleService.updateRole(this.selectedRole.id, this.form)
      : this.roleService.createRole(this.form);

    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving = false;
        this.startNew();
        this.loadData();
      },
      error: err => {
        console.error('שגיאה בשמירת תפקיד:', err);
        this.error = 'לא הצלחנו לשמור את התפקיד';
        this.saving = false;
      }
    });
  }

  async deleteRole(role: AdminRole): Promise<void> {
    if (role.isSystem) return;

    if (await this.siteAlerts.confirm(`למחוק את התפקיד "${role.name}"? משתמשים שמשויכים אליו יחזרו לחבר רגיל.`)) {
      this.roleService.deleteRole(role.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          if (this.selectedRole?.id === role.id) this.startNew();
          this.loadData();
        },
        error: err => {
          console.error('שגיאה במחיקת תפקיד:', err);
          this.error = 'לא הצלחנו למחוק את התפקיד';
        }
      });
    }
  }

  trackByRoleId(_index: number, role: AdminRole): number {
    return role.id;
  }

  trackByGroupKey(_index: number, group: PermissionGroup): string {
    return group.group;
  }

  trackByPermissionKey(_index: number, permission: AdminPermission): string {
    return permission.key;
  }

  private buildPermissionGroups(): void {
    const descriptions: Record<string, string> = {
      'admin.access': 'גישה ללוח הבקרה',
      'users.manage': 'צפייה, עריכה ומחיקת משתמשים',
      'content.manage': 'ניהול מלא של כל התוכן',
      'content.songs': 'הוספה, עריכה ומחיקת אקורדים',
      'content.articles': 'כתיבה, עריכה ומחיקת כתבות',
      'content.events': 'יצירה ועדכון של אירועים',
      'content.podcasts': 'ניהול פודקאסטים באתר',
      'analytics.view': 'צפייה בסטטיסטיקות ונתונים',
      'advertising.manage': 'ניהול פרסומות באתר',
      'notifications.manage': 'שליחת התראות ודיוורים',
      'reports.manage': 'צפייה וטיפול בדיווחים',
      'system.manage': 'עריכת הגדרות המערכת',
      'roles.manage': 'יצירה ועריכה של תפקידים והרשאות'
    };

    const groups = new Map<string, AdminPermission[]>();
    for (const permission of this.permissions) {
      permission.description = descriptions[permission.key] ?? '';
      const items = groups.get(permission.group) || [];
      items.push(permission);
      groups.set(permission.group, items);
    }
    this.permissionGroups = Array.from(groups.entries())
      .map(([group, items]) => ({ group, items }));
  }

  private handleLoadError(err: unknown): void {
    console.error('שגיאה בטעינת תפקידים:', err);
    this.error = 'לא הצלחנו לטעון את התפקידים';
    this.loading = false;
  }
}
