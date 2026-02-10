import { Component, Input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-carousel',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './carousel.component.html',
    styleUrls: ['./carousel.component.css']
})
export class CarouselComponent {
    @Input() title: string = '';
    @Input() linkText: string = 'עוד';
    @Input() linkUrl: string = '/';

    @ViewChild('scrollContainer') scrollContainer!: ElementRef;

    scroll(direction: 'left' | 'right') {
        const container = this.scrollContainer.nativeElement;
        const scrollAmount = 300;
        if (direction === 'left') {
            container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        } else {
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }
}
