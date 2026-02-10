import { Component } from '@angular/core';
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
        this.contentMenuOpen = !this.contentMenuOpen;
    }

    closeContentMenu() {
        this.contentMenuOpen = false;
    }

    toggleUsersMenu() {
        this.usersMenuOpen = !this.usersMenuOpen;
    }

    closeUsersMenu() {
        this.usersMenuOpen = false;
    }
}
