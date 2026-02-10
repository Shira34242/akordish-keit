import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdSpot, CreateAdSpotRequest, UpdateAdSpotRequest } from '../../../../models/admin/advertisement.model';

@Component({
  selector: 'app-ad-spot-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ad-spot-form.component.html',
  styleUrls: ['./ad-spot-form.component.css']
})
export class AdSpotFormComponent implements OnInit, OnChanges {
  @Input() adSpot?: AdSpot;
  @Input() show = false;
  @Output() save = new EventEmitter<CreateAdSpotRequest | UpdateAdSpotRequest>();
  @Output() cancel = new EventEmitter<void>();

  adSpotForm!: FormGroup;
  isEditMode = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['adSpot'] || changes['show']) {
      this.isEditMode = !!this.adSpot;
      if (this.show) {
        this.initForm();
      }
    }
  }

  initForm() {
    this.adSpotForm = this.fb.group({
      name: [this.adSpot?.name || '', [Validators.required, Validators.maxLength(200)]],
      technicalId: [this.adSpot?.technicalId || '', [Validators.required, Validators.maxLength(100)]],
      dimensions: [this.adSpot?.dimensions || '', Validators.maxLength(50)],
      rotationIntervalMs: [this.adSpot?.rotationIntervalMs || 30000, [Validators.required, Validators.min(1000)]],
      description: [this.adSpot?.description || '', Validators.maxLength(1000)],
      isActive: [this.adSpot?.isActive ?? true]
    });
  }

  onSubmit() {
    if (this.adSpotForm.valid) {
      this.save.emit(this.adSpotForm.value);
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  get f() {
    return this.adSpotForm.controls;
  }
}
