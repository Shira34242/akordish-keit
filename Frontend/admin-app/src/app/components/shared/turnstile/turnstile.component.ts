import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { environment } from '../../../../environments/environment';

interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  language: string;
  theme: 'light';
  size: 'flexible';
  appearance: 'interaction-only';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
  'error-callback': () => boolean;
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

@Component({
  selector: 'app-turnstile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="turnstile-shell" aria-label="בדיקת אבטחה">
      <div #container class="turnstile-container"></div>
      <p *ngIf="loadFailed && showError" class="turnstile-error" role="alert">
        לא הצלחנו לטעון את בדיקת האבטחה. נסו לרענן את העמוד.
      </p>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .turnstile-shell,
    .turnstile-container {
      width: 100%;
      max-width: 100%;
    }

    .turnstile-container {
      display: flex;
      justify-content: center;
      overflow: hidden;
    }

    .turnstile-error {
      margin: var(--space-sm, 6px) 0 0;
      color: #404040;
      font-size: var(--font-sm, 14px);
      line-height: var(--lh-small, 1.5);
      text-align: center;
    }
  `]
})
export class TurnstileComponent implements AfterViewInit, OnDestroy {
  private static scriptPromise?: Promise<void>;

  @Input() action = 'registration';
  @Input() showError = true;
  @Output() tokenChange = new EventEmitter<string | null>();
  @Output() verificationError = new EventEmitter<void>();
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;

  loadFailed = false;
  private widgetId?: string;
  private destroyed = false;

  constructor(private readonly zone: NgZone) {}

  ngAfterViewInit(): void {
    this.loadAndRender();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.widgetId && window.turnstile) {
      window.turnstile.remove(this.widgetId);
    }
  }

  reset(): void {
    this.tokenChange.emit(null);
    if (this.widgetId && window.turnstile) {
      window.turnstile.reset(this.widgetId);
    }
  }

  private async loadAndRender(): Promise<void> {
    try {
      await TurnstileComponent.loadScript();
      if (this.destroyed || !window.turnstile) return;

      this.widgetId = window.turnstile.render(this.container.nativeElement, {
        sitekey: environment.turnstileSiteKey,
        action: this.action,
        language: 'he',
        theme: 'light',
        size: 'flexible',
        appearance: 'interaction-only',
        callback: token => this.zone.run(() => {
          this.loadFailed = false;
          this.tokenChange.emit(token);
        }),
        'expired-callback': () => this.zone.run(() => this.tokenChange.emit(null)),
        'timeout-callback': () => this.zone.run(() => this.tokenChange.emit(null)),
        'error-callback': () => {
          this.zone.run(() => {
            this.loadFailed = true;
            this.tokenChange.emit(null);
            this.verificationError.emit();
          });
          return true;
        }
      });
    } catch {
      if (this.destroyed) return;
      this.zone.run(() => {
        this.loadFailed = true;
        this.tokenChange.emit(null);
        this.verificationError.emit();
      });
    }
  }

  private static loadScript(): Promise<void> {
    if (window.turnstile) return Promise.resolve();
    if (this.scriptPromise) return this.scriptPromise;

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('cloudflare-turnstile-script') as HTMLScriptElement | null;
      const script = existing ?? document.createElement('script');

      const onLoad = () => window.turnstile ? resolve() : reject(new Error('Turnstile unavailable'));
      const onError = () => reject(new Error('Turnstile failed to load'));

      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });

      if (!existing) {
        script.id = 'cloudflare-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });

    return this.scriptPromise;
  }
}
