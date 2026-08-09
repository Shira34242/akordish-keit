import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';

interface ReportInteraction {
  label: string;
  path?: string;
  isReportTrigger: boolean;
  occurredAt: number;
}

export interface CapturedReportError {
  id: string;
  summary: string;
  occurredAt: number;
}

@Injectable({ providedIn: 'root' })
export class ReportContextService {
  private readonly interactions: ReportInteraction[] = [];
  private lastError?: CapturedReportError;
  private started = false;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  start(): void {
    if (this.started || !this.document.defaultView) return;
    this.started = true;
    this.document.addEventListener('click', this.captureInteraction, false);
    this.document.defaultView.addEventListener('unhandledrejection', event => {
      const reason = event.reason;
      this.recordError(reason?.message || String(reason || 'Unhandled promise rejection'));
    });
  }

  getLastMeaningfulAction(): string | undefined {
    const cutoff = Date.now() - 10 * 60 * 1000;
    const interaction = [...this.interactions].reverse()
      .find(item => !item.isReportTrigger && item.occurredAt >= cutoff);
    if (!interaction) return undefined;
    return interaction.path ? `${interaction.label} · ${interaction.path}` : interaction.label;
  }

  recordError(message: string): CapturedReportError {
    const now = Date.now();
    const summary = this.sanitizeErrorSummary(message);
    if (this.lastError && this.lastError.summary === summary && now - this.lastError.occurredAt < 2000) {
      return this.lastError;
    }

    const randomPart = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(-4)
      : Math.random().toString(36).slice(2, 6);
    this.lastError = {
      id: `ERR-${now.toString(36).toUpperCase()}-${randomPart.toUpperCase()}`,
      summary,
      occurredAt: now
    };
    return this.lastError;
  }

  getRecentError(): CapturedReportError | undefined {
    return this.lastError && Date.now() - this.lastError.occurredAt <= 15 * 60 * 1000
      ? this.lastError
      : undefined;
  }

  getClientEnvironment(): string | undefined {
    const view = this.document.defaultView;
    if (!view) return undefined;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(view.navigator.userAgent);
    const device = mobile ? 'mobile' : 'desktop';
    return [
      device,
      `${view.innerWidth}x${view.innerHeight}`,
      `dpr ${view.devicePixelRatio || 1}`,
      view.navigator.language,
      view.navigator.userAgent.slice(0, 120)
    ].join(' · ');
  }

  private readonly captureInteraction = (event: MouseEvent): void => {
    const target = event.target instanceof Element
      ? event.target.closest('button, a, [role="button"]') as HTMLElement | null
      : null;
    if (!target || target.closest('app-report-modal')) return;

    const label = this.getElementLabel(target);
    if (!label) return;

    const path = target instanceof HTMLAnchorElement ? this.getInternalPath(target.href) : undefined;
    const isReportTrigger = target.matches('.btn-report, .not-found-report-link, [data-report-trigger]')
      || /דיווח|דווח|תקלה|report/i.test(label);

    this.interactions.push({ label, path, isReportTrigger, occurredAt: Date.now() });
    if (this.interactions.length > 8) this.interactions.shift();
  };

  private getElementLabel(element: HTMLElement): string {
    const raw = element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.textContent
      || '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  private getInternalPath(href: string): string | undefined {
    try {
      const url = new URL(href, this.document.baseURI);
      if (url.origin !== this.document.location?.origin) return undefined;
      return `${url.pathname}${url.search}${url.hash}`.slice(0, 220);
    } catch {
      return undefined;
    }
  }

  private sanitizeErrorSummary(message: string): string {
    return (message || 'Client error')
      .replace(/https?:\/\/\S+/gi, '[url]')
      .replace(/(token|password|secret|code|email)\s*[:=]\s*\S+/gi, '$1=[hidden]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
  }
}
