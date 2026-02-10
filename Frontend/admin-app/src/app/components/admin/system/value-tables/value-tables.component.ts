import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemTablesService, SystemItem, PagedResult } from '../../../../services/system-tables.service';
import { GenericTableComponent } from './generic-table/generic-table.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { HttpClient } from '@angular/common/http';

interface TableDefinition {
    id: string;
    label: string;
    extraColumns?: { key: string, label: string, type?: string }[];
}

@Component({
    selector: 'app-value-tables',
    standalone: true,
    imports: [CommonModule, FormsModule, GenericTableComponent, PaginationComponent],
    templateUrl: './value-tables.component.html',
    styleUrls: ['./value-tables.component.css']
})
export class ValueTablesComponent implements OnInit {
    tables: TableDefinition[] = [
        { id: 'genres', label: 'ז׳אנרים' },
        { id: 'tags', label: 'תגיות שירים' },
        { id: 'article-categories', label: 'קטגוריות בחדשות מוזיקה ותוכן' },
        { id: 'instruments', label: 'כלים נגינה', extraColumns: [{ key: 'englishName', label: 'שם באנגלית' }] },
        {
            id: 'music-service-provider-categories',
            label: 'קטגוריות נותני שירות ומורים',
            extraColumns: [
                { key: 'description', label: 'תיאור', type: 'textarea' },
                { key: 'isActive', label: 'פעיל', type: 'boolean' }
            ]
        }
    ];

    currentTable: TableDefinition | null = null;
    items: SystemItem[] = [];
    isLoading = false;

    // Pagination
    totalCount = 0;
    pageNumber = 1;
    pageSize = 5;
    totalPages = 0;
    hasPreviousPage = false;
    hasNextPage = false;

    // Search
    searchTerm = '';

    constructor(private systemService: SystemTablesService) { }

    ngOnInit() {
        // Select first by default? User said "Clicking value tables will bring ALL table types... [implying a list]"
        // But also "When I click value tables... it brings all table types...".
        // Maybe default to select none, or first.
        // Let's select none as implemented above.
    }

    selectTable(table: TableDefinition) {
        this.currentTable = table;
        this.pageNumber = 1; // Reset to first page when changing table
        this.searchTerm = ''; // Reset search when changing table
        this.loadItems();
    }

    loadItems() {
        if (!this.currentTable) return;
        this.isLoading = true;
        this.systemService.getItems(this.currentTable.id, this.pageNumber, this.pageSize, this.searchTerm).subscribe({
            next: (data: PagedResult<SystemItem>) => {
                this.items = data.items;
                this.totalCount = data.totalCount;
                this.pageNumber = data.pageNumber;
                this.pageSize = data.pageSize;
                this.totalPages = data.totalPages;
                this.hasPreviousPage = data.hasPreviousPage;
                this.hasNextPage = data.hasNextPage;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Failed to load items', err);
                this.isLoading = false;
            }
        });
    }

    onSearch() {
        this.pageNumber = 1; // Reset to first page when searching
        this.loadItems();
    }

    onClearSearch() {
        this.searchTerm = '';
        this.pageNumber = 1;
        this.loadItems();
    }

    onPageChange(page: number) {
        this.pageNumber = page;
        this.loadItems();
    }

    onPageSizeChange(pageSize: number) {
        this.pageSize = pageSize;
        this.pageNumber = 1; // Reset to first page when changing page size
        this.loadItems();
    }

    onAdd(item: Partial<SystemItem>) {
        if (!this.currentTable) return;
        // Remove id from item when adding
        const { id, ...itemWithoutId } = item;
        this.systemService.addItem(this.currentTable.id, itemWithoutId).subscribe({
            next: () => this.loadItems(),
            error: (err) => console.error(err)
        });
    }

    onEdit(item: SystemItem) {
        if (!this.currentTable) return;
        // Send only the data fields, not the id
        const { id, ...itemData } = item;
        this.systemService.updateItem(this.currentTable.id, id, itemData).subscribe({
            next: () => this.loadItems(),
            error: (err) => console.error(err)
        });
    }

    onDelete(item: SystemItem) {
        if (!this.currentTable) return;
        this.systemService.deleteItem(this.currentTable.id, item.id).subscribe({
            next: () => this.loadItems(),
            error: (err) => {
                console.error(err);
                alert('לא ניתן למחוק פריט זה (ייתכן שהוא בשימוש)');
            }
        });
    }
}
