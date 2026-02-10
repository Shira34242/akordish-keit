import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ClientService } from '../../../../services/admin/client.service';
import { Client, CreateClientRequest, UpdateClientRequest } from '../../../../models/admin/advertisement.model';
import { PagedResult } from '../../../../models/pagination.model';
import { ClientFormComponent } from './client-form.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ClientFormComponent, PaginationComponent],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.css']
})
export class ClientsListComponent implements OnInit {
  private readonly clientService = inject(ClientService);
  private readonly router = inject(Router);

  clients: Client[] = [];
  filteredClients: Client[] = [];
  loading = false;
  searchTerm = '';
  activeTab: 'campaigns' | 'spots' | 'clients' = 'clients';

  // Pagination
  totalCount = 0;
  pageNumber = 1;
  pageSize = 10;
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
    this.clientService.getClients(this.pageNumber, this.pageSize).subscribe({
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

  onPageChange(page: number): void {
    this.pageNumber = page;
    this.loadClients();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageNumber = 1;
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
    if (this.selectedClient) {
      // Edit mode
      this.clientService.updateClient(this.selectedClient.id, clientData as UpdateClientRequest).subscribe({
        next: () => {
          this.showClientForm = false;
          this.loadClients();
        },
        error: (error) => {
          console.error('Error updating client:', error);
          alert('שגיאה בעדכון הלקוח');
        }
      });
    } else {
      // Create mode
      this.clientService.createClient(clientData as CreateClientRequest).subscribe({
        next: () => {
          this.showClientForm = false;
          this.loadClients();
        },
        error: (error) => {
          console.error('Error creating client:', error);
          alert('שגיאה ביצירת הלקוח');
        }
      });
    }
  }

  onCancelClientForm() {
    this.showClientForm = false;
    this.selectedClient = undefined;
  }

  deleteClient(client: Client) {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הלקוח "${client.businessName}"?`)) {
      return;
    }

    this.clientService.deleteClient(client.id).subscribe({
      next: () => {
        this.loadClients();
      },
      error: (error) => {
        console.error('Error deleting client:', error);
        alert('שגיאה במחיקת הלקוח. ייתכן שיש לו קמפיינים פעילים.');
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
