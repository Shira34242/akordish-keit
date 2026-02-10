import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-artist-circle',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './artist-circle.component.html',
    styleUrls: ['./artist-circle.component.css']
})
export class ArtistCircleComponent {
    @Input() artist: any;
}
