import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BoostService } from '../../services/boost.service';
import { BoostType, BoostTypeHelper } from '../../models/subscription.model';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-boost-purchase',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './boost-purchase.html',
  styleUrls: ['./boost-purchase.css']
})
export class BoostPurchaseComponent {
  @Input() serviceProviderId!: number;
  @Input() type: BoostType = BoostType.TopOfRecommended;
  @Output() purchased = new EventEmitter<void>();

  loading = false;
  error = '';

  BoostType = BoostType;

  private readonly langService = inject(LanguageService);

  constructor(private boostService: BoostService) {}

  getBoostName(): string {
    return BoostTypeHelper.getName(this.type);
  }

  getBoostPrice(): number {
    return BoostTypeHelper.getPrice(this.type);
  }

  purchaseBoost() {
    if (!this.serviceProviderId) {
      this.error = this.langService.translate('boost.error_no_profile');
      return;
    }

    this.loading = true;
    this.error = '';

    const price = this.getBoostPrice();

    // בפועל כאן תהיה אינטגרציה עם ספק תשלום
    // כרגע נדמה תשלום
    const mockPaymentId = `payment_${Date.now()}`;

    this.boostService.purchaseBoost(
      this.serviceProviderId,
      this.type,
      price,
      mockPaymentId
    ).subscribe({
      next: () => {
        this.loading = false;
        this.purchased.emit();
        alert(`${this.langService.translate('boost.success_pre')}${this.getBoostName()}`);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || this.langService.translate('boost.error_purchase');
        console.error('Error purchasing boost:', err);
      }
    });
  }

  getBoostDescription(): string {
    switch (this.type) {
      case BoostType.TopOfRecommended:
        return this.langService.translate('boost.desc_top');
      case BoostType.HomepageBanner:
        return this.langService.translate('boost.desc_banner');
      default:
        return '';
    }
  }

  getBoostIcon(): string {
    switch (this.type) {
      case BoostType.TopOfRecommended:
        return '🚀';
      case BoostType.HomepageBanner:
        return '⭐';
      default:
        return '💫';
    }
  }
}
