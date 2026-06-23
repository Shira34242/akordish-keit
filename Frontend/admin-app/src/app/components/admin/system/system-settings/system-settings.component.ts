import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SiteAccessGateStatusDto,
  SystemSettingsService,
  SystemSettingDto
} from '../../../../services/system-settings.service';

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './system-settings.component.html',
  styleUrls: ['./system-settings.component.css']
})
export class SystemSettingsComponent implements OnInit {
  settings: SystemSettingDto[] = [];
  loading = false;
  savingKey: string | null = null;
  error: string | null = null;
  successKey: string | null = null;
  accessGate: SiteAccessGateStatusDto | null = null;
  accessGateDraft = {
    enabled: false,
    password: ''
  };
  accessGateSaving = false;
  accessGateSuccess = false;

  constructor(private settingsService: SystemSettingsService) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadAccessGate();
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;

    this.settingsService.getAll().subscribe({
      next: (data) => {
        this.settings = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'שגיאה בטעינת ההגדרות';
        this.loading = false;
      }
    });
  }

  loadAccessGate(): void {
    this.settingsService.getAccessGate().subscribe({
      next: (status) => {
        this.accessGate = status;
        this.accessGateDraft.enabled = status.enabled;
      },
      error: () => {
        this.error = 'שגיאה בטעינת הגדרות סיסמת הכניסה';
      }
    });
  }

  isBooleanSetting(setting: SystemSettingDto): boolean {
    return setting.value === 'true' || setting.value === 'false';
  }

  getBoolValue(setting: SystemSettingDto): boolean {
    return setting.value === 'true';
  }

  toggleSetting(setting: SystemSettingDto): void {
    const newValue = setting.value === 'true' ? 'false' : 'true';
    this.saveSetting(setting, newValue);
  }

  saveSetting(setting: SystemSettingDto, newValue?: string): void {
    const value = newValue ?? setting.value;
    this.savingKey = setting.key;
    this.successKey = null;
    this.error = null;

    this.settingsService.update(setting.key, value).subscribe({
      next: (updated) => {
        const idx = this.settings.findIndex(s => s.key === setting.key);
        if (idx !== -1) this.settings[idx] = updated;
        this.savingKey = null;
        this.successKey = setting.key;
        setTimeout(() => { this.successKey = null; }, 2500);
      },
      error: () => {
        this.error = `שגיאה בשמירת הגדרה '${setting.key}'`;
        this.savingKey = null;
      }
    });
  }

  saveAccessGate(): void {
    this.accessGateSaving = true;
    this.accessGateSuccess = false;
    this.error = null;

    const password = this.accessGateDraft.password.trim();
    this.settingsService.updateAccessGate({
      enabled: this.accessGateDraft.enabled,
      ...(password ? { password } : {})
    }).subscribe({
      next: (status) => {
        this.accessGate = status;
        this.accessGateDraft.enabled = status.enabled;
        this.accessGateDraft.password = '';
        this.accessGateSaving = false;
        this.accessGateSuccess = true;
        setTimeout(() => { this.accessGateSuccess = false; }, 2500);
        this.loadSettings();
      },
      error: (error) => {
        this.error = error?.error?.message || 'שגיאה בשמירת הגדרות סיסמת הכניסה';
        this.accessGateSaving = false;
      }
    });
  }

  shouldShowSetting(setting: SystemSettingDto): boolean {
    return ![
      'site_access_gate_enabled',
      'site_access_gate_password_hash',
      'site_access_gate_password_version'
    ].includes(setting.key);
  }

  getKeyLabel(key: string): string {
    const labels: Record<string, string> = {
      regular_user_subscriptions_enabled: 'מנויים למשתמשים רגילים (BASIC/PLUS+/PRO)'
    };
    return labels[key] ?? key;
  }
}
