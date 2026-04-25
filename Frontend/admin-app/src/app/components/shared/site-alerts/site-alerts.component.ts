import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SiteAlert, SiteAlertService, SiteConfirm } from '../../../services/site-alert.service';

@Component({
  selector: 'app-site-alerts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './site-alerts.component.html',
  styleUrls: ['./site-alerts.component.css']
})
export class SiteAlertsComponent implements OnInit, OnDestroy {
  alerts: SiteAlert[] = [];
  activeConfirm: SiteConfirm | null = null;
  private alertsSubscription?: Subscription;
  private confirmsSubscription?: Subscription;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(private siteAlertService: SiteAlertService) {}

  ngOnInit(): void {
    this.alertsSubscription = this.siteAlertService.alerts$.subscribe(alert => {
      this.alerts = [alert, ...this.alerts].slice(0, 3);
      const timer = setTimeout(() => this.dismiss(alert.id), 4200);
      this.timers.set(alert.id, timer);
    });

    this.confirmsSubscription = this.siteAlertService.confirms$.subscribe(confirm => {
      if (this.activeConfirm) {
        this.activeConfirm.resolve(false);
      }

      this.activeConfirm = confirm;
    });
  }

  ngOnDestroy(): void {
    this.alertsSubscription?.unsubscribe();
    this.confirmsSubscription?.unsubscribe();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.activeConfirm?.resolve(false);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.alerts = this.alerts.filter(alert => alert.id !== id);
  }

  answerConfirm(confirmed: boolean): void {
    if (!this.activeConfirm) {
      return;
    }

    this.activeConfirm.resolve(confirmed);
    this.activeConfirm = null;
  }
}
