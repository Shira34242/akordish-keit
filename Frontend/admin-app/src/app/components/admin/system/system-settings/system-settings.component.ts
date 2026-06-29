import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AgencyListDto } from '../../../../models/agency.model';
import { AgencyService } from '../../../../services/agency.service';
import {
  SiteAccessGateStatusDto,
  SystemSettingsService,
  SystemSettingDto
} from '../../../../services/system-settings.service';

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
  joinIndexCopied = false;
  joinChordsCopied = false;
  agencyJoinCopied = false;
  agencies: AgencyListDto[] = [];
  agenciesLoading = false;
  selectedAgencyId: number | null = null;

  constructor(
    private settingsService: SystemSettingsService,
    private agencyService: AgencyService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadAccessGate();
    this.loadAgencies();
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

  get joinIndexUrl(): string {
    return this.buildPublicUrl('/join-index');
  }

  get joinChordsUrl(): string {
    return this.buildPublicUrl('/join-chords');
  }

  get selectedAgency(): AgencyListDto | null {
    return this.agencies.find(agency => agency.id === Number(this.selectedAgencyId)) ?? null;
  }

  get agencyJoinIndexUrl(): string {
    const agency = this.selectedAgency;
    return agency ? this.buildPublicUrl(`/join-index/agency/${agency.slug}`) : '';
  }

  async copyJoinIndexLink(): Promise<void> {
    await this.copyLink(this.joinIndexUrl, () => this.showJoinIndexCopiedState());
  }

  async copyJoinChordsLink(): Promise<void> {
    await this.copyLink(this.joinChordsUrl, () => this.showJoinChordsCopiedState());
  }

  async copyAgencyJoinIndexLink(): Promise<void> {
    if (!this.agencyJoinIndexUrl) return;

    await this.copyLink(this.agencyJoinIndexUrl, () => this.showAgencyJoinCopiedState());
  }

  private loadAgencies(): void {
    this.agenciesLoading = true;

    this.agencyService.getAgencies(undefined, true, 1, 100).subscribe({
      next: (result) => {
        this.agencies = result.items ?? [];
        this.selectedAgencyId = this.selectedAgencyId ?? this.agencies[0]?.id ?? null;
        this.agenciesLoading = false;
      },
      error: () => {
        this.error = 'שגיאה בטעינת הסוכנויות';
        this.agenciesLoading = false;
      }
    });
  }

  private buildPublicUrl(path: string): string {
    if (typeof window === 'undefined') {
      return path;
    }

    return `${window.location.origin}${path}`;
  }

  private async copyLink(link: string, onCopied: () => void): Promise<void> {

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        this.copyWithTextarea(link);
      }

      onCopied();
    } catch {
      this.copyWithTextarea(link);
      onCopied();
    }
  }

  private showJoinIndexCopiedState(): void {
    this.joinIndexCopied = true;
    setTimeout(() => this.joinIndexCopied = false, 1800);
  }

  private showJoinChordsCopiedState(): void {
    this.joinChordsCopied = true;
    setTimeout(() => this.joinChordsCopied = false, 1800);
  }

  private showAgencyJoinCopiedState(): void {
    this.agencyJoinCopied = true;
    setTimeout(() => this.agencyJoinCopied = false, 1800);
  }

  private copyWithTextarea(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
