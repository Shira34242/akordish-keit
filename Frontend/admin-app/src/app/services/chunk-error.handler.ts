import { ErrorHandler, Injectable } from '@angular/core';
import { ReportContextService } from './report-context.service';

const RELOAD_KEY = 'chunk-error-reload';
let _reportingError = false;

@Injectable()
export class ChunkErrorHandler implements ErrorHandler {
  constructor(private reportContext: ReportContextService) {}

  handleError(error: any): void {
    const msg: string = error?.message ?? String(error ?? '');

    const isChunkError =
      /Failed to fetch dynamically imported module/.test(msg) ||
      /Loading chunk [\d]+ failed/.test(msg) ||
      /ChunkLoadError/.test(msg);

    if (isChunkError) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        return;
      }
    }

    console.error(error);
    const captured = this.reportContext.recordError(msg);
    this._sendToServer(msg, error?.stack, captured.id);
  }

  private _sendToServer(message: string, stack?: string, errorId?: string): void {
    if (_reportingError) return;
    _reportingError = true;

    const body = JSON.stringify({
      message,
      stack: stack ?? null,
      url: window.location.href,
      userAgent: navigator.userAgent,
      errorId: errorId ?? null
    });

    fetch('/api/ClientErrors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    })
      .catch(() => { /* silent — don't cause infinite error loop */ })
      .finally(() => { _reportingError = false; });
  }
}
