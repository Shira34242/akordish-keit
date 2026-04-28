import { Injectable } from '@angular/core';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class GoogleOneTapService {
    private initialized = false;
    private static processing = false;
    private static modalActive = false;

    constructor(
        private socialAuthService: SocialAuthService,
        private authService: AuthService
    ) { }

    init(): void {
        if (this.initialized) return;
        this.initialized = true;

        this.socialAuthService.authState.subscribe(user => {
            if (!user?.idToken) return;
            if (this.authService.isLoggedIn) return;
            if (GoogleOneTapService.processing) return;
            if (GoogleOneTapService.modalActive) return;

            GoogleOneTapService.processing = true;
            this.authService.googleLogin(user.idToken).subscribe({
                next: () => { GoogleOneTapService.processing = false; },
                error: (err) => {
                    console.error('Google One Tap login failed:', err);
                    GoogleOneTapService.processing = false;
                }
            });
        });

        // אם המשתמש כבר מחובר באתר (או מתחבר במהלך הסשן) — לבטל את החלונית של גוגל
        this.authService.currentUser$.subscribe(user => {
            if (user) this.cancelOneTapPrompt();
        });
    }

    private cancelOneTapPrompt(): void {
        const tryCancel = () => {
            const googleApi = (window as any).google?.accounts?.id;
            if (googleApi?.cancel) {
                try { googleApi.cancel(); } catch { /* noop */ }
            }
        };
        tryCancel();
        // ניסיונות חוזרים — לפעמים סקריפט גוגל עדיין לא נטען בזמן הקריאה הראשונה
        setTimeout(tryCancel, 500);
        setTimeout(tryCancel, 1500);
    }

    static isProcessing(): boolean {
        return GoogleOneTapService.processing;
    }

    static setProcessing(value: boolean): void {
        GoogleOneTapService.processing = value;
    }

    static setModalActive(value: boolean): void {
        GoogleOneTapService.modalActive = value;
    }
}
