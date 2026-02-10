import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';

@Component({
    selector: 'app-system-layout',
    standalone: true,
    imports: [CommonModule, RouterOutlet, RouterModule],
    templateUrl: './system-layout.component.html',
    styleUrls: ['./system-layout.component.css']
})
export class SystemLayoutComponent { }
