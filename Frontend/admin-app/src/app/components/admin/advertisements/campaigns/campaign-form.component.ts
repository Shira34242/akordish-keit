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
import { AdCampaignService } from '../../../../services/admin/ad-campaign.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FileUploadInputComponent } from '../../../shared/file-upload-input/file-upload-input.component';

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FileUploadInputComponent],
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.css']
})
export class CampaignFormComponent implements OnInit, OnChanges {
  @Input() campaign?: AdCampaign;
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

  onSubmit() {
    if (this.campaignForm.valid) {
      const formValue = this.campaignForm.value;
      const campaignData = {
        ...formValue,
        adSpotId: Number(formValue.adSpotId),
        clientId: Number(formValue.clientId),
        startDate: new Date(formValue.startDate),
        endDate: new Date(formValue.endDate),
        mediaUrl: formValue.mediaUrl || '',
        mobileMediaUrl: formValue.mobileMediaUrl || ''
      };
      this.save.emit(campaignData);
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  get f() {
    return this.campaignForm.controls;
  }
}
