import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';
import { SubscriptionDto } from '../../models/subscription.model';

@Component({
  selector: 'app-subscription-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './subscription-success.html',
  styleUrls: ['./subscription-success.css']
})
export class SubscriptionSuccessComponent implements OnInit {
  subscription: SubscriptionDto | null = null;
  loading = true;
  sessionId = '';

  constructor(
    private route: ActivatedRoute,
    private subscriptionService: SubscriptionService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Cardcom מוסיף ?LowProfileCode=xxx — תומכים גם ב-session_id לתאימות לאחור
    this.sessionId = this.route.snapshot.queryParamMap.get('LowProfileCode')
                  || this.route.snapshot.queryParamMap.get('session_id')
                  || '';
    const user = this.authService.currentUserValue;
    if (!user) { this.loading = false; return; }

    if (this.sessionId) {
      // אמת את הסשן ופעיל את המנוי
      this.subscriptionService.verifySession(this.sessionId).subscribe({
        next: () => this.loadSubscription(user.id),
        error: () => this.loadSubscription(user.id)
      });
    } else {
      this.loadSubscription(user.id);
    }
  }

  private loadSubscription(userId: number) {
    this.subscriptionService.getUserActiveSubscription(userId).subscribe({
      next: (sub) => { this.subscription = sub; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  getPlanName(): string {
    if (!this.subscription) return '';
    switch (this.subscription.plan) {
      case 1: return 'PLUS+';
      case 2: return 'PRO';
      default: return 'BASIC';
    }
  }
}
