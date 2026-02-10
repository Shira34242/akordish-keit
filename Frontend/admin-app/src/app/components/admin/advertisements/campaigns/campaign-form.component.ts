import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AdCampaign,
  CreateAdCampaignRequest,
  UpdateAdCampaignRequest,
  AdCampaignStatus,
  Client,
  AdSpot
} from '../../../../models/admin/advertisement.model';
import { ClientService } from '../../../../services/admin/client.service';
import { AdSpotService } from '../../../../services/admin/ad-spot.service';
import { MediaService } from '../../../../services/admin/media.service';
import { AdCampaignService } from '../../../../services/admin/ad-campaign.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.css']
})
export class CampaignFormComponent implements OnInit, OnChanges {
  @Input() campaign?: AdCampaign;
  @Input() show = false;
  @Output() save = new EventEmitter<CreateAdCampaignRequest | UpdateAdCampaignRequest>();
  @Output() cancel = new EventEmitter<void>();

  private readonly clientService = inject(ClientService);
  private readonly adSpotService = inject(AdSpotService);
  private readonly mediaService = inject(MediaService);
  private readonly campaignService = inject(AdCampaignService);

  campaignForm!: FormGroup;
  isEditMode = false;
  clients: Client[] = [];
  adSpots: AdSpot[] = [];
  statuses = Object.values(AdCampaignStatus);

  // File upload properties
  mediaFile: File | null = null;
  mobileMediaFile: File | null = null;
  mediaPreviewUrl: string | null = null;
  mobileMediaPreviewUrl: string | null = null;
  uploadingMedia = false;
  uploadingMobileMedia = false;

