import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoogleSigninButtonModule, SocialAuthService } from '@abacritt/angularx-social-login';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../../services/auth.service';
import { GoogleOneTapService } from '../../../services/google-one-tap.service';
import { AddSongModalComponent } from '../../add-song-modal/add-song-modal.component';
import { LegalPageContent, PAGES } from '../legal-page/legal-page.component';
import { TurnstileComponent } from '../../shared/turnstile/turnstile.component';

type JoinChordsLegalKey = 'terms' | 'privacy';

@Component({
  selector: 'app-join-chords',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GoogleSigninButtonModule,
    TurnstileComponent,
    AddSongModalComponent
  ],
  templateUrl: './join-chords.component.html',
  styleUrls: ['../join-index/join-index.component.css', './join-chords.component.css']
})
export class JoinChordsComponent implements OnInit, OnDestroy {
  @ViewChild(TurnstileComponent) turnstile?: TurnstileComponent;
  user: User | null = null;
  loadingGoogle = false;
  googleError = '';
  termsApproved = false;
  marketingConsent = false;
  turnstileToken: string | null = null;
  activeLegalKey: JoinChordsLegalKey | null = null;
  emailCopied = false;
  linkCopied = false;
  showSmartUploader = true;

  private userSub?: Subscription;
  private googleAuthSub?: Subscription;

  constructor(
    private authService: AuthService,
    private socialAuthService: SocialAuthService
  ) {}

  ngOnInit(): void {
    GoogleOneTapService.setModalActive(true);

    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });

    this.googleAuthSub = this.socialAuthService.authState.subscribe(user => {
      if (user?.idToken && !this.user && !GoogleOneTapService.isProcessing()) {
        this.handleGoogleLogin(user.idToken);
      }
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.googleAuthSub?.unsubscribe();
    GoogleOneTapService.setModalActive(false);
  }

  switchAccount(): void {
    this.authService.logout();
    this.socialAuthService.signOut().catch(() => {});
    this.turnstile?.reset();
  }

  onTurnstileToken(token: string | null): void {
    this.turnstileToken = token;
  }

  get activeLegalPage(): LegalPageContent | null {
    return this.activeLegalKey ? PAGES[this.activeLegalKey] : null;
  }

  openLegal(key: JoinChordsLegalKey): void {
    this.activeLegalKey = key;
  }

  closeLegal(): void {
    this.activeLegalKey = null;
  }

  resetSmartUploader(): void {
    this.showSmartUploader = false;
    setTimeout(() => this.showSmartUploader = true);
  }

  async copyEmail(): Promise<void> {
    const email = 'akordishkayt@gmail.com';

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        this.copyWithTextarea(email);
      }

      this.showEmailCopied();
    } catch {
      this.copyWithTextarea(email);
      this.showEmailCopied();
    }
  }

  async copyPageLink(): Promise<void> {
    const link = typeof window !== 'undefined' ? window.location.href : '/join-chords';

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        this.copyWithTextarea(link);
      }

      this.showLinkCopied();
    } catch {
      this.copyWithTextarea(link);
      this.showLinkCopied();
    }
  }

  onSongAdded(): void {
    return;
  }

  private handleGoogleLogin(idToken: string): void {
    if (!this.termsApproved || !this.marketingConsent) {
      this.googleError = 'כדי להתחבר עם Google יש לאשר את התקנון, מדיניות הפרטיות וקבלת הדיוור.';
      return;
    }

    this.loadingGoogle = true;
    this.googleError = '';
    GoogleOneTapService.setProcessing(true);

    this.authService.googleLogin(idToken, true, true, this.turnstileToken ?? undefined).subscribe({
      next: () => {
        this.loadingGoogle = false;
        GoogleOneTapService.setProcessing(false);
      },
      error: (error) => {
        this.loadingGoogle = false;
        GoogleOneTapService.setProcessing(false);
        this.turnstile?.reset();

        if (this.isGoogleRegistrationRequiredError(error)) {
          this.googleError = error?.error?.code === 'TURNSTILE_REQUIRED'
            ? 'כדי להשלים הרשמה עם Google יש לעבור את בדיקת האבטחה.'
            : 'כדי להשלים הרשמה עם Google יש לאשר את התקנון, מדיניות הפרטיות וקבלת הדיוור.';
          return;
        }

        this.googleError = error?.error?.message || 'שגיאה בכניסה עם Google';
      }
    });
  }

  private isGoogleRegistrationRequiredError(error: any): boolean {
    const body = error?.error;
    const message = typeof body === 'string' ? body : body?.message;

    return body?.code === 'TERMS_REQUIRED'
      || body?.code === 'MARKETING_CONSENT_REQUIRED'
      || body?.code === 'TURNSTILE_REQUIRED'
      || (typeof message === 'string' && message.includes('תקנון'));
  }

  private showEmailCopied(): void {
    this.emailCopied = true;
    setTimeout(() => this.emailCopied = false, 1800);
  }

  private showLinkCopied(): void {
    this.linkCopied = true;
    setTimeout(() => this.linkCopied = false, 1800);
  }

  private copyWithTextarea(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
