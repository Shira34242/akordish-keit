import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CloudflareImagePipe } from '../../../pipes/cloudflare-image.pipe';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';

@Component({
    selector: 'app-artist-circle',
    standalone: true,
    imports: [CommonModule, RouterModule, CloudflareImagePipe, ImgFallbackDirective],
    templateUrl: './artist-circle.component.html',
    styleUrls: ['./artist-circle.component.css']
})
export class ArtistCircleComponent {
    @Input() artist: any;
}
