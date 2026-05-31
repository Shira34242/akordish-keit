import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CloudflareImagePipe, CloudflareImageSrcsetPipe } from '../../../pipes/cloudflare-image.pipe';

@Component({
    selector: 'app-artist-circle',
    standalone: true,
    imports: [CommonModule, RouterModule, CloudflareImagePipe, CloudflareImageSrcsetPipe],
    templateUrl: './artist-circle.component.html',
    styleUrls: ['./artist-circle.component.css']
})
export class ArtistCircleComponent {
    @Input() artist: any;
}
