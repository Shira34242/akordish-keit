import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RewardTransaction {
  id: number;
  amount: number;
  balanceAfter: number;
  actionType: string;
  description?: string | null;
  createdAt: string;
}

export interface RewardWallet {
  isAvailable: boolean;
  coinBalance: number;
  chordBookCost: number;
  transactions: RewardTransaction[];
}

@Injectable({ providedIn: 'root' })
export class RewardService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/rewards`;
  private readonly walletSubject = new BehaviorSubject<RewardWallet | null>(null);
  readonly wallet$ = this.walletSubject.asObservable();
  constructor(private http: HttpClient) {}
  getMyWallet(): Observable<RewardWallet> {
    return this.http.get<RewardWallet>(`${this.apiUrl}/me`).pipe(tap(wallet => this.walletSubject.next(wallet)));
  }
  applyBalance(balance: number): void {
    const wallet = this.walletSubject.value;
    if (wallet) this.walletSubject.next({ ...wallet, coinBalance: balance });
  }
  refundChordBook(transactionId: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/chord-book-refund/${transactionId}`, {});
  }
}
