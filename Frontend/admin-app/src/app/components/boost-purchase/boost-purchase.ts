import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BoostService } from '../../services/boost.service';
import { BoostType, BoostTypeHelper } from '../../models/subscription.model';

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

  BoostType = BoostType; // עבור ה-template

  constructor(private boostService: BoostService) {}

  getBoostName(): string {
    return BoostTypeHelper.getName(this.type);
  }

  getBoostPrice(): number {
    return BoostTypeHelper.getPrice(this.type);
  }

  purchaseBoost() {
    if (!this.serviceProviderId) {
      this.error = 'חסר מזהה פרופיל';
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
        alert(`הבוסט נרכש בהצלחה! הפרופיל שלך עכשיו ב${this.getBoostName()}`);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'שגיאה ברכישת הבוסט';
        console.error('Error purchasing boost:', err);
      }
    });
  }

  getBoostDescription(): string {
    switch (this.type) {
      case BoostType.TopOfRecommended:
        return 'הפרופיל שלך יקפוץ לראש רשימת המומלצים! פעיל עד שמישהו אחר קונה בוסט.';
      case BoostType.HomepageBanner:
        return 'הפרופיל שלך יוצג בבאנר בדף הבית! נראות מקסימלית.';
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
