import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
    selector: 'app-admin-layout',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './admin-layout.component.html',
    styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent {
    contentMenuOpen = false;
    usersMenuOpen = false;

    constructor(private router: Router) { }

    goBackToSite() {
        this.router.navigate(['/']);
    }

    toggleContentMenu() {
        const nextState = !this.contentMenuOpen;
        this.closeAllDropdowns();
        this.contentMenuOpen = nextState;
    }

    closeContentMenu() {
        this.contentMenuOpen = false;
    }

    toggleUsersMenu() {
        const nextState = !this.usersMenuOpen;
        this.closeAllDropdowns();
        this.usersMenuOpen = nextState;
    }

    closeUsersMenu() {
        this.usersMenuOpen = false;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (!target.closest('.nav-item-with-dropdown')) {
            this.closeAllDropdowns();
        }
    }

    private closeAllDropdowns(): void {
        this.contentMenuOpen = false;
        this.usersMenuOpen = false;
    }
}
