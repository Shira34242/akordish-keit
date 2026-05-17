import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { ReportService } from '../../../services/report.service';
import { filter, Subscription } from 'rxjs';

@Component({
    selector: 'app-admin-layout',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './admin-layout.component.html',
    styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
    pendingReportsCount = 0;
    private routerSub?: Subscription;

    constructor(
        private router: Router,
        private reportService: ReportService
    ) { }

    ngOnInit() {
        this.refreshPendingReportsCount();
        this.routerSub = this.router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
                this.refreshPendingReportsCount();
            });
    }

    ngOnDestroy() {
        this.routerSub?.unsubscribe();
    }

    refreshPendingReportsCount() {
        this.reportService.getReports(1, 1, 'Pending').subscribe({
            next: result => this.pendingReportsCount = result.totalCount,
            error: () => this.pendingReportsCount = 0
        });
    }
}
