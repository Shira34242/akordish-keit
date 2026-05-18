import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPermission, AdminRole, SaveAdminRole } from '../../../../models/admin-role.model';
import { AdminRoleService } from '../../../../services/admin-role.service';
import { SiteAlertService } from '../../../../services/site-alert.service';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-roles.component.html',
  styleUrls: ['./admin-roles.component.css']
})
export class AdminRolesComponent implements OnInit {
  private readonly roleService = inject(AdminRoleService);
  private readonly siteAlerts = inject(SiteAlertService);

  roles: AdminRole[] = [];
  permissions: AdminPermission[] = [];
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

  loadData(): void {
    this.loading = true;
    this.error = null;

    this.roleService.getPermissions().subscribe({
      next: permissions => {
        this.permissions = permissions;
        this.roleService.getRoles(true).subscribe({
          next: roles => {
            this.roles = roles;
            this.loading = false;
          },
          error: err => this.handleLoadError(err)
        });
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

  togglePermission(key: string): void {
    if (this.form.permissions.includes(key)) {
      this.form.permissions = this.form.permissions.filter(permission => permission !== key);
      return;
    }

    this.form.permissions = [...this.form.permissions, key];
  }

  hasPermission(key: string): boolean {
    return this.form.permissions.includes(key);
  }

  permissionsByGroup(): { group: string; items: AdminPermission[] }[] {
    const groups = new Map<string, AdminPermission[]>();
    for (const permission of this.permissions) {
      groups.set(permission.group, [...(groups.get(permission.group) || []), permission]);
    }
    return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
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

    request.subscribe({
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
      this.roleService.deleteRole(role.id).subscribe({
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

  private handleLoadError(err: unknown): void {
    console.error('שגיאה בטעינת תפקידים:', err);
    this.error = 'לא הצלחנו לטעון את התפקידים';
    this.loading = false;
  }
}
