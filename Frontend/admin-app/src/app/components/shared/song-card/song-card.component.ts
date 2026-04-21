import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-song-card',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './song-card.component.html',
    styleUrls: ['./song-card.component.css']
})
export class SongCardComponent {
    @Input() song: any;
    @Input() layout: 'overlay' | 'card' = 'overlay';

    get chordMatchText(): string {
        if (this.song?.knowsAllChords) {
            return 'כל האקורדים מוכרים';
        }

        const missing = this.song?.missingChordCount;
        if (missing === undefined || missing === null) {
            return '';
        }

        return missing === 1 ? 'חסר אקורד אחד' : `חסרים ${missing} אקורדים`;
    }

    get chordMatchInfoText(): string {
        const missing = this.song?.missingChordCount;
        if (this.song?.knowsAllChords) {
            return 'לפי האקורדים שסימנת שאתה יודע לנגן, כל האקורדים בשיר מוכרים לך.';
        }

        if (missing === undefined || missing === null) {
            return '';
        }

        return `לפי האקורדים שסימנת שאתה יודע לנגן, חסרים לך ${missing} אקורדים כדי לנגן את השיר.`;
    }
}
