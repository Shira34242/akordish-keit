import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ContentPageService {
  private currentArticleIdSource = new BehaviorSubject<number | null>(null);
  currentArticleId$ = this.currentArticleIdSource.asObservable();

  setCurrentArticle(id: number): void {
    this.currentArticleIdSource.next(id);
  }

  clearCurrentArticle(): void {
    this.currentArticleIdSource.next(null);
  }
}
