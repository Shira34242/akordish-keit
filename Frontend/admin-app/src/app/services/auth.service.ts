import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface UserInstrumentRef {
    id: number;
    name: string;
    englishName?: string | null;
}

export interface User {
    id: number;
    username: string;
    email: string;
    profileImageUrl?: string;
    role: string | number;
    roleName?: string;
    level: number;
    points: number;
    preferredInstrumentId?: number | null;
    instruments?: UserInstrumentRef[];
    otherInstrumentName?: string | null;
    instrumentLevel?: number | null;   // 1=Beginner, 2=Intermediate, 3=Professional
    hasProfessionalProfile?: boolean;
    phone?: string | null;
    address?: string | null;
    cityId?: number | null;
    birthDate?: string | null;
    contentTag?: number;   // 0=None, 1=מתחיל, 2=תורם, 3=תורם מוביל
    uploadCount?: number;
    createdAt?: string;
    lastProfileReminderAt?: string | null;
    profileReminderDismissCount?: number;
    visitCount?: number;
    marketingConsent?: boolean;
    marketingConsentAt?: string | null;
    marketingConsentRevokedAt?: string | null;
}

export interface CompleteProfilePayload {
    instrumentIds?: number[];
    otherInstrumentName?: string | null;
    instrumentLevel?: number | null;
    userType?: string | null;
    phone?: string | null;
}

export interface UpdateSoftProfilePayload {
    phone?: string | null;
    cityId?: number | null;
    address?: string | null;
    birthMonth?: number | null;
    birthYear?: number | null;
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
    private apiUrl = `${environment.apiBaseUrl}/api/auth`; // Backend API URL
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

    register(username: string, email: string, password: string, termsApproved: boolean, marketingConsent = false): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/register`, { username, email, password, termsApproved, marketingConsent }, {
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

    googleLogin(idToken: string, termsApproved = false, marketingConsent = false): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/google-login`, { idToken, termsApproved, marketingConsent }, {
            withCredentials: true // 🔐 מאפשר שליחת וקבלת cookies
        }).pipe(
            tap(response => this.saveAuthResponse(response))
        );
    }

    refreshSession(): Observable<AuthResponse> {
        return this.http.get<AuthResponse>(`${this.apiUrl}/me`, {
            withCredentials: true
        }).pipe(
            tap(response => this.saveAuthResponse(response))
        );
    }

    completeProfile(payload: CompleteProfilePayload): Observable<User> {
        const body: Record<string, unknown> = {};
        if (payload.instrumentIds && payload.instrumentIds.length > 0) {
            body['instrumentIds'] = payload.instrumentIds;
        }
        if (payload.otherInstrumentName !== undefined && payload.otherInstrumentName !== null) {
            body['otherInstrumentName'] = payload.otherInstrumentName;
        }
        if (payload.instrumentLevel !== undefined && payload.instrumentLevel !== null) {
            body['instrumentLevel'] = payload.instrumentLevel;
        }
        if (payload.userType) {
            body['userType'] = payload.userType;
        }
        if (payload.phone) {
            body['phone'] = payload.phone;
        }

        return this.http.put<User>(`${this.apiUrl}/complete-profile`, body, {
            withCredentials: true
        }).pipe(
            tap(user => {
                localStorage.setItem('currentUser', JSON.stringify(user));
                this.currentUserSubject.next(user);
            })
        );
    }

    updateSoftProfile(payload: UpdateSoftProfilePayload): Observable<User> {
        return this.http.put<User>(`${this.apiUrl}/update-soft-profile`, payload, {
            withCredentials: true
        }).pipe(
            tap(user => {
                localStorage.setItem('currentUser', JSON.stringify(user));
                this.currentUserSubject.next(user);
            })
        );
    }

    updateMarketingConsent(marketingConsent: boolean): Observable<User> {
        return this.http.put<User>(`${this.apiUrl}/marketing-consent`, { marketingConsent }, {
            withCredentials: true
        }).pipe(
            tap(user => {
                localStorage.setItem('currentUser', JSON.stringify(user));
                this.currentUserSubject.next(user);
            })
        );
    }

    dismissProfileReminder(): Observable<{ lastProfileReminderAt: string; profileReminderDismissCount: number }> {
        return this.http.post<{ lastProfileReminderAt: string; profileReminderDismissCount: number }>(
            `${this.apiUrl}/dismiss-profile-reminder`,
            {},
            { withCredentials: true }
        ).pipe(
            tap(result => {
                const current = this.currentUserSubject.value;
                if (current) {
                    const updated: User = {
                        ...current,
                        lastProfileReminderAt: result.lastProfileReminderAt,
                        profileReminderDismissCount: result.profileReminderDismissCount
                    };
                    localStorage.setItem('currentUser', JSON.stringify(updated));
                    this.currentUserSubject.next(updated);
                }
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

    clearLocalAuth() {
        localStorage.removeItem('csrf-token');
        localStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);
    }

    logout() {
        this.clearLocalAuth();

        this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe({
            error: () => {}
        });
    }

    get currentUserValue(): User | null {
        return this.currentUserSubject.value;
    }

    isAdminOrManager(user: User | null = this.currentUserSubject.value): boolean {
        if (!user) return false;

        const rawRole = user.role;
        if (typeof rawRole === 'number') return rawRole >= 3;

        const roleValues = [
            rawRole,
            user.roleName,
            (user as unknown as { Role?: string | number }).Role,
            (user as unknown as { roleName?: string }).roleName
        ];

        return roleValues.some(role => {
            if (role === undefined || role === null) return false;
            if (typeof role === 'number') return role >= 3;

            const normalizedRole = String(role).trim().toLowerCase();
            return normalizedRole === 'admin'
                || normalizedRole === 'manager'
                || normalizedRole === '4'
                || normalizedRole === '3'
                || normalizedRole.includes('admin')
                || normalizedRole.includes('manager')
                || normalizedRole.includes('מנהל');
        });
    }

    updateCurrentUser(user: User) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
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
