import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserStats {
    totalUsers: number;
    totalAdmins: number;
    totalTeachers: number;
    totalArtists: number;
}

export interface RecentJoin {
    name: string;
    date: Date;
    type: string;
    profileImageUrl?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private apiUrl = 'https://localhost:44395/api/user'; // Adjust port if needed

    constructor(private http: HttpClient) { }

    getUserStats(): Observable<UserStats> {
        return this.http.get<UserStats>(`${this.apiUrl}/stats`);
    }

    getRecentJoins(): Observable<RecentJoin[]> {
        return this.http.get<RecentJoin[]>(`${this.apiUrl}/recent-joins`);
    }
}
