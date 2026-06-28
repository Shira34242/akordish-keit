import { ErrorHandler, Injectable } from '@angular/core';

const RELOAD_KEY = 'chunk-error-reload';

@Injectable()
export class ChunkErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const msg: string = error?.message ?? '';
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
  }
}
