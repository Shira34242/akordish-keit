import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ClientService } from '../../../../services/admin/client.service';
import { Client, CreateClientRequest, UpdateClientRequest } from '../../../../models/admin/advertisement.model';
import { PagedResult } from '../../../../models/pagination.model';
import { ClientFormComponent } from './client-form.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { SiteAlertService } from '../../../../services/site-alert.service';


@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ClientFormComponent, PaginationComponent],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.css']
})
export class ClientsListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly clientService = inject(ClientService);
  private readonly router = inject(Router);

  clients: Client[] = [];
  filteredClients: Client[] = [];
  loading = false;
  saving = false;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-clients-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-clients-view', mode); }
  searchTerm = '';
  sortBy = 'created_desc';
  activeTab: 'campaigns' | 'spots' | 'clients' = 'clients';

  sortOptions = [
    { value: 'created_desc', label: 'חדש לישן' },
    { value: 'created_asc', label: 'ישן לחדש' },
    { value: 'name_asc', label: 'א-ת' },
    { value: 'name_desc', label: 'ת-א' }
  ];

  // Pagination
  totalCount = 0;
  pageNumber = 1;
  pageSize = 25;
  totalPages = 0;
  hasPreviousPage = false;
  hasNextPage = false;

  showClientForm = false;
  selectedClient?: Client;

  ngOnInit() {
    this.loadClients();
  }

  loadClients() {
    this.loading = true;
    this.clientService.getClients(this.pageNumber, this.pageSize, this.sortBy).subscribe({
      next: (data: PagedResult<Client>) => {
        this.clients = data.items;
        this.filteredClients = data.items;
        this.totalCount = data.totalCount;
        this.totalPages = data.totalPages;
        this.hasPreviousPage = data.hasPreviousPage;
        this.hasNextPage = data.hasNextPage;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading clients:', error);
        this.loading = false;
      }
    });
  }

  async onPageChange(page: number): Promise<void> {
    this.pageNumber = page;
    this.loadClients();
  }

  onSearch() {
    if (!this.searchTerm.trim()) {
      this.filteredClients = this.clients;
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredClients = this.clients.filter(client =>
      client.businessName.toLowerCase().includes(term) ||
      client.contactPerson.toLowerCase().includes(term) ||
      client.email.toLowerCase().includes(term)
    );
  }

  onSortChange() {
    this.pageNumber = 1;
    this.loadClients();
  }

  formatCurrency(amount: number): string {
    return `₪${amount.toLocaleString('he-IL')}`;
  }

  createNewClient() {
    this.selectedClient = undefined;
    this.showClientForm = true;
  }

  editClient(client: Client) {
    this.selectedClient = client;
    this.showClientForm = true;
  }

  onSaveClient(clientData: CreateClientRequest | UpdateClientRequest) {
    this.saving = true;
    if (this.selectedClient) {
      this.clientService.updateClient(this.selectedClient.id, clientData as UpdateClientRequest).subscribe({
        next: () => {
          this.saving = false;
          this.showClientForm = false;
          this.loadClients();
        },
        error: (error) => {
          this.saving = false;
          console.error('Error updating client:', error);
          this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
        }
      });
    } else {
      this.clientService.createClient(clientData as CreateClientRequest).subscribe({
        next: () => {
          this.saving = false;
          this.showClientForm = false;
          this.loadClients();
        },
        error: (error) => {
          this.saving = false;
          console.error('Error creating client:', error);
          this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
        }
      });
    }
  }

  onCancelClientForm() {
    this.showClientForm = false;
    this.selectedClient = undefined;
  }

  async deleteClient(client: Client): Promise<void> {
    if (!(await this.siteAlerts.confirm(`האם אתה בטוח שברצונך למחוק את הלקוח "${client.businessName}"?`))) {
      return;
    }

    this.clientService.deleteClient(client.id).subscribe({
      next: () => {
        this.loadClients();
      },
      error: (error) => {
        console.error('Error deleting client:', error);
        this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
      }
    });
  }

  switchTab(tab: 'campaigns' | 'spots' | 'clients') {
    this.activeTab = tab;
    if (tab === 'campaigns') {
      this.router.navigate(['/admin/advertising']);
    } else if (tab === 'spots') {
      this.router.navigate(['/admin/advertising/spots']);
    }
  }
}
