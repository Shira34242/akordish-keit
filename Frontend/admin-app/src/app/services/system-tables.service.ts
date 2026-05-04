import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SystemItem {
    id: number;
    name: string;
    [key: string]: any;
}

export interface PagedResult<T> {
    items: T[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class SystemTablesService {
    private apiUrl = `${window.location.hostname === 'localhost' ? `${environment.apiBaseUrl}` : ''}/api`;

    constructor(private http: HttpClient) { }

    // Helpers to map "tableName" to "endpoint"
    private getEndpoint(tableName: string): string {
        switch (tableName) {
            case 'genres': return 'Genres';
            case 'tags': return 'Tags';
            case 'instruments': return 'Instruments';
            case 'article-categories': return 'ArticleCategories';
            case 'music-service-provider-categories': return 'MusicServiceProviderCategories';
            default: throw new Error('Unknown table');
        }
    }

    getItems(tableName: string, pageNumber: number = 1, pageSize: number = 25, search?: string): Observable<PagedResult<SystemItem>> {
        let params = new HttpParams()
            .set('pageNumber', pageNumber.toString())
            .set('pageSize', pageSize.toString());

        if (search && search.trim()) {
            params = params.set('search', search.trim());
        }

        return this.http.get<PagedResult<SystemItem>>(`${this.apiUrl}/${this.getEndpoint(tableName)}`, { params });
    }

    addItem(tableName: string, item: Partial<SystemItem>): Observable<SystemItem> {
        return this.http.post<SystemItem>(`${this.apiUrl}/${this.getEndpoint(tableName)}`, item);
    }

    updateItem(tableName: string, id: number, item: Partial<SystemItem>): Observable<any> {
        return this.http.put(`${this.apiUrl}/${this.getEndpoint(tableName)}/${id}`, item);
    }

    deleteItem(tableName: string, id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/${this.getEndpoint(tableName)}/${id}`);
    }

    deleteMany(tableName: string, ids: number[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/${this.getEndpoint(tableName)}/bulk-delete`, { ids });
    }

    // -------- Tag-specific helpers (for the article form) --------

    getPopularTags(limit: number = 20): Observable<SystemItem[]> {
        return this.http.get<SystemItem[]>(`${this.apiUrl}/Tags/popular`, { params: new HttpParams().set('limit', String(limit)) });
    }

    searchTags(query: string, limit: number = 10): Observable<SystemItem[]> {
        let params = new HttpParams().set('limit', String(limit));
        if (query?.trim()) params = params.set('q', query.trim());
        return this.http.get<SystemItem[]>(`${this.apiUrl}/Tags/search`, { params });
    }

    findOrCreateTag(name: string): Observable<SystemItem> {
        return this.http.post<SystemItem>(`${this.apiUrl}/Tags/find-or-create`, { name });
    }
}