  // Availability check properties
  checkingAvailability = false;
  availabilityError: string | null = null;
  availabilityMessage: string | null = null;
  overlappingCampaigns: any[] = [];
  takenPriorities: number[] = [];
  availablePriorities: number[] = [];

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.loadClients();
    this.loadAdSpots();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['campaign'] || changes['show']) {
      this.isEditMode = !!this.campaign;
      if (this.show) {
        this.initForm();
      }
    }
  }

  loadClients() {
    this.clientService.getClients(1, 100).subscribe({
      next: (data) => {
        this.clients = data.items;
      },
      error: (error) => {
        console.error('Error loading clients:', error);
      }
    });
  }

  loadAdSpots() {
    this.adSpotService.getAdSpots(1, 100).subscribe({
      next: (data) => {
        this.adSpots = data.items;
      },
      error: (error) => {
        console.error('Error loading ad spots:', error);
      }
    });
  }

  initForm() {
    this.campaignForm = this.fb.group({
      name: [this.campaign?.name || '', [Validators.required, Validators.maxLength(200)]],
      adSpotId: [this.campaign?.adSpotId || null, Validators.required],
      clientId: [this.campaign?.clientId || null, Validators.required],
      mediaUrl: [this.campaign?.mediaUrl || '', Validators.maxLength(500)],
      mobileMediaUrl: [this.campaign?.mobileMediaUrl || '', Validators.maxLength(500)],
      knownUrl: [this.campaign?.knownUrl || '', Validators.maxLength(500)],
      priority: [this.campaign?.priority || 0, [Validators.required, Validators.min(0)]],
      status: [this.campaign?.status || 'Draft', Validators.required],
      startDate: [this.campaign?.startDate ? this.formatDateForInput(this.campaign.startDate) : '', Validators.required],
      endDate: [this.campaign?.endDate ? this.formatDateForInput(this.campaign.endDate) : '', Validators.required],
      budget: [this.campaign?.budget || 0, [Validators.required, Validators.min(0)]]
    });

    // Set preview URLs if editing existing campaign
    if (this.campaign?.mediaUrl) {
      this.mediaPreviewUrl = this.campaign.mediaUrl;
    }
    if (this.campaign?.mobileMediaUrl) {
      this.mobileMediaPreviewUrl = this.campaign.mobileMediaUrl;
    }

    // Watch for changes in adSpotId, startDate, endDate, or priority to check availability
    this.campaignForm.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged((prev, curr) => {
          return prev.adSpotId === curr.adSpotId &&
                 prev.startDate === curr.startDate &&
                 prev.endDate === curr.endDate &&
                 prev.priority === curr.priority;
        })
      )
      .subscribe(() => {
        this.checkAvailability();
      });
  }

  checkAvailability() {
    const adSpotId = this.campaignForm.get('adSpotId')?.value;
    const startDate = this.campaignForm.get('startDate')?.value;
    const endDate = this.campaignForm.get('endDate')?.value;
    const priority = this.campaignForm.get('priority')?.value;

    // Reset messages
    this.availabilityError = null;
    this.availabilityMessage = null;
    this.overlappingCampaigns = [];
    this.takenPriorities = [];
    this.availablePriorities = [];

    // Only check if all required fields are filled
    if (!adSpotId || !startDate || !endDate || priority === null || priority === undefined) {
      return;
    }

    // Validate that endDate is after startDate
    if (new Date(endDate) <= new Date(startDate)) {
      this.availabilityError = 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה';
      return;
    }

    // Validate priority is between 1-5
    if (priority < 1 || priority > 5) {
      this.availabilityError = 'עדיפות חייבת להיות בין 1 ל-5';
      return;
    }

    this.checkingAvailability = true;

    this.campaignService.checkAvailability(
      Number(adSpotId),
      new Date(startDate),
      new Date(endDate),
      Number(priority),
      this.campaign?.id
    ).subscribe({
      next: (response) => {
        this.checkingAvailability = false;
        this.overlappingCampaigns = response.overlappingCampaigns;
        this.takenPriorities = response.takenPriorities;
        this.availablePriorities = response.availablePriorities;

        if (response.maxCampaignsReached) {
          this.availabilityError = `הגעת למקסימום של 5 קמפיינים באותו שטח בטווח תאריכים זה`;
        } else if (response.priorityTaken) {
          this.availabilityError = `עדיפות ${priority} כבר תפוסה בטווח תאריכים זה. עדיפויות פנויות: ${response.availablePriorities.join(', ')}`;
        } else if (response.overlappingCampaigns.length > 0) {
          const count = response.overlappingCampaigns.length;
          this.availabilityMessage = `יש ${count} קמפיינים נוספים באותו שטח (עדיפויות תפוסות: ${response.takenPriorities.join(', ')})`;
        } else {
          this.availabilityMessage = 'שטח הפרסום זמין עבור עדיפות זו';
        }
      },
      error: (error) => {
        this.checkingAvailability = false;
        console.error('Error checking availability:', error);
      }
    });
  }

  formatDateForInput(date: Date): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  onMediaFileSelected(event: Event, isMobile: boolean = false) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
      if (!allowedTypes.includes(file.type)) {
        alert('סוג קובץ לא נתמך. יש להעלות תמונה (JPG, PNG, GIF, WEBP) או וידאו (MP4, WEBM)');
        input.value = '';
        return;
      }

      // Validate file size (10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('גודל הקובץ חורג מ-10MB');
        input.value = '';
        return;
      }

      if (isMobile) {
        this.mobileMediaFile = file;
        this.createPreviewUrl(file, true);
      } else {
        this.mediaFile = file;
        this.createPreviewUrl(file, false);
      }
    }
  }

  createPreviewUrl(file: File, isMobile: boolean) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      if (isMobile) {
        this.mobileMediaPreviewUrl = e.target.result;
      } else {
        this.mediaPreviewUrl = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  }

  removeMedia(isMobile: boolean = false) {
    if (isMobile) {
      this.mobileMediaFile = null;
      this.mobileMediaPreviewUrl = null;
      this.campaignForm.patchValue({ mobileMediaUrl: '' });
    } else {
      this.mediaFile = null;
      this.mediaPreviewUrl = null;
      this.campaignForm.patchValue({ mediaUrl: '' });
    }
  }

  getMediaType(url: string | null): 'image' | 'video' | null {
    if (!url) return null;
    const videoExtensions = ['.mp4', '.webm'];
    const isVideo = videoExtensions.some(ext => url.toLowerCase().includes(ext));
    return isVideo ? 'video' : 'image';
  }

  async uploadFiles(): Promise<{ mediaUrl?: string, mobileMediaUrl?: string }> {
    const urls: { mediaUrl?: string, mobileMediaUrl?: string } = {};

    if (this.mediaFile) {
      this.uploadingMedia = true;
      try {
        const response = await this.mediaService.uploadMedia(this.mediaFile).toPromise();
        if (response?.url) {
          urls.mediaUrl = response.url;
        }
      } catch (error) {
        console.error('Error uploading media:', error);
        alert('שגיאה בהעלאת קובץ מדיה');
        throw error;
      } finally {
        this.uploadingMedia = false;
      }
    }

    if (this.mobileMediaFile) {
      this.uploadingMobileMedia = true;
      try {
        const response = await this.mediaService.uploadMedia(this.mobileMediaFile).toPromise();
        if (response?.url) {
          urls.mobileMediaUrl = response.url;
        }
      } catch (error) {
        console.error('Error uploading mobile media:', error);
        alert('שגיאה בהעלאת קובץ מדיה למובייל');
        throw error;
      } finally {
        this.uploadingMobileMedia = false;
      }
    }

    return urls;
  }

  async onSubmit() {
    if (this.campaignForm.valid) {
      try {
        // Upload files first if any
        const uploadedUrls = await this.uploadFiles();

        const formValue = this.campaignForm.value;

        // Use uploaded URLs or existing URLs from form
        const mediaUrl = uploadedUrls.mediaUrl || formValue.mediaUrl || '';
        const mobileMediaUrl = uploadedUrls.mobileMediaUrl || formValue.mobileMediaUrl || '';

        // Convert string dates to Date objects and ensure IDs are numbers
        const campaignData = {
          ...formValue,
          adSpotId: Number(formValue.adSpotId),
          clientId: Number(formValue.clientId),
          startDate: new Date(formValue.startDate),
          endDate: new Date(formValue.endDate),
          mediaUrl,
          mobileMediaUrl
        };

        this.save.emit(campaignData);
      } catch (error) {
        console.error('Error in form submission:', error);
      }
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  get f() {
    return this.campaignForm.controls;
  }
}
