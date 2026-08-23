import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Client,
  CreateClientRequest,
  UpdateClientRequest
} from '../../models/admin/advertisement.model';
import { PagedResult } from '../../models/pagination.model';

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/Clients`;

  /**
   * Get all clients with pagination
   */
  getClients(pageNumber: number = 1, pageSize: number = 10, sortBy?: string, searchTerm?: string): Observable<PagedResult<Client>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (sortBy) params = params.set('sortBy', sortBy);
    if (searchTerm?.trim()) params = params.set('searchTerm', searchTerm.trim());

    return this.http.get<PagedResult<Client>>(this.apiUrl, { params });
  }

  /**
   * Get client by ID
   */
  getClient(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create new client
   */
  createClient(client: CreateClientRequest): Observable<Client> {
    return this.http.post<Client>(this.apiUrl, client);
  }

  /**
   * Update existing client
   */
  updateClient(id: number, client: UpdateClientRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, client);
  }

  /**
   * Delete client
   */
  deleteClient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
