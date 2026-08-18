import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AgencyListDto } from '../../../../models/agency.model';
import { AgencyService } from '../../../../services/agency.service';
import { MediaService } from '../../../../services/admin/media.service';
import { forkJoin } from 'rxjs';
import { SystemSettingsService, SystemSettingDto } from '../../../../services/system-settings.service';

interface BannerImageSetting {
  key: string;
  label: string;
  description: string;
  value: string;
  saving: boolean;
  uploading: boolean;
  success: boolean;
  displayMode: 'cover' | 'height';
  desktopZoom: number;
  mobileZoom: number;
  position: 'left' | 'center' | 'right';
}

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
  joinIndexCopied = false;
  joinChordsCopied = false;
  agencyJoinCopied = false;
  agencies: AgencyListDto[] = [];
  agenciesLoading = false;
  selectedAgencyId: number | null = null;
  bannerImages: BannerImageSetting[] = [
    { key: 'banner_home_hero_image', label: 'דף הבית — באנר ראשי', description: 'התמונה שבתיבה הראשית הצהובה.', value: '', saving: false, uploading: false, success: false, displayMode: 'cover', desktopZoom: 100, mobileZoom: 100, position: 'center' },
    { key: 'banner_home_chords_image', label: 'דף הבית — קידום אקורדים', description: 'תמונת באנר הקידום של האקורדים.', value: '', saving: false, uploading: false, success: false, displayMode: 'height', desktopZoom: 100, mobileZoom: 100, position: 'left' },
    { key: 'banner_home_index_image', label: 'דף הבית — קידום אינדקס', description: 'תמונת באנר הקידום של אינדקס עולם המוזיקה.', value: '', saving: false, uploading: false, success: false, displayMode: 'height', desktopZoom: 100, mobileZoom: 100, position: 'left' },
    { key: 'banner_home_podcasts_image', label: 'דף הבית — קידום פודקאסטים', description: 'תמונת באנר הקידום של הפודקאסטים.', value: '', saving: false, uploading: false, success: false, displayMode: 'height', desktopZoom: 100, mobileZoom: 100, position: 'left' },
    { key: 'banner_chords_hero_image', label: 'עמוד אקורדים — באנר ראשי', description: 'התמונה העליונה של עמוד האקורדים.', value: '', saving: false, uploading: false, success: false, displayMode: 'cover', desktopZoom: 100, mobileZoom: 100, position: 'center' },
    { key: 'banner_podcasts_hero_image', label: 'עמוד פודקאסטים — באנר ראשי', description: 'התמונה העליונה של עמוד הפודקאסטים.', value: '', saving: false, uploading: false, success: false, displayMode: 'cover', desktopZoom: 100, mobileZoom: 100, position: 'center' },
    { key: 'banner_music_index_hero_image', label: 'אינדקס עולם המוזיקה — באנר ראשי', description: 'התמונה העליונה של עמוד אינדקס עולם המוזיקה.', value: '', saving: false, uploading: false, success: false, displayMode: 'cover', desktopZoom: 100, mobileZoom: 100, position: 'center' }
  ];

  constructor(
    private settingsService: SystemSettingsService,
    private agencyService: AgencyService,
    private mediaService: MediaService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadAgencies();
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;

    this.settingsService.getAll().subscribe({
      next: (data) => {
        this.settings = data;
        this.bannerImages.forEach(banner => {
          banner.value = data.find(setting => setting.key === banner.key)?.value || '';
          banner.displayMode = data.find(setting => setting.key === `${banner.key}_display_mode`)?.value === 'height' ? 'height' : 'cover';
          banner.desktopZoom = Number(data.find(setting => setting.key === `${banner.key}_desktop_zoom`)?.value) || 100;
          banner.mobileZoom = Number(data.find(setting => setting.key === `${banner.key}_mobile_zoom`)?.value) || 100;
          const position = data.find(setting => setting.key === `${banner.key}_position`)?.value;
          banner.position = position === 'left' || position === 'right' ? position : 'center';
        });
        this.loading = false;
      },
      error: () => {
        this.error = 'שגיאה בטעינת ההגדרות';
        this.loading = false;
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

  saveBannerImage(banner: BannerImageSetting): void {
    banner.saving = true;
    banner.success = false;
    this.error = null;

    forkJoin([
      this.settingsService.update(banner.key, banner.value.trim()),
      this.settingsService.update(`${banner.key}_display_mode`, banner.displayMode),
      this.settingsService.update(`${banner.key}_desktop_zoom`, String(banner.desktopZoom)),
      this.settingsService.update(`${banner.key}_mobile_zoom`, String(banner.mobileZoom)),
      this.settingsService.update(`${banner.key}_position`, banner.position)
    ]).subscribe({
      next: ([updated]) => {
        const index = this.settings.findIndex(setting => setting.key === banner.key);
        if (index >= 0) this.settings[index] = updated;
        else this.settings.push(updated);
        banner.value = updated.value;
        banner.saving = false;
        banner.success = true;
        setTimeout(() => banner.success = false, 2500);
      },
      error: () => {
        banner.saving = false;
        this.error = `שגיאה בשמירת התמונה עבור ${banner.label}`;
      }
    });
  }

  removeBannerImage(banner: BannerImageSetting): void {
    banner.value = '';
    this.saveBannerImage(banner);
  }

  uploadBannerImage(event: Event, banner: BannerImageSetting): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    banner.uploading = true;
    banner.success = false;
    this.error = null;
    this.mediaService.uploadMedia(file).subscribe({
      next: response => {
        banner.value = response.url;
        banner.uploading = false;
        this.saveBannerImage(banner);
        input.value = '';
      },
      error: () => {
        banner.uploading = false;
        this.error = `שגיאה בהעלאת התמונה עבור ${banner.label}`;
        input.value = '';
      }
    });
  }

  shouldShowSetting(setting: SystemSettingDto): boolean {
    return !this.bannerImages.some(banner => setting.key === banner.key || setting.key.startsWith(`${banner.key}_`)) && ![
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
