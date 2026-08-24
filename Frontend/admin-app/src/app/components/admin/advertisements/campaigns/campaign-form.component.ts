import { Component, EventEmitter, HostListener, Input, Output, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
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
import { AdCampaignService } from '../../../../services/admin/ad-campaign.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FileUploadInputComponent } from '../../../shared/file-upload-input/file-upload-input.component';

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FileUploadInputComponent],
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.css']
})
export class CampaignFormComponent implements OnInit, OnChanges {
  @Input() campaign?: AdCampaign;
  @Input() initialClientId?: number;
  @Input() initialAdSpotId?: number;
  @Input() show = false;
  @Input() saving = false;
  @Output() save = new EventEmitter<CreateAdCampaignRequest | UpdateAdCampaignRequest>();
  @Output() cancel = new EventEmitter<void>();

  private readonly clientService = inject(ClientService);
  private readonly adSpotService = inject(AdSpotService);
  private readonly campaignService = inject(AdCampaignService);

  campaignForm!: FormGroup;
  isEditMode = false;
  clients: Client[] = [];
  adSpots: AdSpot[] = [];
  statuses = Object.values(AdCampaignStatus);

  // Availability check properties
  checkingAvailability = false;
  availabilityError: string | null = null;
  availabilityMessage: string | null = null;
  overlappingCampaigns: any[] = [];
  takenPriorities: number[] = [];
  availablePriorities: number[] = [];
  previewMode: 'desktop' | 'mobile' = 'desktop';
  previewAspectWarning = '';

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
    const defaultStartDate = this.formatDateForInput(new Date());
    const defaultEndDate = this.formatDateForInput(this.addYears(new Date(), 10));

    this.campaignForm = this.fb.group({
      name: [this.campaign?.name || '', Validators.maxLength(200)],
      adSpotId: [this.campaign?.adSpotId || this.initialAdSpotId || null, Validators.required],
      clientId: [this.campaign?.clientId || this.initialClientId || null],
      mediaUrl: [this.campaign?.mediaUrl || '', [Validators.required, Validators.maxLength(500)]],
      mobileMediaUrl: [this.campaign?.mobileMediaUrl || '', Validators.maxLength(500)],
      knownUrl: [this.campaign?.knownUrl || '', [Validators.maxLength(500), Validators.pattern(/^https?:\/\/.+/i)]],
      priority: [this.campaign?.priority || 1, [Validators.min(1), Validators.max(5)]],
      status: [this.campaign?.status || 'Draft'],
      startDate: [this.campaign?.startDate ? this.formatDateForInput(this.campaign.startDate) : defaultStartDate],
      endDate: [this.campaign?.endDate ? this.formatDateForInput(this.campaign.endDate) : defaultEndDate],
      budget: [this.campaign?.budget || 0, Validators.min(0)]
    });

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

        if (response.priorityTaken && response.availablePriorities.length > 0) {
          const nextPriority = response.availablePriorities[0];
          this.availabilityMessage = `עדיפות ${priority} תפוסה, נבחרה אוטומטית עדיפות ${nextPriority}`;
          this.campaignForm.patchValue({ priority: nextPriority });
          return;
        }

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

  private addYears(date: Date, years: number): Date {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + years);
    return d;
  }

  private getDefaultCampaignName(adSpotId: number): string {
    const spot = this.adSpots.find(item => item.id === adSpotId);
    return spot ? `פרסומת - ${spot.name}` : 'פרסומת חדשה';
  }

  get selectedAdSpot(): AdSpot | undefined {
    const adSpotId = Number(this.campaignForm?.get('adSpotId')?.value || 0);
    return this.adSpots.find(spot => spot.id === adSpotId);
  }

  get previewDimensions(): { width: number; height: number; ratio: string } | null {
    return this.parseDimensions(this.selectedAdSpot?.dimensions);
  }

  get previewMobileDimensions(): { width: number; height: number; ratio: string } | null {
    return this.parseDimensions(this.selectedAdSpot?.mobileDimensions) || this.previewDimensions;
  }

  get activePreviewDimensions(): { width: number; height: number; ratio: string } | null {
    return this.previewMode === 'mobile' ? this.previewMobileDimensions : this.previewDimensions;
  }

  private parseDimensions(dimensions: string | undefined): { width: number; height: number; ratio: string } | null {
    const value = String(dimensions || '').trim();
    const match = value.match(/^(\d+)\s*[xX*]\s*(\d+)$/);
    if (!match) return null;

    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width <= 0 || height <= 0) return null;

    return {
      width,
      height,
      ratio: `${width} / ${height}`
    };
  }

  get previewMediaUrl(): string {
    return this.campaignForm?.get('mediaUrl')?.value || '';
  }

  get activePreviewMediaUrl(): string {
    if (this.previewMode === 'mobile') {
      return this.campaignForm?.get('mobileMediaUrl')?.value || this.previewMediaUrl;
    }
    return this.previewMediaUrl;
  }

  getMediaType(url: string): 'image' | 'video' {
    const normalized = (url || '').toLowerCase().split('?')[0].split('#')[0];
    return ['.mp4', '.webm', '.ogg', '.ogv'].some(extension => normalized.endsWith(extension))
      ? 'video'
      : 'image';
  }

  setPreviewMode(mode: 'desktop' | 'mobile'): void {
    this.previewMode = mode;
    this.previewAspectWarning = '';
  }

  checkImageAspect(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    this.updateAspectWarning(image.naturalWidth, image.naturalHeight);
  }

  checkVideoAspect(event: Event): void {
    const video = event.currentTarget as HTMLVideoElement;
    this.updateAspectWarning(video.videoWidth, video.videoHeight);
  }

  private updateAspectWarning(width: number, height: number): void {
    const preview = this.activePreviewDimensions;
    if (!preview || width <= 0 || height <= 0) {
      this.previewAspectWarning = '';
      return;
    }

    const mediaRatio = width / height;
    const spotRatio = preview.width / preview.height;
    const difference = Math.abs(mediaRatio - spotRatio) / spotRatio;
    this.previewAspectWarning = difference > 0.08
      ? `מידות המדיה הן ${width}×${height}, בעוד שמידות השטח הן ${preview.width}×${preview.height}. מומלץ לשנות את מידות שטח הפרסום ל־${width}×${height}, אם זהו הגודל הקבוע המיועד לשטח.`
      : '';
  }

  onSubmit() {
    if (this.campaignForm.invalid) {
      this.campaignForm.markAllAsTouched();
      return;
    }

    if (this.campaignForm.valid) {
      const formValue = this.campaignForm.value;
      const adSpotId = Number(formValue.adSpotId);
      const clientId = formValue.clientId ? Number(formValue.clientId) : null;

      const campaignData = {
        ...formValue,
        name: (formValue.name || '').trim() || this.getDefaultCampaignName(adSpotId),
        adSpotId,
        clientId,
        startDate: new Date(formValue.startDate),
        endDate: new Date(formValue.endDate),
        mediaUrl: formValue.mediaUrl || '',
        mobileMediaUrl: formValue.mobileMediaUrl || '',
        priority: Number(formValue.priority || 1),
        status: formValue.status || 'Active',
        budget: Number(formValue.budget || 0)
      };
      this.save.emit(campaignData);
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.show && !this.saving) this.onCancel();
  }

  get f() {
    return this.campaignForm.controls;
  }
}
