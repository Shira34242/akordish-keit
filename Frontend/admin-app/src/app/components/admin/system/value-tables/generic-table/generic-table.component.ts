import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemItem } from '../../../../../services/system-tables.service';
import { SiteAlertService } from '../../../../../services/site-alert.service';
import { FileUploadInputComponent } from '../../../../shared/file-upload-input/file-upload-input.component';


@Component({
    selector: 'app-generic-table',
    standalone: true,
    imports: [CommonModule, FormsModule, FileUploadInputComponent],
    templateUrl: './generic-table.component.html',
    styleUrls: ['./generic-table.component.css']
})
export class GenericTableComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
    @Input() title: string = '';
    @Input() items: SystemItem[] = [];
    @Input() extraColumns: { key: string, label: string, type?: string }[] = [];
    @Input() searchTerm: string = '';

    @Output() add = new EventEmitter<Partial<SystemItem>>();
    @Output() edit = new EventEmitter<SystemItem>();
    @Output() delete = new EventEmitter<SystemItem>();
    @Output() search = new EventEmitter<void>();
    @Output() searchTermChange = new EventEmitter<string>();
    @Output() clearSearch = new EventEmitter<void>();

    isModalOpen = false;
    isEditing = false;
    currentItem: any = {};

    ngOnInit() { }

    openAddModal() {
        this.isEditing = false;
        this.currentItem = { name: '' };
        this.isModalOpen = true;
    }

    openEditModal(item: SystemItem) {
        this.isEditing = true;
        this.currentItem = { ...item }; // Copy
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
        this.currentItem = {};
    }

    save() {
        if (this.isEditing) {
            this.edit.emit(this.currentItem);
        } else {
            this.add.emit(this.currentItem);
        }
        this.closeModal();
    }

    async onDelete(item: SystemItem): Promise<void> {
        if (await this.siteAlerts.confirm('האם אתה בטוח שברצונך למחוק את הפריט?')) {
            this.delete.emit(item);
        }
    }

    onSearchTermChange(value: string) {
        this.searchTermChange.emit(value);
    }

    onSearch() {
        this.search.emit();
    }

    onClearSearch() {
        this.clearSearch.emit();
    }
}
