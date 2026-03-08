import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface User {
    id: number;
    username: string;
    email: string;
    profileImageUrl?: string;
    role: string | number;
    level: number;
    points: number;
    preferredInstrumentId?: number | null;
    hasProfessionalProfile?: boolean;
}

export interface AuthResponse {
    csrfToken: string; // 🔐 שונה מ-token ל-csrfToken - JWT נשמר ב-httpOnly cookie
    user: User;
    requiresProfileCompletion?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = 'https://localhost:44395/api/auth'; // Backend API URL
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    // לשמירת הדף שהמשתמש רצה להגיע אליו לפני שהתבקש להתחבר
    private returnUrlSubject = new BehaviorSubject<string | null>(null);
    public returnUrl$ = this.returnUrlSubject.asObservable();

    // לבקשת הצגת מודל הלוגין
    private loginRequestSubject = new BehaviorSubject<boolean>(false);
    public loginRequest$ = this.loginRequestSubject.asObservable();

    constructor(private http: HttpClient) {
        this.loadUserFromStorage();
    }

    private loadUserFromStorage() {
        const userJson = localStorage.getItem('currentUser');
        if (userJson) {
            try {
                this.currentUserSubject.next(JSON.parse(userJson));
            } catch (e) {
                console.error('Error parsing user from storage', e);
                localStorage.removeItem('currentUser');
            }
        }
    }

    private saveAuthResponse(response: AuthResponse) {
        if (response && response.csrfToken) {
            // 🔐 אבטחה משופרת!
            // JWT Token נשמר אוטומטית ב-httpOnly cookie על ידי הדפדפן (לא נגיש ל-JavaScript)
            // אנחנו שומרים רק CSRF token (צריך לשלוח אותו בכל בקשה)
            localStorage.setItem('csrf-token', response.csrfToken);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            this.currentUserSubject.next(response.user);
        }
    }

    register(username: string, email: string, password: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/register`, { username, email, password }, {
            withCredentials: true // 🔐 מאפשר שליחת וקבלת cookies
        }).pipe(
            tap(response => this.saveAuthResponse(response))
        );
    }

    login(usernameOrEmail: string, password: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { usernameOrEmail, password }, {
            withCredentials: true // 🔐 מאפשר שליחת וקבלת cookies
        }).pipe(
            tap(response => this.saveAuthResponse(response))
        );
    }

    googleLogin(idToken: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/google-login`, { idToken }, {
            withCredentials: true // 🔐 מאפשר שליחת וקבלת cookies
        }).pipe(
            tap(response => this.saveAuthResponse(response))
        );
    }

    completeProfile(preferredInstrumentId?: number | null, phone?: string): Observable<User> {
        const body: any = {};
        if (preferredInstrumentId !== undefined && preferredInstrumentId !== null) {
            body.preferredInstrumentId = preferredInstrumentId;
        }
        if (phone) {
            body.phone = phone;
        }

        return this.http.put<User>(`${this.apiUrl}/complete-profile`, body).pipe(
            tap(user => {
                localStorage.setItem('currentUser', JSON.stringify(user));
                this.currentUserSubject.next(user);
            })
        );
    }

    requestPasswordReset(usernameOrEmail: string, method: 'email' | 'sms'): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/request-password-reset`, {
            usernameOrEmail,
            method
        });
    }

    resetPassword(usernameOrEmail: string, verificationCode: string, newPassword: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/reset-password`, {
            usernameOrEmail,
            verificationCode,
            newPassword
        });
    }

    logout() {
        // 🔐 מנקה localStorage (cookies ינוקו על ידי הדפדפן כשהם פגי תוקף)
        localStorage.removeItem('csrf-token');
        localStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);

        // TODO: אפשר להוסיף endpoint ב-Backend למחיקת cookies
        // this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe();
    }

    get currentUserValue(): User | null {
        return this.currentUserSubject.value;
    }

    get isLoggedIn(): boolean {
        return !!this.currentUserSubject.value;
    }

    /**
     * מבקש הצגת מודל לוגין ושומר את ה-URL שהמשתמש רצה להגיע אליו
     * @param returnUrl - הדף שהמשתמש ינותב אליו אחרי לוגין מוצלח
     */
    requestLogin(returnUrl: string = '/') {
        this.returnUrlSubject.next(returnUrl);
        this.loginRequestSubject.next(true);
    }

    /**
     * מקבל את ה-URL שמור ומנקה אותו
     * משמש אחרי לוגין מוצלח כדי לנתב את המשתמש לדף המקורי
     */
    getAndClearReturnUrl(): string {
        const url = this.returnUrlSubject.value || '/';
        this.returnUrlSubject.next(null);
        return url;
    }

    /**
     * מנקה את בקשת הלוגין (אחרי שהמודל נסגר)
     */
    clearLoginRequest() {
        this.loginRequestSubject.next(false);
    }

    /**
     * מעדכן את סטטוס הפרופיל המקצועי של המשתמש לאחר יצירת פרופיל
     * נקרא כאשר המשתמש יוצר בהצלחה פרופיל מורה/אמן/בעל מקצוע
     */
    markAsProfessional() {
        const user = this.currentUserSubject.value;
        if (user) {
            const updated = { ...user, hasProfessionalProfile: true };
            localStorage.setItem('currentUser', JSON.stringify(updated));
            this.currentUserSubject.next(updated);
        }
    }
}
