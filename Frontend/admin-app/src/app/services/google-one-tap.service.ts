import { Injectable } from '@angular/core';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class GoogleOneTapService {
    private initialized = false;
    private promptRequested = false;
    private static processing = false;
    private static modalActive = false;

    constructor(
        private authService: AuthService,
        private socialAuthService: SocialAuthService
    ) { }

    init(): void {
        if (this.initialized) return;
        this.initialized = true;

        this.socialAuthService.authState.subscribe(user => {
            if (!user?.idToken
                || this.authService.currentUserValue
                || GoogleOneTapService.modalActive
                || GoogleOneTapService.processing) {
                return;
            }

            GoogleOneTapService.setProcessing(true);
            this.authService.googleLogin(user.idToken).subscribe({
                next: () => {
                    GoogleOneTapService.setProcessing(false);
                    this.cancelOneTapPrompt();
                },
                error: error => {
                    GoogleOneTapService.setProcessing(false);
                    if (this.isTermsRequiredError(error)) {
                        const returnUrl = window.location.pathname + window.location.search;
                        this.authService.requestLogin(returnUrl || '/');
                    }
                }
            });
        });

        // אם המשתמש כבר מחובר באתר (או מתחבר במהלך הסשן) — לבטל את החלונית של גוגל
        this.authService.currentUser$.subscribe(user => {
            if (user) this.cancelOneTapPrompt();
        });
    }

    promptForGuest(): void {
        if (this.authService.currentUserValue || GoogleOneTapService.modalActive || this.promptRequested) return;

        this.promptRequested = true;
        this.socialAuthService.initState.subscribe(() => {
            if (this.authService.currentUserValue || GoogleOneTapService.modalActive) return;

            const googleApi = (window as any).google?.accounts?.id;
            if (googleApi?.prompt) {
                try { googleApi.prompt(console.debug); } catch { /* noop */ }
            }
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

    private isTermsRequiredError(error: any): boolean {
        const body = error?.error;
        const message = typeof body === 'string' ? body : body?.message;

        return body?.code === 'TERMS_REQUIRED'
            || (typeof message === 'string' && message.includes('תקנון'));
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
