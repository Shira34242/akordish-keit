import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Client, CreateClientRequest, UpdateClientRequest } from '../../../../models/admin/advertisement.model';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './client-form.component.html',
  styleUrls: ['./client-form.component.css']
})
export class ClientFormComponent implements OnInit, OnChanges {
  @Input() client?: Client;
  @Input() show = false;
  @Output() save = new EventEmitter<CreateClientRequest | UpdateClientRequest>();
  @Output() cancel = new EventEmitter<void>();

  clientForm!: FormGroup;
  isEditMode = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['client'] || changes['show']) {
      this.isEditMode = !!this.client;
      if (this.show) {
        this.initForm();
      }
    }
  }

  initForm() {
    this.clientForm = this.fb.group({
      businessName: [this.client?.businessName || '', [Validators.required, Validators.maxLength(200)]],
      contactPerson: [this.client?.contactPerson || '', [Validators.required, Validators.maxLength(150)]],
      email: [this.client?.email || '', [Validators.required, Validators.email, Validators.maxLength(150)]],
      phone: [this.client?.phone || '', [Validators.required, Validators.maxLength(20)]],
      logoUrl: [this.client?.logoUrl || '', Validators.maxLength(500)],
      isActive: [this.client?.isActive ?? true]
    });
  }

  onSubmit() {
    if (this.clientForm.valid) {
      this.save.emit(this.clientForm.value);
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  get f() {
    return this.clientForm.controls;
  }
}
