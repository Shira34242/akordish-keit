import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AgencyContactMode,
  AgencyContentDto,
  AgencyDto,
  AgencyProfileDto,
  CreateAgencyDto,
  UpsertAgencyContentDto,
  UpsertAgencyProfileDto
} from '../../../models/agency.model';
import { AgencyService } from '../../../services/agency.service';
import { SiteAlertService } from '../../../services/site-alert.service';
import { FileUploadInputComponent } from '../../shared/file-upload-input/file-upload-input.component';

@Component({
  selector: 'app-agency-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './agency-form.component.html',
  styleUrls: ['./agency-form.component.css']
})
export class AgencyFormComponent implements OnInit {
  private readonly agencyService = inject(AgencyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(SiteAlertService);

  agencyId: number | null = null;
  agency: AgencyDto | null = null;
  loading = false;
  saving = false;
  error: string | null = null;
  AgencyContactMode = AgencyContactMode;

  form: CreateAgencyDto = {
    name: '',
    slug: '',
    logoUrl: '',
    bannerImageUrl: '',
    shortDescription: '',
    fullDescription: '',
    phoneNumber: '',
    whatsAppNumber: '',
    email: '',
    websiteUrl: '',
    brandPrimaryColor: '#ddff53',
    brandSecondaryColor: '#000000',
    brandTextColor: '#000000',
    isActive: true,
    showInIndexBanner: false,
    displayOrder: 0
  };

  profileForm: UpsertAgencyProfileDto = {
    profileType: 'artist',
    profileId: 0,
    contactMode: AgencyContactMode.Agency,
    showBadge: true,
    isFeaturedByAgency: false,
    displayOrder: 0
  };

  contentForm: UpsertAgencyContentDto = {
    contentType: 'article',
    contentId: 0,
    isFeatured: false,
    displayOrder: 0
  };

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.agencyId = id;
      this.loadAgency();
    }
  }

  loadAgency(): void {
    if (!this.agencyId) return;
    this.loading = true;
    this.agencyService.getAgency(this.agencyId).subscribe({
      next: agency => {
        this.agency = agency;
        this.form = {
          name: agency.name,
          slug: agency.slug,
          logoUrl: agency.logoUrl || '',
          bannerImageUrl: agency.bannerImageUrl || '',
          shortDescription: agency.shortDescription || '',
          fullDescription: agency.fullDescription || '',
          phoneNumber: agency.phoneNumber || '',
          whatsAppNumber: agency.whatsAppNumber || '',
          email: agency.email || '',
          websiteUrl: agency.websiteUrl || '',
          brandPrimaryColor: agency.brandPrimaryColor || '#ddff53',
          brandSecondaryColor: agency.brandSecondaryColor || '#000000',
          brandTextColor: agency.brandTextColor || '#000000',
          isActive: agency.isActive,
          showInIndexBanner: agency.showInIndexBanner,
          displayOrder: agency.displayOrder
        };
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || err?.message || 'לא הצלחנו לטעון את הסוכנות';
        this.loading = false;
      }
    });
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.error = 'שם סוכנות הוא שדה חובה';
      return;
    }

    this.saving = true;
    this.error = null;
    const payload = this.cleanAgencyPayload();
    const request = this.agencyId
      ? this.agencyService.updateAgency(this.agencyId, payload)
      : this.agencyService.createAgency(payload);

    request.subscribe({
      next: agency => {
        this.saving = false;
        this.agency = agency;
        if (!this.agencyId) {
          this.router.navigate(['/admin/users/agencies/edit', agency.id]);
        }
      },
      error: err => {
        this.error = err?.error?.message || err?.message || 'לא הצלחנו לשמור את הסוכנות';
        this.saving = false;
      }
    });
  }

  private cleanAgencyPayload(): CreateAgencyDto {
    const clean = (value?: string) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    };

    const color = (value?: string, fallback?: string) => {
      const trimmed = value?.trim();
      return /^#[0-9a-fA-F]{6}$/.test(trimmed || '') ? trimmed : fallback;
    };

    return {
      name: this.form.name.trim(),
      slug: clean(this.form.slug),
      logoUrl: clean(this.form.logoUrl),
      bannerImageUrl: clean(this.form.bannerImageUrl),
      shortDescription: clean(this.form.shortDescription),
      fullDescription: clean(this.form.fullDescription),
      phoneNumber: clean(this.form.phoneNumber),
      whatsAppNumber: clean(this.form.whatsAppNumber),
      email: clean(this.form.email),
      websiteUrl: clean(this.form.websiteUrl),
      brandPrimaryColor: color(this.form.brandPrimaryColor, '#ddff53'),
      brandSecondaryColor: color(this.form.brandSecondaryColor, '#000000'),
      brandTextColor: color(this.form.brandTextColor, '#000000'),
      isActive: this.form.isActive,
      showInIndexBanner: this.form.showInIndexBanner,
      displayOrder: Number(this.form.displayOrder) || 0
    };
  }

  addProfile(): void {
    if (!this.agencyId || !this.profileForm.profileId) return;
    this.agencyService.addProfile(this.agencyId, this.profileForm).subscribe({
      next: () => {
        this.profileForm.profileId = 0;
        this.loadAgency();
      },
      error: err => alert(err?.error?.message || 'לא הצלחנו לשייך את הפרופיל')
    });
  }

  async removeProfile(profile: AgencyProfileDto): Promise<void> {
    if (!this.agencyId || !await this.alerts.confirm('להסיר את הפרופיל מהסוכנות?')) return;
    this.agencyService.removeProfile(this.agencyId, profile.id).subscribe({
      next: () => this.loadAgency(),
      error: () => alert('לא הצלחנו להסיר את הפרופיל')
    });
  }

  addContent(): void {
    if (!this.agencyId || !this.contentForm.contentId) return;
    this.agencyService.addContent(this.agencyId, this.contentForm).subscribe({
      next: () => {
        this.contentForm.contentId = 0;
        this.loadAgency();
      },
      error: err => alert(err?.error?.message || 'לא הצלחנו לשייך את התוכן')
    });
  }

  async removeContent(content: AgencyContentDto): Promise<void> {
    if (!this.agencyId || !await this.alerts.confirm('להסיר את התוכן מהסוכנות?')) return;
    this.agencyService.removeContent(this.agencyId, content.id).subscribe({
      next: () => this.loadAgency(),
      error: () => alert('לא הצלחנו להסיר את התוכן')
    });
  }

  back(): void {
    this.router.navigate(['/admin/users/agencies']);
  }

  getContactModeLabel(mode: AgencyContactMode): string {
    if (mode === AgencyContactMode.Agency) return 'דרך הסוכנות';
    if (mode === AgencyContactMode.Both) return 'גם וגם';
    return 'ישיר';
  }
}
