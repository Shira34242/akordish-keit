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
export class GenericTableComponent implements OnInit, OnChanges {
  private readonly siteAlerts = inject(SiteAlertService);
    @Input() title: string = '';
    @Input() items: SystemItem[] = [];
    @Input() extraColumns: { key: string, label: string, type?: string, options?: { value: number | string, label: string }[], defaultValue?: any }[] = [];
    @Input() searchTerm: string = '';

    @Output() add = new EventEmitter<Partial<SystemItem>>();
    @Output() edit = new EventEmitter<SystemItem>();
    @Output() delete = new EventEmitter<SystemItem>();
    @Output() bulkDelete = new EventEmitter<number[]>();
    @Output() search = new EventEmitter<void>();
    @Output() searchTermChange = new EventEmitter<string>();
    @Output() clearSearch = new EventEmitter<void>();

    isModalOpen = false;
    isEditing = false;
    currentItem: any = {};

    selectedIds = new Set<number>();

    ngOnInit() { }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['items']) {
            const validIds = new Set(this.items.map(i => i.id));
            for (const id of Array.from(this.selectedIds)) {
                if (!validIds.has(id)) this.selectedIds.delete(id);
            }
        }
    }

    isSelected(item: SystemItem): boolean {
        return this.selectedIds.has(item.id);
    }

    toggleSelection(item: SystemItem): void {
        if (this.selectedIds.has(item.id)) {
            this.selectedIds.delete(item.id);
        } else {
            this.selectedIds.add(item.id);
        }
    }

    get isAllSelected(): boolean {
        return this.items.length > 0 && this.items.every(i => this.selectedIds.has(i.id));
    }

    get isSomeSelected(): boolean {
        return this.selectedIds.size > 0 && !this.isAllSelected;
    }

    toggleSelectAll(): void {
        if (this.isAllSelected) {
            this.items.forEach(i => this.selectedIds.delete(i.id));
        } else {
            this.items.forEach(i => this.selectedIds.add(i.id));
        }
    }

    async onBulkDelete(): Promise<void> {
        if (this.selectedIds.size === 0) return;
        const count = this.selectedIds.size;
        if (await this.siteAlerts.confirm(`האם למחוק ${count} פריטים שנבחרו?`)) {
            this.bulkDelete.emit(Array.from(this.selectedIds));
            this.selectedIds.clear();
        }
    }

    openAddModal() {
        this.isEditing = false;
        const initial: any = { name: '' };
        for (const col of this.extraColumns) {
            if (col.defaultValue !== undefined) initial[col.key] = col.defaultValue;
        }
        this.currentItem = initial;
        this.isModalOpen = true;
    }

    getOptionLabel(col: { options?: { value: number | string, label: string }[] }, value: any): string {
        if (!col.options) return String(value ?? '');
        const found = col.options.find(o => o.value === value);
        return found ? found.label : String(value ?? '');
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
