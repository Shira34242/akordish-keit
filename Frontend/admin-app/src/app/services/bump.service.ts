import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BumpRequestDto {
    entityType: string;
    ids: number[];
    schedule?: {
        times: number;
        intervalHours: number;
    };
}

export interface BumpResponseDto {
    bumpedCount: number;
}

@Injectable({
    providedIn: 'root'
})
export class BumpService {
    private apiUrl = `${environment.apiBaseUrl}/api/admin/Bump`;

    constructor(private http: HttpClient) { }

    bump(request: BumpRequestDto): Observable<BumpResponseDto> {
        return this.http.post<BumpResponseDto>(this.apiUrl, request);
    }
}
